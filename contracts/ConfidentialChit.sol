// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableConfidential {
    function faucet(uint64 amount) external returns (euint64);
}

/// @title  Confidential Chit Fund — a sealed-bid rotating pool (the "bidding hui")
/// @author KaJota (Zama Developer Program — Mainnet Season 4)
/// @notice A second, older way to run a confidential pool, drawn from the bidding ROSCA / Indian
///         chit fund (a regulated market rooted in >1,000-year-old south-Indian practice). Instead
///         of a *random* draw, each round runs a **sealed-bid auction**: members submit an encrypted
///         bid — the discount they will accept to take the pot *now* — and the highest bidder wins.
///         The discount they forgo is split among everyone else, so patient savers earn what urgent
///         members pay for early liquidity.
///
/// @dev    A sealed-bid auction is the canonical "compute a winner over secret inputs" problem — the
///         thing FHE is uniquely for. Bids never leave ciphertext; the winner is flagged over
///         ciphertext with the same two-pass, single-winner structure as the base pool:
///           Pass 1 `tallyBids`: walk bidders, accumulate the encrypted `maxBid`.
///           Pass 2 `settle`:    walk again, flag the *first* bidder equal to `maxBid` (carry-based),
///                               so exactly one winner — over ciphertext, no decryption.
///         On `claim`, the winner is credited `pot − bid` and every other bidder `bid / (K−1)` (the
///         shared discount), all folded into encrypted balances via `FHE.select`. Bids are clamped
///         to the pot with `FHE.min`, so an over-bid silently caps instead of reverting.
contract ConfidentialChit is ZamaEthereumConfig, IERC7984Receiver, IERC165, Ownable, ReentrancyGuard {
    IERC7984 public immutable asset;

    // ── Encrypted book ───────────────────────────────────────────────────────────────────
    mapping(address => euint64) private _balance;
    euint64 private _total;
    address[] private _members;
    mapping(address => bool) public isMember;

    // ── Public pot (yield-funded) ────────────────────────────────────────────────────────
    uint64 public pot;

    // ── Sealed-bid round state ───────────────────────────────────────────────────────────
    enum Phase {
        Open,
        Bidding,
        Settled
    }
    Phase public phase;
    uint256 public roundId;

    address[] private _bidders; // bidders this round
    mapping(uint256 => mapping(address => bool)) public hasBid;
    mapping(uint256 => mapping(address => euint64)) private _bid; // round → bidder → encrypted bid
    mapping(uint256 => mapping(address => ebool)) private _won;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => uint256) public roundBidderCount; // frozen at settle, for the discount split

    euint64 private _maxBid; // running max over ciphertext
    ebool private _notFlagged; // carry: winner not yet flagged
    euint64 private _winningBid; // the winning (max) bid, captured at settle
    uint256 public tallyCursor;
    bool public tallyComplete;
    uint256 public settleCursor;
    bool public settleComplete;

    bytes32 private constant PRIZE_TAG = keccak256("PRIZE");

    event Deposited(address indexed user);
    event ReserveFunded();
    event PotFunded(uint64 amount, uint64 pot);
    event BiddingOpened(uint256 indexed roundId, uint64 pot);
    event BidSubmitted(uint256 indexed roundId, address indexed bidder);
    event TallyProgress(uint256 indexed roundId, uint256 cursor, bool complete);
    event Settled(uint256 indexed roundId, uint256 cursor, bool complete);
    event Claimed(uint256 indexed roundId, address indexed user);
    event Withdrawn(address indexed user);

    error NotAsset();
    error WrongPhase();
    error NotBidding();
    error AlreadyBid();
    error NotMember();
    error EmptyRound();
    error TallyNotComplete();
    error AlreadyComplete();
    error AlreadyClaimed();

    constructor(IERC7984 asset_) Ownable(msg.sender) {
        asset = asset_;
    }

    // ── Deposit ──────────────────────────────────────────────────────────────────────────
    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata data
    ) external override returns (ebool) {
        if (msg.sender != address(asset)) revert NotAsset();
        if (from == owner() && keccak256(data) == PRIZE_TAG) {
            emit ReserveFunded();
            return _accept();
        }
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
        if (!isMember[user]) {
            isMember[user] = true;
            _members.push(user);
        }
        euint64 bal = FHE.add(_balance[user], amount);
        _balance[user] = bal;
        _total = FHE.add(_total, amount);
        FHE.allowThis(bal);
        FHE.allow(bal, user);
        FHE.allowThis(_total);
    }

    // ── Yield → pot ──────────────────────────────────────────────────────────────────────
    function fundPot(uint64 amount) external onlyOwner {
        IMintableConfidential(address(asset)).faucet(amount);
        pot += amount;
        emit PotFunded(amount, pot);
    }

    // ── Sealed-bid round ───────────────────────────────────────────────────────────────────
    function openBidding() external onlyOwner {
        if (phase == Phase.Bidding) revert WrongPhase();
        if (pot == 0) revert EmptyRound();
        phase = Phase.Bidding;
        delete _bidders;
        _maxBid = FHE.asEuint64(0);
        _notFlagged = FHE.asEbool(true);
        FHE.allowThis(_maxBid);
        FHE.allowThis(_notFlagged);
        tallyCursor = 0;
        tallyComplete = false;
        settleCursor = 0;
        settleComplete = false;
        emit BiddingOpened(roundId, pot);
    }

    /// @notice Submit a sealed (encrypted) bid — the discount you'll accept to take the pot now.
    ///         Clamped to the pot, so an over-bid caps silently.
    function submitBid(externalEuint64 encBid, bytes calldata proof) external {
        if (phase != Phase.Bidding) revert NotBidding();
        if (!isMember[msg.sender]) revert NotMember();
        if (hasBid[roundId][msg.sender]) revert AlreadyBid();
        euint64 bid = FHE.min(FHE.fromExternal(encBid, proof), FHE.asEuint64(pot));
        _bid[roundId][msg.sender] = bid;
        FHE.allowThis(bid);
        FHE.allow(bid, msg.sender);
        hasBid[roundId][msg.sender] = true;
        _bidders.push(msg.sender);
        emit BidSubmitted(roundId, msg.sender);
    }

    /// @notice Pass 1 — walk bidders and accumulate the encrypted `maxBid`. Paginated (one bidder
    ///         per tx keeps well under the FHEVM HCU depth limit).
    function tallyBids(uint256 count) external {
        if (phase != Phase.Bidding) revert NotBidding();
        if (tallyComplete) revert AlreadyComplete();
        uint256 end = tallyCursor + count;
        if (end > _bidders.length) end = _bidders.length;
        euint64 mx = _maxBid;
        for (uint256 i = tallyCursor; i < end; i++) {
            euint64 b = _bid[roundId][_bidders[i]];
            mx = FHE.select(FHE.gt(b, mx), b, mx);
        }
        _maxBid = mx;
        FHE.allowThis(_maxBid);
        tallyCursor = end;
        if (end == _bidders.length) {
            tallyComplete = true;
            _winningBid = _maxBid;
            FHE.allowThis(_winningBid);
            FHE.makePubliclyDecryptable(_winningBid); // announce the clearing price, not who bid what
        }
        emit TallyProgress(roundId, tallyCursor, tallyComplete);
    }

    /// @notice Pass 2 — flag the single winner (first bidder whose bid equals `maxBid`) over
    ///         ciphertext, using a carry so exactly one is chosen. Paginated.
    function settle(uint256 count) external {
        if (!tallyComplete) revert TallyNotComplete();
        if (settleComplete) revert AlreadyComplete();
        uint256 end = settleCursor + count;
        if (end > _bidders.length) end = _bidders.length;
        ebool notFlagged = _notFlagged;
        for (uint256 i = settleCursor; i < end; i++) {
            address who = _bidders[i];
            ebool isMax = FHE.eq(_bid[roundId][who], _maxBid);
            ebool win = FHE.and(isMax, notFlagged);
            _won[roundId][who] = win;
            FHE.allowThis(win);
            FHE.allow(win, who);
            notFlagged = FHE.and(notFlagged, FHE.not(win));
        }
        _notFlagged = notFlagged;
        FHE.allowThis(_notFlagged);
        settleCursor = end;
        if (end == _bidders.length) {
            settleComplete = true;
            phase = Phase.Settled;
            roundBidderCount[roundId] = _bidders.length;
            roundId += 1;
        }
        emit Settled(roundId - (settleComplete ? 1 : 0), settleCursor, settleComplete);
    }

    /// @notice Claim your outcome for the settled round `r`: the winner receives `pot − bid`; every
    ///         other bidder receives an equal share of the winner's forgone discount, `bid / (K−1)`.
    function claim(uint256 r) external nonReentrant {
        if (r >= roundId) revert WrongPhase();
        if (!hasBid[r][msg.sender]) revert NotMember();
        if (claimed[r][msg.sender]) revert AlreadyClaimed();
        claimed[r][msg.sender] = true;

        uint256 k = roundBidderCount[r];
        euint64 potE = FHE.asEuint64(pot);
        euint64 winnerCredit = FHE.sub(potE, _bid[r][msg.sender]); // pot − your own (winning) bid
        // losers split the winner's discount; K−1 others (guard divide-by-zero with a floor of 1)
        uint64 others = k > 1 ? uint64(k - 1) : 1;
        euint64 loserCredit = FHE.div(_winningBid, others);
        euint64 credit = FHE.select(_won[r][msg.sender], winnerCredit, loserCredit);

        euint64 bal = FHE.add(_balance[msg.sender], credit);
        _balance[msg.sender] = bal;
        FHE.allowThis(bal);
        FHE.allow(bal, msg.sender);
        emit Claimed(r, msg.sender);
    }

    // ── Withdraw (no-loss principal) ───────────────────────────────────────────────────────
    function withdraw(externalEuint64 encAmount, bytes calldata proof) external nonReentrant {
        euint64 amount = FHE.min(FHE.fromExternal(encAmount, proof), _balance[msg.sender]);
        euint64 bal = FHE.sub(_balance[msg.sender], amount);
        _balance[msg.sender] = bal;
        _total = FHE.sub(_total, amount);
        FHE.allowThis(bal);
        FHE.allow(bal, msg.sender);
        FHE.allowThis(_total);
        FHE.allowTransient(amount, address(asset));
        asset.confidentialTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender);
    }

    // ── Views ──────────────────────────────────────────────────────────────────────────────
    function balanceOf(address user) external view returns (euint64) {
        return _balance[user];
    }
    function totalPooled() external view returns (euint64) {
        return _total;
    }
    function winningBid() external view returns (euint64) {
        return _winningBid;
    }
    function wonFlagOf(uint256 r, address user) external view returns (ebool) {
        return _won[r][user];
    }
    function membersCount() external view returns (uint256) {
        return _members.length;
    }
    function biddersCount() external view returns (uint256) {
        return _bidders.length;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC7984Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
