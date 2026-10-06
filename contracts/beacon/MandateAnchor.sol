// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  Payflow Mandate Beacon — CBN consumer-dispute mandate (replay-safe, SLA-anchored)
/// @notice A regulator-verifiable mandate registry. One Merkle-anchored proof per debit attempt:
///         timestamped lineage, dispute-SLA deadline (CBN CPR 2019, 24 hours), and a redacted
///         customer envelope hash. The idempotency key is server-derived from the request itself,
///         so a replay inside the TTL — the second-tap problem CBN's NIP mandate specification
///         does not address — is routed to human approval rather than auto-settled.
/// @dev    Plain Solidity, deliberately — regulator-verifiable chain wants PUBLIC audit, which is
///         orthogonal to the FHE/encrypted-mandate rail in {AgentMandate}. The role scaffolding
///         (bank, agent, guardian, kill-switch) mirrors Shield's pattern as a proven shape; the
///         state is public bytes32 identifiers and uint64 money/time scalars. PII is kept off-chain;
///         the redacted-envelope hash is the only customer identifier the chain sees.
contract MandateAnchor {
    enum Status { None, Posted, Settled, Breached, DuplicateRouted }

    struct Mandate {
        address bank;
        bytes32 idempotencyKey;      // server-derived: sha256(canonicalMandate ‖ amount ‖ creTickBucket)
        uint64 amount;               // minor units, PII-redacted customer envelope lives off-chain
        uint64 postedAt;             // seconds (block.timestamp cast)
        uint64 deadline;             // postedAt + CBN CPR 2019 window (24h = 86400s)
        bytes32 envelopeHash;        // sha256 of the redacted customer envelope
        bytes32 sanctionsListVersion; // pinned list snapshot at ingest; re-verify never follows "current"
        Status status;
        uint8 occurrence;            // server-assigned; a client-authored value is overwritten
    }

    // ── roles & kill-switch (mirrors AgentMandate.sol pattern) ───────────────────────────────
    address public immutable owner;              // the Beacon operator (eg a regtech ops team)
    mapping(address => bool) public banks;       // allow-listed posting banks
    mapping(address => address) public guardianOf; // bank => anomaly monitor allowed to pause
    mapping(address => bool) public paused;      // kill-switch per bank

    // ── mandate state ────────────────────────────────────────────────────────────────────────
    mapping(bytes32 => Mandate) private _m;      // mandateId => mandate
    mapping(bytes32 => uint8)   public occurrenceOf; // idempotencyKey => highest occurrence seen
    mapping(bytes32 => bytes32) public settlementOf; // mandateId => reversalRef (if any)

    // ── SLA window (CBN CPR 2019, 24 hours) ──────────────────────────────────────────────────
    uint64 public immutable slaWindow;

    // ── events ───────────────────────────────────────────────────────────────────────────────
    event BankAllowed(address indexed bank, bool allowed);
    event GuardianSet(address indexed bank, address indexed guardian);
    event Paused(address indexed bank, bool paused, address by, string reason);

    event MandatePosted(
        bytes32 indexed mandateId,
        address indexed bank,
        bytes32 idempotencyKey,
        uint64 amount,
        uint64 deadline,
        uint8 occurrence,
        bytes32 sanctionsListVersion
    );
    event MandateSettled(bytes32 indexed mandateId, bytes32 reversalRef, uint64 settledAt);
    event SLABreached(bytes32 indexed mandateId, uint64 deadline, uint64 observedAt);
    event DuplicateRouted(
        bytes32 indexed mandateId,
        bytes32 indexed idempotencyKey,
        uint8 occurrence,
        string reason
    );

    // ── errors ───────────────────────────────────────────────────────────────────────────────
    error NotOwner();
    error NotBank();
    error NotGuardian();
    error BankNotAllowed();
    error IsPaused();
    error ZeroDeadline();
    error ZeroIdempotencyKey();
    error ZeroSanctionsListVersion();
    error UnknownMandate();
    error AlreadySettled();
    error NotYetBreached();
    error AlreadyBreached();

    constructor(uint64 slaWindowSeconds) {
        owner = msg.sender;
        slaWindow = slaWindowSeconds; // CBN CPR 2019 default: 86400
    }

    // ── owner / bank / guardian plumbing ─────────────────────────────────────────────────────
    function allowBank(address bank, bool allowed) external {
        if (msg.sender != owner) revert NotOwner();
        banks[bank] = allowed;
        emit BankAllowed(bank, allowed);
    }

    function setGuardian(address bank, address guardian) external {
        if (msg.sender != bank) revert NotBank();
        guardianOf[bank] = guardian;
        emit GuardianSet(bank, guardian);
    }

    /// @notice Kill switch. The bank may pause or resume with any reason; the appointed guardian
    ///         (anomaly monitor) may only PAUSE — deterministic detection trips the switch, a
    ///         human (the bank) decides whether to resume.
    function setPaused(address bank, bool p, string calldata reason) external {
        bool isBank = msg.sender == bank;
        bool guardianTrip = p && guardianOf[bank] == msg.sender;
        if (!isBank && !guardianTrip) revert NotGuardian();
        paused[bank] = p;
        emit Paused(bank, p, msg.sender, reason);
    }

    // ── the mandate rail ─────────────────────────────────────────────────────────────────────

    /// @notice Post a mandate. The second-tap problem is handled server-side: the caller signs the
    ///         idempotencyKey, the contract assigns the occurrence. A duplicate within the TTL is
    ///         not rejected — it is routed to human approval via `DuplicateRouted` and never
    ///         overwrites the first post. The sanctions-list snapshot is pinned at ingest so a
    ///         regulator-replay never follows a drifted "current".
    function postMandate(
        bytes32 mandateId,
        bytes32 idempotencyKey,
        uint64 amount,
        bytes32 envelopeHash,
        bytes32 sanctionsListVersion
    ) external {
        if (!banks[msg.sender]) revert BankNotAllowed();
        if (paused[msg.sender]) revert IsPaused();
        if (idempotencyKey == bytes32(0)) revert ZeroIdempotencyKey();
        if (sanctionsListVersion == bytes32(0)) revert ZeroSanctionsListVersion();

        uint8 next = occurrenceOf[idempotencyKey] + 1;
        uint64 postedAt = uint64(block.timestamp);
        uint64 deadline = postedAt + slaWindow;
        if (deadline == 0) revert ZeroDeadline();

        // Reorg/replay safety: a mandateId already carrying state is NOT overwritten. An honest
        // reorg replays into empty state; a same-chain collision is a replay (or a hash accident),
        // and in either case the regulator-visible chain must preserve the earliest record.
        if (_m[mandateId].bank != address(0)) {
            occurrenceOf[idempotencyKey] = next; // still bump — the attempt is observable
            emit DuplicateRouted(mandateId, idempotencyKey, next, "mandate-id-collision");
            return;
        }

        occurrenceOf[idempotencyKey] = next;

        if (next > 1) {
            // same idempotencyKey, different mandateId — the replay signature the §2 defect names.
            // Record the attempt as DuplicateRouted, with the sanctions-list snapshot pinned, and
            // never auto-settle. Human approval owns the next step.
            _m[mandateId] = Mandate({
                bank: msg.sender,
                idempotencyKey: idempotencyKey,
                amount: amount,
                postedAt: postedAt,
                deadline: deadline,
                envelopeHash: envelopeHash,
                sanctionsListVersion: sanctionsListVersion,
                status: Status.DuplicateRouted,
                occurrence: next
            });
            emit DuplicateRouted(mandateId, idempotencyKey, next, "replay-within-ttl");
            return;
        }

        _m[mandateId] = Mandate({
            bank: msg.sender,
            idempotencyKey: idempotencyKey,
            amount: amount,
            postedAt: postedAt,
            deadline: deadline,
            envelopeHash: envelopeHash,
            sanctionsListVersion: sanctionsListVersion,
            status: Status.Posted,
            occurrence: next
        });
        emit MandatePosted(
            mandateId,
            msg.sender,
            idempotencyKey,
            amount,
            deadline,
            next,
            sanctionsListVersion
        );
    }

    /// @notice Mark a mandate settled against a matching reversal.
    function reportSettled(bytes32 mandateId, bytes32 reversalRef) external {
        Mandate storage m = _m[mandateId];
        if (m.bank == address(0)) revert UnknownMandate();
        if (msg.sender != m.bank) revert NotBank();
        if (m.status == Status.Settled) revert AlreadySettled();
        if (m.status == Status.Breached) revert AlreadyBreached();
        m.status = Status.Settled;
        settlementOf[mandateId] = reversalRef;
        emit MandateSettled(mandateId, reversalRef, uint64(block.timestamp));
    }

    /// @notice Fire `SLABreached` when the deadline has passed without a matching settlement.
    ///         Anyone may call this — the regulator-verifiable chain is public; the gate is only
    ///         the deadline, not the caller.
    function emitSLABreach(bytes32 mandateId) external {
        Mandate storage m = _m[mandateId];
        if (m.bank == address(0)) revert UnknownMandate();
        if (m.status == Status.Settled) revert AlreadySettled();
        if (m.status == Status.Breached) revert AlreadyBreached();
        if (block.timestamp < m.deadline) revert NotYetBreached();
        m.status = Status.Breached;
        emit SLABreached(mandateId, m.deadline, uint64(block.timestamp));
    }

    // ── views ────────────────────────────────────────────────────────────────────────────────
    function mandateOf(bytes32 mandateId) external view returns (Mandate memory) {
        return _m[mandateId];
    }

    function isBreached(bytes32 mandateId) external view returns (bool) {
        return _m[mandateId].status == Status.Breached;
    }

    /// @notice Canonical commitment hash over a mandate's audit-relevant fields. Deterministic,
    ///         reproducible off-chain, and suitable as a leaf in a Chainlink-CRE-batched Merkle
    ///         root. The hash deliberately excludes the mutable `status` field so a settled or
    ///         breached mandate reads the same commitment as the original posting — the status
    ///         transition is a separate on-chain event, not a rewrite of the audit lineage.
    function mandateCommitment(bytes32 mandateId) external view returns (bytes32) {
        Mandate storage m = _m[mandateId];
        if (m.bank == address(0)) revert UnknownMandate();
        return keccak256(
            abi.encode(
                mandateId,
                m.bank,
                m.idempotencyKey,
                m.amount,
                m.postedAt,
                m.deadline,
                m.envelopeHash,
                m.sanctionsListVersion,
                m.occurrence
            )
        );
    }
}
