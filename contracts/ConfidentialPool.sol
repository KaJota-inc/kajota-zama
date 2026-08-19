// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Testnet stand-in for a real ERC-4626 yield adapter — the pool mints its own reserve.
interface IMintableConfidential {
    function faucet(uint64 amount) external returns (euint64);
}

/// @title  Àjọ — Confidential PoolTogether (time-weighted)
/// @author KaJota (Zama Developer Program Mainnet Season 4)
/// @notice A no-loss prize-savings pool on the Zama FHEVM. Deposits, balances and winnings are
///         encrypted `euint64` and never leave ciphertext. Yield funds a public rollover jackpot;
///         each round a public, commit-revealed seed selects **exactly one winner, weighted by the
///         time-weighted average of the encrypted deposit** — so a whale cannot snipe a round by
///         depositing right before it. The whole selection runs over ciphertext, yet anyone can
///         re-derive the randomness and audit it. Only the winner decrypts their prize; principal
///         is withdrawable any time.
///
/// @dev    ── Time-weighted odds (TWAB) ────────────────────────────────────────────────────────
///         Each account carries an encrypted balance-seconds integral `twabCum = ∫ balance dt` and
///         a lazily-taken snapshot `twabSnap` at the round's `windowStart`, both maintained by
///         `_syncTwab` *before every balance change*. A deposit only accrues weight from the moment
///         it lands, so a last-second whale earns ~zero odds. The per-user draw weight is the
///         window average `avg_i = (twabCum[commit] - twabSnap[windowStart]) / windowDuration`.
///
///         ── Single-winner draw (two passes, both over ciphertext, no decryption) ──────────────
///         Pass 1 `tallyDraw`: walk participants, compute each `avg_i`, and accumulate the encrypted
///         `totalWeight`. Then `target = (r · totalWeight) / 2^32` with public `r = uint32(keccak256(
///         roundId, seed))` — the encrypted winning ticket, uniform in `[0, totalWeight)`.
///         Pass 2 `runDraw`: walk again with an encrypted running prefix and flag the one account
///         whose `[prefix, prefix+avg_i)` interval contains `target`. Exactly one winner. Both passes
///         are paginated for bounded gas. Randomness is commit-reveal (public + auditable), never
///         `FHE.randEuint64` (a ciphertext, which would defeat public verifiability).
contract ConfidentialPool is ZamaEthereumConfig, IERC7984Receiver, IERC165, Ownable, ReentrancyGuard {
    IERC7984 public immutable asset;

    // ── Encrypted pool state ─────────────────────────────────────────────────────────────
    mapping(address => euint64) private _balance;
    euint64 private _total;
    address[] private _participants;
    mapping(address => bool) public isParticipant;
    /// @notice Authorised gateways (e.g. a Shield AgentMandate) that may deposit ON BEHALF OF a
    ///         beneficiary — how an autonomous agent, under a confidential mandate, saves into the
    ///         pool for its principal. The saver's position is the principal's, not the gateway's.
    mapping(address => bool) public isDepositor;

    // ── TWAB accumulators ────────────────────────────────────────────────────────────────
    mapping(address => euint128) private _twabCum; // ∫ balance dt (balance-seconds)
    mapping(address => uint256) private _tLast; // last time twabCum was advanced
    mapping(address => euint128) private _twabSnap; // twabCum as of the round windowStart
    mapping(address => uint256) private _snapRound; // round the snapshot belongs to
    uint256 public windowStart; // start of the current accrual window
    uint256 public commitTime; // frozen accrual cap during a live round
    uint256 public windowDuration; // commitTime − windowStart, set at commit

    // ── Public rollover jackpot (yield-funded) ───────────────────────────────────────────
    uint64 public jackpot;

    // ── Draw round state machine ─────────────────────────────────────────────────────────
    enum Phase {
        Open,
        Committed,
        Revealed
    }

    Phase public phase;
    uint256 public roundId;
    bytes32 public seedCommitment;
    bytes32 public revealedSeed;
    uint256 public revealDeadline;

    mapping(uint256 => mapping(address => euint128)) private _weight; // round → user → avg weight
    euint128 private _totalWeight;
    euint128 private _drawTarget;
    euint128 private _drawPrefix;
    uint256 public tallyCursor;
    bool public tallyComplete;
    uint256 public drawCursor;
    bool public drawComplete;

    mapping(uint256 => mapping(address => ebool)) private _won;
    mapping(uint256 => mapping(address => bool)) public claimed;

    uint128 private constant TWO_POW_32 = uint128(1) << 32;
    bytes32 private constant PRIZE_TAG = keccak256("PRIZE");

    // ── Events ───────────────────────────────────────────────────────────────────────────
    event Deposited(address indexed user);
    event ReserveFunded();
    event YieldHarvested(uint64 amount, uint64 jackpot);
    event RoundCommitted(uint256 indexed roundId, bytes32 commitment, uint64 jackpot, uint256 revealDeadline);
    event RoundRevealed(uint256 indexed roundId, bytes32 seed);
    event TallyProgress(uint256 indexed roundId, uint256 cursor, bool complete);
    event DrawProgress(uint256 indexed roundId, uint256 cursor, bool complete);
    event Claimed(uint256 indexed roundId, address indexed user);
    event Withdrawn(address indexed user);
    event RoundClosed(uint256 indexed roundId);
    event PublicTotalDisclosed();

    error WrongPhase();
    error AlreadyClaimed();
    error BadReveal();
    error NotAsset();
    error RevealWindowStillOpen();
    error EmptyPool();
    error TallyNotComplete();
    error DrawNotComplete();
    error AlreadyComplete();
    error ZeroWindow();
    error NotDepositor();

    constructor(IERC7984 asset_) Ownable(msg.sender) {
        asset = asset_;
        windowStart = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                   TWAB maintenance
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// @dev Accrual cap: real time while Open, frozen at `commitTime` during a live round so the
    ///      TWAB window ends exactly at commit (withdrawals mid-round add no post-commit weight).
    function _cap() private view returns (uint256) {
        return phase == Phase.Open ? block.timestamp : commitTime;
    }

    /// @dev Advance a user's TWAB integral to the current cap, taking the windowStart snapshot on
    ///      first touch this round. MUST be called before any change to `_balance[user]`.
    function _syncTwab(address u) private {
        uint256 tl = _tLast[u];
        euint128 bal = FHE.asEuint128(_balance[u]);

        if (_snapRound[u] != roundId) {
            euint128 snap = _twabCum[u];
            if (windowStart > tl) {
                snap = FHE.add(snap, FHE.mul(bal, uint128(windowStart - tl)));
            }
            _twabSnap[u] = snap;
            FHE.allowThis(_twabSnap[u]);
            _snapRound[u] = roundId;
        }

        uint256 cap = _cap();
        if (cap > tl) {
            _twabCum[u] = FHE.add(_twabCum[u], FHE.mul(bal, uint128(cap - tl)));
            FHE.allowThis(_twabCum[u]);
            _tLast[u] = cap;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                      Deposit
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function onConfidentialTransferReceived(
        address /* operator */,
        address from,
        euint64 amount,
        bytes calldata data
    ) external override returns (ebool) {
        if (msg.sender != address(asset)) revert NotAsset();
        if (from == owner() && keccak256(data) == PRIZE_TAG) {
            emit ReserveFunded();
            return _accept();
        }
        if (phase != Phase.Open) revert WrongPhase();
        _credit(from, amount);
        emit Deposited(from);
        return _accept();
    }

    function _accept() private returns (ebool ok) {
        ok = FHE.asEbool(true);
        FHE.allowThis(ok);
        FHE.allowTransient(ok, msg.sender);
    }

    function _credit(address user, euint64 amount) private {
        if (!isParticipant[user]) {
            isParticipant[user] = true;
            _participants.push(user);
            _tLast[user] = block.timestamp;
        }
        _syncTwab(user); // accrue at OLD balance before it changes
        euint64 bal = FHE.add(_balance[user], amount);
        euint64 tot = FHE.add(_total, amount);
        _balance[user] = bal;
        _total = tot;
        FHE.allowThis(bal);
        FHE.allow(bal, user);
        FHE.allowThis(tot);
    }

    /// @notice Authorise (or revoke) a gateway that may deposit on a beneficiary's behalf.
    function setDepositor(address gateway, bool allowed) external onlyOwner {
        isDepositor[gateway] = allowed;
    }

    /// @notice Credit a deposit of encrypted `amount` to `beneficiary`, called by an authorised
    ///         gateway (a Shield mandate) that has already moved the backing cUSDT into this pool.
    ///         This is the bridge: an agent saves into the confidential pool for its principal,
    ///         under a confidential mandate — the position belongs to the principal.
    /// @dev    `amount` must be ACL-granted to this pool by the caller (FHE.allowTransient).
    function creditDeposit(address beneficiary, euint64 amount) external {
        if (!isDepositor[msg.sender]) revert NotDepositor();
        if (phase != Phase.Open) revert WrongPhase();
        _credit(beneficiary, amount);
        emit Deposited(beneficiary);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                    Yield → jackpot
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function harvestYield(uint64 amount) external onlyOwner {
        IMintableConfidential(address(asset)).faucet(amount);
        jackpot += amount;
        emit YieldHarvested(amount, jackpot);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                    Round lifecycle
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function commitRound(bytes32 commitment, uint256 revealWindow) external onlyOwner {
        if (phase != Phase.Open) revert WrongPhase();
        if (_participants.length == 0 || jackpot == 0) revert EmptyPool();
        if (block.timestamp <= windowStart) revert ZeroWindow();

        seedCommitment = commitment;
        commitTime = block.timestamp;
        windowDuration = commitTime - windowStart;

        _totalWeight = FHE.asEuint128(0);
        FHE.allowThis(_totalWeight);
        _drawPrefix = FHE.asEuint128(0);
        FHE.allowThis(_drawPrefix);
        tallyCursor = 0;
        tallyComplete = false;
        drawCursor = 0;
        drawComplete = false;

        revealDeadline = block.timestamp + revealWindow;
        phase = Phase.Committed;
        emit RoundCommitted(roundId, commitment, jackpot, revealDeadline);
    }

    function revealSeed(bytes32 seed) external onlyOwner {
        if (phase != Phase.Committed) revert WrongPhase();
        if (keccak256(abi.encodePacked(seed)) != seedCommitment) revert BadReveal();
        revealedSeed = seed;
        phase = Phase.Revealed;
        emit RoundRevealed(roundId, seed);
    }

    /// @notice Pass 1 — compute each participant's time-weighted average and the encrypted total.
    ///         When the walk completes, derive the encrypted winning ticket `target`.
    function tallyDraw(uint256 count) external {
        if (phase != Phase.Revealed) revert WrongPhase();
        if (tallyComplete) revert AlreadyComplete();

        uint256 end = tallyCursor + count;
        if (end > _participants.length) end = _participants.length;

        euint128 tw = _totalWeight;
        for (uint256 i = tallyCursor; i < end; i++) {
            address u = _participants[i];
            _syncTwab(u); // brings twabCum to commitTime + ensures the windowStart snapshot
            euint128 w = FHE.sub(_twabCum[u], _twabSnap[u]); // balance-seconds over the window
            euint128 avg = FHE.div(w, uint128(windowDuration)); // ← time-weighted average balance
            _weight[roundId][u] = avg;
            FHE.allowThis(avg);
            FHE.allow(avg, u);
            tw = FHE.add(tw, avg);
        }
        _totalWeight = tw;
        FHE.allowThis(_totalWeight);
        tallyCursor = end;

        if (end == _participants.length) {
            tallyComplete = true;
            // public randomness → encrypted winning ticket, uniform in [0, totalWeight)
            uint32 r = uint32(uint256(keccak256(abi.encodePacked(roundId, revealedSeed))));
            _drawTarget = FHE.div(FHE.mul(_totalWeight, uint128(r)), TWO_POW_32);
            FHE.allowThis(_drawTarget);
        }
        emit TallyProgress(roundId, tallyCursor, tallyComplete);
    }

    /// @notice Pass 2 — walk the encrypted prefix over the tallied weights and flag the one winner.
    function runDraw(uint256 count) external {
        if (phase != Phase.Revealed) revert WrongPhase();
        if (!tallyComplete) revert TallyNotComplete();
        if (drawComplete) revert AlreadyComplete();

        uint256 end = drawCursor + count;
        if (end > _participants.length) end = _participants.length;

        euint128 prefix = _drawPrefix;
        euint128 target = _drawTarget;
        for (uint256 i = drawCursor; i < end; i++) {
            address u = _participants[i];
            euint128 upper = FHE.add(prefix, _weight[roundId][u]);
            ebool won = FHE.and(FHE.le(prefix, target), FHE.lt(target, upper));
            _won[roundId][u] = won;
            FHE.allowThis(won);
            FHE.allow(won, u);
            prefix = upper;
        }
        _drawPrefix = prefix;
        FHE.allowThis(_drawPrefix);
        drawCursor = end;
        drawComplete = end == _participants.length;
        emit DrawProgress(roundId, drawCursor, drawComplete);
    }

    function closeRound() external {
        if (phase == Phase.Committed) {
            if (block.timestamp <= revealDeadline) revert RevealWindowStillOpen();
        } else if (phase != Phase.Revealed) {
            revert WrongPhase();
        } else {
            if (msg.sender != owner()) revert RevealWindowStillOpen();
            jackpot = 0;
        }
        phase = Phase.Open;
        roundId += 1;
        windowStart = block.timestamp; // new accrual window
        commitTime = 0;
        emit RoundClosed(roundId - 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                  Claim (winner payout)
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function claim() external nonReentrant {
        if (phase != Phase.Revealed) revert WrongPhase();
        if (!drawComplete) revert DrawNotComplete();
        if (claimed[roundId][msg.sender]) revert AlreadyClaimed();
        claimed[roundId][msg.sender] = true;

        _syncTwab(msg.sender); // keep the TWAB integral consistent before crediting the prize
        euint64 credit = FHE.select(_won[roundId][msg.sender], FHE.asEuint64(jackpot), FHE.asEuint64(0));
        euint64 bal = FHE.add(_balance[msg.sender], credit);
        euint64 tot = FHE.add(_total, credit);
        _balance[msg.sender] = bal;
        _total = tot;
        FHE.allowThis(bal);
        FHE.allow(bal, msg.sender);
        FHE.allowThis(tot);
        emit Claimed(roundId, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                      Withdraw
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function withdraw(externalEuint64 encAmount, bytes calldata proof) external nonReentrant {
        _syncTwab(msg.sender); // accrue at OLD balance before it drops
        euint64 requested = FHE.fromExternal(encAmount, proof);
        euint64 amount = FHE.min(requested, _balance[msg.sender]);

        euint64 bal = FHE.sub(_balance[msg.sender], amount);
        euint64 tot = FHE.sub(_total, amount);
        _balance[msg.sender] = bal;
        _total = tot;
        FHE.allowThis(bal);
        FHE.allow(bal, msg.sender);
        FHE.allowThis(tot);

        FHE.allowTransient(amount, address(asset));
        asset.confidentialTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                   Views & disclosure
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function balanceOf(address user) external view returns (euint64) {
        return _balance[user];
    }

    function totalPooled() external view returns (euint64) {
        return _total;
    }

    function wonFlagOf(uint256 round, address user) external view returns (ebool) {
        return _won[round][user];
    }

    /// @notice A participant's time-weighted draw weight for `round` (encrypted; owner-decryptable).
    function weightOf(uint256 round, address user) external view returns (euint128) {
        return _weight[round][user];
    }

    function participantsCount() external view returns (uint256) {
        return _participants.length;
    }

    function participantAt(uint256 i) external view returns (address) {
        return _participants[i];
    }

    function disclosePublicTotal() external onlyOwner {
        FHE.makePubliclyDecryptable(_total);
        emit PublicTotalDisclosed();
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC7984Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
