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

/// @title  Confidential Tontine — a survivorship pool (Lorenzo de Tonti, 1653)
/// @author KaJota (Zama Developer Program — Mainnet Season 4)
/// @notice The third, boldest way to run a confidential pool. In a tontine, members pool money and
///         share the yield; each time a member *exits*, their future share redistributes to the
///         survivors — so the dividend **grows as the group shrinks**, rewarding those who stay. It
///         was a favourite of European monarchs, then **banned after 1905** (the Armstrong
///         Investigation) for opacity and mismanagement — the very failure FHE fixes: keep each
///         member's principal private while the survivor dividend accrues on-chain and auditably.
///
/// @dev    Each account's principal is an encrypted `euint64` (private). Yield is split **equally
///         among the currently-active members** — `perShare = amount / activeCount` — and accumulated
///         into a public `accDividend` running total. A member's entitlement is the growth in
///         `accDividend` over the periods they were active (`accDividend − lastAcc[user]`), folded
///         into their encrypted balance on `syncDividend`. Because `activeCount` shrinks on `exit`,
///         each later `perShare` is larger — the survivor dividend. The per-survivor *rate* is public
///         (a fair, auditable number); only the *balances* stay encrypted.
contract ConfidentialTontine is ZamaEthereumConfig, IERC7984Receiver, IERC165, Ownable, ReentrancyGuard {
    IERC7984 public immutable asset;

    mapping(address => euint64) private _balance;
    euint64 private _total;
    address[] private _members;
    mapping(address => bool) public isMember;

    // ── Survivorship ───────────────────────────────────────────────────────────────────────
    mapping(address => bool) public active;
    uint256 public activeCount;
    uint64 public accDividend; // running sum of per-survivor shares
    mapping(address => uint64) public lastAcc; // accDividend when the member last synced
    uint64 public totalDistributed;

    bytes32 private constant PRIZE_TAG = keccak256("PRIZE");

    event Deposited(address indexed user);
    event ReserveFunded();
    event DividendPaid(uint64 amount, uint256 activeCount, uint64 perShare, uint64 accDividend);
    event DividendSynced(address indexed user, uint64 owed);
    event Exited(address indexed user, uint256 activeCount);
    event Withdrawn(address indexed user);

    error NotAsset();
    error NoSurvivors();
    error NotActive();

    constructor(IERC7984 asset_) Ownable(msg.sender) {
        asset = asset_;
    }

    // ── Deposit (join the tontine) ─────────────────────────────────────────────────────────
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
        if (!active[user]) {
            active[user] = true;
            activeCount += 1;
            lastAcc[user] = accDividend; // no claim on dividends paid before joining
        }
        euint64 bal = FHE.add(_balance[user], amount);
        _balance[user] = bal;
        _total = FHE.add(_total, amount);
        FHE.allowThis(bal);
        FHE.allow(bal, user);
        FHE.allowThis(_total);
    }

    // ── Yield → survivor dividend ──────────────────────────────────────────────────────────
    /// @notice Mint yield and split it equally among the current survivors. As members exit,
    ///         `activeCount` falls and each later per-survivor share grows.
    function payDividend(uint64 amount) external onlyOwner {
        if (activeCount == 0) revert NoSurvivors();
        IMintableConfidential(address(asset)).faucet(amount);
        uint64 perShare = amount / uint64(activeCount);
        accDividend += perShare;
        totalDistributed += perShare * uint64(activeCount);
        emit DividendPaid(amount, activeCount, perShare, accDividend);
    }

    /// @notice Fold your accrued survivor dividend into your (encrypted) balance.
    function syncDividend() external {
        _sync(msg.sender);
    }

    function _sync(address u) private {
        if (!active[u]) return;
        uint64 owed = accDividend - lastAcc[u];
        if (owed > 0) {
            euint64 bal = FHE.add(_balance[u], FHE.asEuint64(owed));
            _balance[u] = bal;
            _total = FHE.add(_total, FHE.asEuint64(owed));
            FHE.allowThis(bal);
            FHE.allow(bal, u);
            FHE.allowThis(_total);
        }
        lastAcc[u] = accDividend;
        emit DividendSynced(u, owed);
    }

    /// @notice Leave the tontine: bank your accrued dividend, then stop receiving future ones — so
    ///         the remaining survivors' share grows. Your principal stays and is withdrawable.
    function exit() external {
        if (!active[msg.sender]) revert NotActive();
        _sync(msg.sender);
        active[msg.sender] = false;
        activeCount -= 1;
        emit Exited(msg.sender, activeCount);
    }

    // ── Withdraw principal (+ banked dividends) ────────────────────────────────────────────
    function withdraw(externalEuint64 encAmount, bytes calldata proof) external nonReentrant {
        _sync(msg.sender); // bank dividends first so nothing is left behind
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
    function pendingDividend(address user) external view returns (uint64) {
        return active[user] ? accDividend - lastAcc[user] : 0;
    }
    function membersCount() external view returns (uint256) {
        return _members.length;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC7984Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
