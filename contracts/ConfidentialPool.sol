// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev The pool mints its own yield reserve through the cUSDT faucet (a testnet stand-in
///      for a real ERC-4626 yield adapter). Only the mint entrypoint is needed here.
interface IMintableConfidential {
    function faucet(uint64 amount) external returns (euint64);
}

/// @title  Àjọ — Confidential PoolTogether
/// @author KaJota (Zama Developer Program Mainnet Season 4)
/// @notice A no-loss prize-savings pool (a confidential PoolTogether) on the Zama FHEVM.
///         Everyone deposits ERC-7984 `cUSDT`; deposits, balances and winnings are encrypted
///         `euint64` and never leave ciphertext on-chain. Yield accrued on the pooled principal
///         funds a public **rollover jackpot**; each round a public, commit-revealed seed selects
///         **exactly one winner, weighted by encrypted deposit size** — the selection runs entirely
///         over ciphertext, yet anyone can re-derive the randomness and audit it. Only the winner
///         can decrypt their prize; principal is withdrawable at any time.
///
/// @dev    ── Single-winner draw (the crux) ─────────────────────────────────────────────────────
///         A public per-round random `r = uint64(keccak256(roundId, seed))` maps to an ENCRYPTED
///         target inside the pool:  `target = (r · drawTotal) / 2^64`  — uniform in `[0, drawTotal)`,
///         computed with public-scalar × ciphertext ops only (no ciphertext×ciphertext, no decrypt).
///         `runDraw` then walks the participants once, keeping an encrypted running prefix sum, and
///         flags the single account whose `[prefix, prefix+balance)` interval contains `target`:
///
///             won_i  =  (prefix_i ≤ target)  ∧  (target < prefix_i + balance_i)
///
///         Exactly one interval contains `target`, so exactly one winner — the cumulative model
///         PoolTogether V5 uses (`GenerationSoftware/pt-v5-prize-pool`), evaluated homomorphically.
///         The walk is paginated so a large pool can be drawn across several transactions.
///         Randomness is commit-reveal (public + auditable), not `FHE.randEuint64` (a ciphertext,
///         which would defeat public verifiability). Withdrawing during a live round forfeits your
///         slot; if the winning slot was vacated, the jackpot simply rolls over to the next round.
contract ConfidentialPool is ZamaEthereumConfig, IERC7984Receiver, IERC165, Ownable, ReentrancyGuard {
    /// @notice The ERC-7984 confidential asset accepted by the pool (cUSDT).
    IERC7984 public immutable asset;

    // ── Encrypted pool state ─────────────────────────────────────────────────────────────
    mapping(address => euint64) private _balance; // per-user encrypted principal (+ won prizes)
    euint64 private _total; // encrypted sum of all user balances
    address[] private _participants;
    mapping(address => bool) public isParticipant;

    // ── Public rollover jackpot (yield-funded) ───────────────────────────────────────────
    uint64 public jackpot; // accrued yield to be won this round; rolls over between draws

    // ── Draw round state machine ─────────────────────────────────────────────────────────
    enum Phase {
        Open, // deposits + withdrawals allowed, no active draw
        Committed, // seed committed, deposits frozen, withdrawals still allowed
        Revealed // seed revealed, draw running / claims open
    }

    Phase public phase;
    uint256 public roundId;
    bytes32 public seedCommitment;
    bytes32 public revealedSeed;
    uint256 public revealDeadline;

    euint64 private _drawTotal; // encrypted pool total, frozen at commit
    euint128 private _drawTarget; // encrypted winning ticket = (r · drawTotal) / 2^64
    euint128 private _drawPrefix; // encrypted running prefix sum during the paginated walk
    uint256 public drawCursor; // next participant index to process
    bool public drawComplete; // whole participant set has been walked

    mapping(uint256 => mapping(address => ebool)) private _won; // round → user → encrypted win flag
    mapping(uint256 => mapping(address => bool)) public claimed;

    uint128 private constant TWO_POW_64 = uint128(1) << 64;
    bytes32 private constant PRIZE_TAG = keccak256("PRIZE");

    // ── Events ───────────────────────────────────────────────────────────────────────────
    event Deposited(address indexed user);
    event ReserveFunded();
    event YieldHarvested(uint64 amount, uint64 jackpot);
    event RoundCommitted(uint256 indexed roundId, bytes32 commitment, uint64 jackpot, uint256 revealDeadline);
    event RoundRevealed(uint256 indexed roundId, bytes32 seed);
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
    error DrawNotComplete();
    error DrawAlreadyComplete();

    constructor(IERC7984 asset_) Ownable(msg.sender) {
        asset = asset_;
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                      Deposit
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// @notice ERC-7984 receiver hook — the pool is credited when a user calls
    ///         `cUSDT.confidentialTransferAndCall(pool, amount, proof, data)`.
    /// @dev    `data == "PRIZE"` from the owner funds the reserve without crediting any user;
    ///         otherwise the transferred (already ACL-granted) `amount` is added to the sender's
    ///         encrypted balance. Reverts if a draw is in progress (deposits frozen).
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

    /// @dev An encrypted `true`, ACL-granted to this contract (required by the ERC-7984
    ///      receiver check) and transiently to the calling asset (used in its refund `select`).
    function _accept() private returns (ebool ok) {
        ok = FHE.asEbool(true);
        FHE.allowThis(ok);
        FHE.allowTransient(ok, msg.sender);
    }

    function _credit(address user, euint64 amount) private {
        if (!isParticipant[user]) {
            isParticipant[user] = true;
            _participants.push(user);
        }
        euint64 bal = FHE.add(_balance[user], amount);
        euint64 tot = FHE.add(_total, amount);
        _balance[user] = bal;
        _total = tot;
        FHE.allowThis(bal);
        FHE.allow(bal, user);
        FHE.allowThis(tot);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                    Yield → jackpot
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// @notice Harvest `amount` of yield into the prize reserve and grow the public jackpot.
    /// @dev    Testnet stand-in for an ERC-4626 yield adapter: the keeper computes
    ///         `amount = TVL · APR · Δt` off-chain and calls this; the pool mints the matching
    ///         cUSDT reserve so every jackpot unit is fully backed. The jackpot **rolls over** —
    ///         the longer between draws, the larger it grows.
    function harvestYield(uint64 amount) external onlyOwner {
        IMintableConfidential(address(asset)).faucet(amount); // reserve minted to the pool
        jackpot += amount;
        emit YieldHarvested(amount, jackpot);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                    Round lifecycle
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// @notice Open a draw round: commit to a hidden seed. Freezes `_drawTotal` and deposits.
    function commitRound(bytes32 commitment, uint256 revealWindow) external onlyOwner {
        if (phase != Phase.Open) revert WrongPhase();
        if (_participants.length == 0 || jackpot == 0) revert EmptyPool();
        seedCommitment = commitment;
        _drawTotal = _total;
        FHE.allowThis(_drawTotal);
        _drawPrefix = FHE.asEuint128(0);
        FHE.allowThis(_drawPrefix);
        drawCursor = 0;
        drawComplete = false;
        revealDeadline = block.timestamp + revealWindow;
        phase = Phase.Committed;
        emit RoundCommitted(roundId, commitment, jackpot, revealDeadline);
    }

    /// @notice Reveal the committed seed. Derives the encrypted winning ticket `target`.
    function revealSeed(bytes32 seed) external onlyOwner {
        if (phase != Phase.Committed) revert WrongPhase();
        if (keccak256(abi.encodePacked(seed)) != seedCommitment) revert BadReveal();
        revealedSeed = seed;

        // Public randomness → encrypted winning ticket, uniform in [0, drawTotal).
        uint64 r = uint64(uint256(keccak256(abi.encodePacked(roundId, seed))));
        euint128 target = FHE.div(FHE.mul(FHE.asEuint128(_drawTotal), uint128(r)), TWO_POW_64);
        _drawTarget = target;
        FHE.allowThis(_drawTarget);

        phase = Phase.Revealed;
        emit RoundRevealed(roundId, seed);
    }

    /// @notice Walk up to `count` participants of the current draw, flagging the winner.
    /// @dev    Paginated so a large pool can be drawn across several transactions. Each step
    ///         evaluates `won_i = (prefix ≤ target) ∧ (target < prefix + balance_i)` over
    ///         ciphertext and advances the encrypted running prefix.
    function runDraw(uint256 count) external {
        if (phase != Phase.Revealed) revert WrongPhase();
        if (drawComplete) revert DrawAlreadyComplete();

        uint256 end = drawCursor + count;
        if (end > _participants.length) end = _participants.length;

        euint128 prefix = _drawPrefix;
        euint128 target = _drawTarget;
        for (uint256 i = drawCursor; i < end; i++) {
            address user = _participants[i];
            euint128 bal = FHE.asEuint128(_balance[user]);
            euint128 upper = FHE.add(prefix, bal);
            ebool won = FHE.and(FHE.le(prefix, target), FHE.lt(target, upper));
            _won[roundId][user] = won;
            FHE.allowThis(won);
            FHE.allow(won, user);
            prefix = upper;
        }
        _drawPrefix = prefix;
        FHE.allowThis(_drawPrefix);
        drawCursor = end;
        drawComplete = end == _participants.length;
        emit DrawProgress(roundId, drawCursor, drawComplete);
    }

    /// @notice Close the round and reopen deposits. Resets the jackpot (a winner has taken it).
    /// @dev    Owner after a completed draw, or anyone once the reveal window lapses without a
    ///         reveal (liveness escape hatch — a non-revealing operator cannot lock funds).
    function closeRound() external {
        if (phase == Phase.Committed) {
            if (block.timestamp <= revealDeadline) revert RevealWindowStillOpen();
        } else if (phase != Phase.Revealed) {
            revert WrongPhase();
        } else {
            if (msg.sender != owner()) revert RevealWindowStillOpen();
            jackpot = 0; // the round's winner has claimed it; fresh yield accrues next cycle
        }
        phase = Phase.Open;
        roundId += 1;
        emit RoundClosed(roundId - 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //                                  Claim (winner payout)
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// @notice Claim the current round: credit the jackpot to your balance iff you are the winner.
    /// @dev    O(1) — the win flag was computed in `runDraw`. Branchless: winner gets `jackpot`,
    ///         everyone else an encrypted 0. Reveal your balance client-side to see if you won.
    function claim() external nonReentrant {
        if (phase != Phase.Revealed) revert WrongPhase();
        if (!drawComplete) revert DrawNotComplete();
        if (claimed[roundId][msg.sender]) revert AlreadyClaimed();
        claimed[roundId][msg.sender] = true;

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

    /// @notice Withdraw up to your full encrypted balance at any time (no-loss principal).
    /// @dev    `FHE.min` clamps an over-withdraw to the balance — never reverts, never leaks
    ///         whether you had enough. Withdrawing during a live round forfeits your draw slot.
    function withdraw(externalEuint64 encAmount, bytes calldata proof) external nonReentrant {
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

    function participantsCount() external view returns (uint256) {
        return _participants.length;
    }

    function participantAt(uint256 i) external view returns (address) {
        return _participants[i];
    }

    /// @notice Opt-in reveal of the AGGREGATE pool size as a public marketing metric, while every
    ///         per-user contribution stays encrypted.
    function disclosePublicTotal() external onlyOwner {
        FHE.makePubliclyDecryptable(_total);
        emit PublicTotalDisclosed();
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC7984Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
