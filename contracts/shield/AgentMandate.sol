// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FraudOracle} from "./FraudOracle.sol";

/// @title  Kajota Shield — Agent Payment Mandate
/// @notice A principal gives an autonomous agent a CONFIDENTIAL, bounded spending mandate: an
///         encrypted total cap, a merchant allow-list, a velocity limit, an expiry — and a kill
///         switch. Every agent-initiated spend is, in one transaction, checked against the private
///         mandate AND screened against the shared {FraudOracle}, entirely over ciphertext: a spend
///         that is over-budget OR to a network-flagged counterparty is authorised for EXACTLY ZERO —
///         it never reverts, and never reveals the budget. A hijacked or prompt-injected agent
///         simply cannot move money outside its mandate.
/// @dev    The safety rails autonomous payments were missing in 2026: deterministic enforcement
///         (fail-closed), a shared-but-private fraud signal, and a human kill switch — the object
///         being protected (the agent payment) is the same across mandate (A) and oracle (B), and
///         the confidential-compute engine is what makes both private.
contract AgentMandate is ZamaEthereumConfig {
    struct Mandate {
        address principal;
        euint64 cap; // encrypted total spend cap
        euint64 spent; // encrypted running total actually authorised
        uint48 expiry;
        uint32 window; // velocity window (seconds)
        uint32 maxPerWindow;
        uint32 windowStart;
        uint32 countInWindow;
        bool active;
        bool paused;
    }

    FraudOracle public immutable oracle;
    uint64 public riskThreshold; // network risk score at/above which a counterparty is blocked

    mapping(address => Mandate) private _m; // agent => mandate
    mapping(address => mapping(bytes32 => bool)) public merchantAllowed; // agent => merchant => ok
    mapping(address => euint64) private _lastApplied; // most recent authorised amount (rail reads this)

    event AgentRegistered(address indexed agent, address indexed principal, uint48 expiry);
    event MerchantSet(address indexed agent, bytes32 indexed merchant, bool allowed);
    event Paused(address indexed agent, bool paused);
    event Spend(address indexed agent, bytes32 indexed merchant); // amount is encrypted

    error NotPrincipal();
    error Inactive();
    error IsPaused();
    error Expired();
    error MerchantNotAllowed();
    error VelocityExceeded();

    constructor(FraudOracle oracle_, uint64 riskThreshold_) {
        oracle = oracle_;
        riskThreshold = riskThreshold_;
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

    function setMerchant(address agent, bytes32 merchant, bool allowed) external {
        if (_m[agent].principal != msg.sender) revert NotPrincipal();
        merchantAllowed[agent][merchant] = allowed;
        emit MerchantSet(agent, merchant, allowed);
    }

    /// @notice Kill switch — the principal (or an off-chain anomaly monitor they authorise) can
    ///         freeze the agent instantly.
    function setPaused(address agent, bool p) external {
        if (_m[agent].principal != msg.sender) revert NotPrincipal();
        _m[agent].paused = p;
        emit Paused(agent, p);
    }

    // ── the guarded spend ──────────────────────────────────────────────────────────────────
    /// @notice The agent (msg.sender) requests to spend `amount` at `merchant`. Returns the
    ///         encrypted amount actually authorised: `amount` if within the mandate AND the merchant
    ///         is not network-flagged, otherwise an encrypted 0. Plaintext guards (paused, expiry,
    ///         allow-list, velocity) are public policy and revert; the amount check is confidential.
    function checkAndSpend(
        bytes32 merchant,
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
        ebool risky = oracle.riskFlag(merchant, riskThreshold);
        ebool ok = FHE.and(within, FHE.not(risky));

        // fail-closed clamp — over-budget or risky authorises exactly 0, no revert, no leak
        applied = FHE.select(ok, amt, FHE.asEuint64(0));
        m.spent = FHE.add(m.spent, applied);
        _lastApplied[msg.sender] = applied;

        FHE.allowThis(m.spent);
        FHE.allow(m.spent, m.principal);
        FHE.allowThis(applied);
        FHE.allow(applied, msg.sender);
        FHE.allow(applied, m.principal);
        emit Spend(msg.sender, merchant);
    }

    /// @notice The encrypted amount authorised by the most recent {checkAndSpend} for `agent` —
    ///         what a confidential payment rail actually moves (0 if the last attempt was blocked).
    function lastAppliedOf(address agent) external view returns (euint64) {
        return _lastApplied[agent];
    }

    // ── views ──────────────────────────────────────────────────────────────────────────────
    function spentOf(address agent) external view returns (euint64) {
        return _m[agent].spent;
    }
    function capOf(address agent) external view returns (euint64) {
        return _m[agent].cap;
    }
    function mandateMeta(
        address agent
    ) external view returns (address principal, uint48 expiry, uint32 maxPerWindow, bool active, bool paused) {
        Mandate storage m = _m[agent];
        return (m.principal, m.expiry, m.maxPerWindow, m.active, m.paused);
    }
}
