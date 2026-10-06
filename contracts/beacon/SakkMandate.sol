// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  Payflow Mandate Beacon — Sakk (sealed Islamic banking mandate)
/// @notice A 10–11th-century Abbasid banking instruction, modernised. The payer commits to a
///         mandate body as a sealed hash; the beneficiary opens the commitment on-chain, with a
///         pre-arranged witness quorum attesting first. A replay of the open fails because the
///         sakk is marked Opened; a forgery fails because the pre-image hash cannot be produced
///         without the original payer.
/// @dev    The historical mechanism faded because cross-city witness coordination could not scale
///         under Mongol-era trade-route disruption, and replay attacks on the physical seal
///         became undetectable. On-chain witnessing fixes both failure modes. Plain Solidity, no
///         FHE — like {MandateAnchor}, the primitive is regulator-verifiable rather than private.
contract SakkMandate {
    enum Status { None, Sealed, Opened, Expired }

    struct Sakk {
        address payer;
        address beneficiary;
        bytes32 commit;      // keccak256(abi.encode(mandateBody, nonce))
        uint64 sealedAt;
        uint64 expiry;
        uint8 witnessQuorum; // k-of-n (n = witnesses.length at seal time)
        uint8 attestations;  // current count
        Status status;
    }

    // ── roles & kill-switch (mirrors MandateAnchor.sol pattern) ──────────────────────────────
    address public immutable owner;
    mapping(address => bool) public payers;         // allow-listed sealers
    mapping(address => address) public guardianOf;  // payer => anomaly monitor allowed to pause
    mapping(address => bool) public paused;         // kill-switch per payer

    // ── sakk state ───────────────────────────────────────────────────────────────────────────
    mapping(bytes32 => Sakk) private _s;
    mapping(bytes32 => mapping(address => bool)) public isWitness;   // (sakkId, who) => designated?
    mapping(bytes32 => mapping(address => bool)) public hasAttested; // (sakkId, who) => attested?

    // ── events ───────────────────────────────────────────────────────────────────────────────
    event PayerAllowed(address indexed payer, bool allowed);
    event GuardianSet(address indexed payer, address indexed guardian);
    event Paused(address indexed payer, bool paused, address by, string reason);

    event SakkSealed(
        bytes32 indexed sakkId,
        address indexed payer,
        address indexed beneficiary,
        bytes32 commit,
        uint64 expiry,
        uint8 witnessQuorum,
        uint8 witnessCount
    );
    event WitnessAttested(bytes32 indexed sakkId, address indexed witness, uint8 count);
    event SakkOpened(
        bytes32 indexed sakkId,
        address indexed opener,
        bytes32 bodyHash
    );
    event SakkExpired(bytes32 indexed sakkId);

    // ── errors ───────────────────────────────────────────────────────────────────────────────
    error NotOwner();
    error NotPayer();
    error NotGuardian();
    error PayerNotAllowed();
    error IsPaused();
    error ZeroCommit();
    error ZeroBeneficiary();
    error ZeroWitnesses();
    error QuorumExceedsCount();
    error ZeroQuorum();
    error ExpiryInPast();
    error SakkAlreadyExists();
    error UnknownSakk();
    error AlreadyOpened();
    error AlreadyExpired();
    error ExpiryNotReached();
    error ExpiryPassed();
    error NotWitness();
    error AlreadyAttested();
    error QuorumNotMet();
    error CommitMismatch();
    error NotBeneficiary();

    constructor() {
        owner = msg.sender;
    }

    // ── owner / payer / guardian plumbing ────────────────────────────────────────────────────
    function allowPayer(address payer, bool allowed) external {
        if (msg.sender != owner) revert NotOwner();
        payers[payer] = allowed;
        emit PayerAllowed(payer, allowed);
    }

    function setGuardian(address payer, address guardian) external {
        if (msg.sender != payer) revert NotPayer();
        guardianOf[payer] = guardian;
        emit GuardianSet(payer, guardian);
    }

    /// @notice Kill switch. The payer may pause or resume with any reason; the appointed guardian
    ///         (anomaly monitor) may only PAUSE — mirrors the MandateAnchor semantics.
    function setPaused(address payer, bool p, string calldata reason) external {
        bool isSelf = msg.sender == payer;
        bool guardianTrip = p && guardianOf[payer] == msg.sender;
        if (!isSelf && !guardianTrip) revert NotGuardian();
        paused[payer] = p;
        emit Paused(payer, p, msg.sender, reason);
    }

    // ── the sakk rail ────────────────────────────────────────────────────────────────────────

    /// @notice Seal a sakk. The payer specifies the commit, the beneficiary, a pre-arranged
    ///         witness set, a quorum (k-of-n), and an expiry. After expiry no open is possible.
    function seal(
        bytes32 sakkId,
        bytes32 commit,
        address beneficiary,
        address[] calldata witnesses,
        uint8 witnessQuorum,
        uint64 expiry
    ) external {
        if (!payers[msg.sender]) revert PayerNotAllowed();
        if (paused[msg.sender]) revert IsPaused();
        if (commit == bytes32(0)) revert ZeroCommit();
        if (beneficiary == address(0)) revert ZeroBeneficiary();
        if (witnesses.length == 0) revert ZeroWitnesses();
        if (witnessQuorum == 0) revert ZeroQuorum();
        if (witnessQuorum > witnesses.length) revert QuorumExceedsCount();
        if (expiry <= block.timestamp) revert ExpiryInPast();
        if (_s[sakkId].payer != address(0)) revert SakkAlreadyExists();

        _s[sakkId] = Sakk({
            payer: msg.sender,
            beneficiary: beneficiary,
            commit: commit,
            sealedAt: uint64(block.timestamp),
            expiry: expiry,
            witnessQuorum: witnessQuorum,
            attestations: 0,
            status: Status.Sealed
        });

        for (uint256 i = 0; i < witnesses.length; i++) {
            isWitness[sakkId][witnesses[i]] = true;
        }

        emit SakkSealed(
            sakkId,
            msg.sender,
            beneficiary,
            commit,
            expiry,
            witnessQuorum,
            uint8(witnesses.length)
        );
    }

    /// @notice A designated witness attests that it endorses the open. One attestation per
    ///         witness per sakk; replay by the same witness is a no-op guard (reverts).
    function attest(bytes32 sakkId) external {
        Sakk storage s = _s[sakkId];
        if (s.payer == address(0)) revert UnknownSakk();
        if (s.status != Status.Sealed) revert AlreadyOpened();
        if (block.timestamp >= s.expiry) revert ExpiryPassed();
        if (!isWitness[sakkId][msg.sender]) revert NotWitness();
        if (hasAttested[sakkId][msg.sender]) revert AlreadyAttested();

        hasAttested[sakkId][msg.sender] = true;
        s.attestations += 1;
        emit WitnessAttested(sakkId, msg.sender, s.attestations);
    }

    /// @notice Open a sakk. Only the designated beneficiary may call. The quorum must be met,
    ///         the commit must match keccak256(abi.encode(mandateBody, nonce)), and the sakk
    ///         must still be Sealed within its expiry.
    function open(bytes32 sakkId, bytes calldata mandateBody, uint256 nonce) external {
        Sakk storage s = _s[sakkId];
        if (s.payer == address(0)) revert UnknownSakk();
        if (s.status == Status.Opened) revert AlreadyOpened();
        if (s.status == Status.Expired) revert AlreadyExpired();
        if (block.timestamp >= s.expiry) revert ExpiryPassed();
        if (msg.sender != s.beneficiary) revert NotBeneficiary();
        if (s.attestations < s.witnessQuorum) revert QuorumNotMet();

        bytes32 computed = keccak256(abi.encode(mandateBody, nonce));
        if (computed != s.commit) revert CommitMismatch();

        s.status = Status.Opened;
        emit SakkOpened(sakkId, msg.sender, keccak256(mandateBody));
    }

    /// @notice Mark a sakk as Expired after its deadline passes without an open. Anyone may call.
    function markExpired(bytes32 sakkId) external {
        Sakk storage s = _s[sakkId];
        if (s.payer == address(0)) revert UnknownSakk();
        if (s.status == Status.Opened) revert AlreadyOpened();
        if (s.status == Status.Expired) revert AlreadyExpired();
        if (block.timestamp < s.expiry) revert ExpiryNotReached();
        s.status = Status.Expired;
        emit SakkExpired(sakkId);
    }

    // ── views ────────────────────────────────────────────────────────────────────────────────
    function sakkOf(bytes32 sakkId) external view returns (Sakk memory) {
        return _s[sakkId];
    }
}
