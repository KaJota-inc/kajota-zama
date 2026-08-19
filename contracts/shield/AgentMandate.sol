// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {FraudOracle} from "./FraudOracle.sol";

/// @title  Kajota Shield — Agent Payment Mandate
/// @notice A principal gives an autonomous agent a CONFIDENTIAL, bounded spending mandate: an
///         encrypted total cap, a merchant allow-list, a velocity limit, an expiry — and a kill
///         switch. Every agent-initiated spend is, in one transaction, checked against the private
///         mandate AND screened against the shared {FraudOracle}, then EXECUTED as a confidential
///         ERC-7984 transfer — all over ciphertext. A spend that is over-budget OR to a
///         network-flagged counterparty moves EXACTLY ZERO: it never reverts, never reveals the
///         budget, and a hijacked or prompt-injected agent simply cannot move money outside its
///         mandate.
/// @dev    The safety rails autonomous payments were missing in 2026: deterministic enforcement
///         (fail-closed), a shared-but-private fraud signal, and a human kill switch. The mandate
///         must be an ERC-7984 operator for the principal (principal calls `asset.setOperator`).
contract AgentMandate is ZamaEthereumConfig {
    struct Mandate {
        address principal;
        euint64 cap; // encrypted total spend cap
        euint64 spent; // encrypted running total actually spent
        uint48 expiry;
        uint32 window; // velocity window (seconds)
        uint32 maxPerWindow;
        uint32 windowStart;
        uint32 countInWindow;
        bool active;
        bool paused;
    }

    FraudOracle public immutable oracle;
    IERC7984 public immutable asset; // confidential payment rail (cUSDT)
    uint64 public riskThreshold; // network risk score at/above which a counterparty is blocked

    mapping(address => Mandate) private _m; // agent => mandate
    mapping(address => mapping(address => bool)) public merchantAllowed; // agent => merchant => ok
    mapping(address => euint64) private _lastApplied; // most recent amount actually moved
    mapping(address => address) public guardianOf; // agent => anomaly monitor allowed to pause

    event AgentRegistered(address indexed agent, address indexed principal, uint48 expiry);
    event MerchantSet(address indexed agent, address indexed merchant, bool allowed);
    event GuardianSet(address indexed agent, address indexed guardian);
    event Paused(address indexed agent, bool paused, address by, string reason);
    event Spend(address indexed agent, address indexed merchant); // amount is encrypted

    error NotPrincipal();
    error NotGuardian();
    error Inactive();
    error IsPaused();
    error Expired();
    error MerchantNotAllowed();
    error VelocityExceeded();

    constructor(FraudOracle oracle_, IERC7984 asset_, uint64 riskThreshold_) {
        oracle = oracle_;
        asset = asset_;
        riskThreshold = riskThreshold_;
    }

    /// @dev The oracle identifier for a counterparty address.
    function merchantId(address merchant) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(merchant));
    }

    // ── principal controls ─────────────────────────────────────────────────────────────────
    function registerAgent(
        address agent,
        externalEuint64 cap,
        bytes calldata proof,
        uint48 expiry,
        uint32 window,
        uint32 maxPerWindow
    ) external {
        Mandate storage m = _m[agent];
        m.principal = msg.sender;
        m.cap = FHE.fromExternal(cap, proof);
        m.spent = FHE.asEuint64(0);
        m.expiry = expiry;
        m.window = window;
        m.maxPerWindow = maxPerWindow;
        m.windowStart = uint32(block.timestamp);
        m.countInWindow = 0;
        m.active = true;
        m.paused = false;
        FHE.allowThis(m.cap);
        FHE.allow(m.cap, msg.sender);
        FHE.allowThis(m.spent);
        FHE.allow(m.spent, msg.sender);
        emit AgentRegistered(agent, msg.sender, expiry);
    }

    function setMerchant(address agent, address merchant, bool allowed) external {
        if (_m[agent].principal != msg.sender) revert NotPrincipal();
        merchantAllowed[agent][merchant] = allowed;
        emit MerchantSet(agent, merchant, allowed);
    }

    /// @notice Appoint an off-chain anomaly monitor that may pause (but never un-pause) this agent.
    function setGuardian(address agent, address guardian) external {
        if (_m[agent].principal != msg.sender) revert NotPrincipal();
        guardianOf[agent] = guardian;
        emit GuardianSet(agent, guardian);
    }

    /// @notice Kill switch. The principal may pause or resume with any reason; the appointed
    ///         guardian (anomaly monitor) may only PAUSE — deterministic detection trips the switch,
    ///         a human decides whether to resume.
    function setPaused(address agent, bool p, string calldata reason) external {
        Mandate storage m = _m[agent];
        bool isPrincipal = m.principal == msg.sender;
        bool guardianTrip = p && guardianOf[agent] == msg.sender;
        if (!isPrincipal && !guardianTrip) revert NotGuardian();
        m.paused = p;
        emit Paused(agent, p, msg.sender, reason);
    }

    // ── the guarded, executed spend ────────────────────────────────────────────────────────
    /// @notice The agent (msg.sender) pays `amount` to `merchant`. In one confidential transaction:
    ///         checks the encrypted mandate, screens the shared fraud oracle, clamps the amount
    ///         fail-closed, and moves the authorised amount as an ERC-7984 transfer from the
    ///         principal to the merchant. Over-budget or network-flagged → moves exactly 0.
    /// @return applied the encrypted amount actually paid.
    function checkAndSpend(
        address merchant,
        externalEuint64 amount,
        bytes calldata proof
    ) external returns (euint64 applied) {
        Mandate storage m = _m[msg.sender];
        if (!m.active) revert Inactive();
        if (m.paused) revert IsPaused();
        if (block.timestamp >= m.expiry) revert Expired();
        if (!merchantAllowed[msg.sender][merchant]) revert MerchantNotAllowed();

        // velocity — public policy, not secret
        if (block.timestamp >= uint256(m.windowStart) + m.window) {
            m.windowStart = uint32(block.timestamp);
            m.countInWindow = 0;
        }
        if (uint256(m.countInWindow) + 1 > m.maxPerWindow) revert VelocityExceeded();
        m.countInWindow += 1;

        euint64 amt = FHE.fromExternal(amount, proof);

        // A · mandate: does this keep the agent within its encrypted cap?
        ebool within = FHE.le(FHE.add(m.spent, amt), m.cap);
        // B · oracle: is the counterparty below the network risk threshold?
        ebool risky = oracle.riskFlag(merchantId(merchant), riskThreshold);
        ebool ok = FHE.and(within, FHE.not(risky));

        // fail-closed clamp — over-budget or risky authorises exactly 0
        applied = FHE.select(ok, amt, FHE.asEuint64(0));
        m.spent = FHE.add(m.spent, applied);
        _lastApplied[msg.sender] = applied;

        FHE.allowThis(m.spent);
        FHE.allow(m.spent, m.principal);
        FHE.allowThis(applied);
        FHE.allow(applied, msg.sender);
        FHE.allow(applied, m.principal);

        // execute the confidential payment: principal → merchant, exactly `applied`
        FHE.allowTransient(applied, address(asset));
        asset.confidentialTransferFrom(m.principal, merchant, applied);

        emit Spend(msg.sender, merchant);
    }

    // ── views ──────────────────────────────────────────────────────────────────────────────
    function spentOf(address agent) external view returns (euint64) {
        return _m[agent].spent;
    }
    function capOf(address agent) external view returns (euint64) {
        return _m[agent].cap;
    }
    function lastAppliedOf(address agent) external view returns (euint64) {
        return _lastApplied[agent];
    }
    function mandateMeta(
        address agent
    ) external view returns (address principal, uint48 expiry, uint32 maxPerWindow, bool active, bool paused) {
        Mandate storage m = _m[agent];
        return (m.principal, m.expiry, m.maxPerWindow, m.active, m.paused);
    }
}
