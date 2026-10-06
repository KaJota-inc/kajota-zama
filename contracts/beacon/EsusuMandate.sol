// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  Payflow Mandate Beacon — Esusu (Yoruba rotating-savings mandate)
/// @notice The pre-colonial West African rotating credit association, modernised. An organiser
///         seals a rotation of N members and a fixed collector order; each cycle, every member
///         contributes the agreed amount, and the designated collector of that cycle sweeps the
///         full pot once the attestation set is complete. The historical mechanism faltered when
///         informal organisers absconded with early-cycle contributions or quietly reshuffled the
///         collector order against latecomers — chit funds were banned in 1905 and modern Lagos
///         ajo keepers still default on perhaps 1 in 20 rotations. On-chain commitment of the
///         rotation order at seal, per-cycle attestation of contributions, and a kill-switch for
///         anomaly monitors reinstate the trust the custom could not keep on its own.
/// @dev    Plain Solidity, no FHE — the regulator-verifiable chain wants PUBLIC audit, mirroring
///         {MandateAnchor} and {SakkMandate}. Phase A tracks contribution attestations rather
///         than custodial transfers; Phase B wires an {IERC20} rail (e.g., cUSDT on the Zama
///         rail or PYUSD on Arbitrum) so the collection is a real payout, not a signal.
contract EsusuMandate {
    enum RotationStatus { None, Open, Closed, Defaulted }
    enum CycleStatus { Pending, Funded, Paid, Defaulted }

    struct Rotation {
        address organiser;
        uint8 memberCount;            // n — fixed at seal
        uint8 nextCycle;              // 0-indexed, bumps on each payout or default
        uint64 contributionAmount;    // minor units each member owes per cycle
        uint64 cycleLengthSeconds;    // e.g., 7 days
        uint64 sealedAt;              // seconds (block.timestamp cast)
        bytes32 rotationCommit;       // keccak256(abi.encode(members, collectorOrder, contrib, cycleLen))
        RotationStatus status;
    }

    struct Cycle {
        uint8 index;                  // 0..n-1
        address collector;            // the recipient of this cycle's pot
        uint64 deadline;              // sealedAt + (index+1) * cycleLength
        uint8 contributionsCount;     // bump per member attestation
        CycleStatus status;
    }

    // ── roles & kill-switch (mirrors MandateAnchor.sol pattern) ──────────────────────────────
    address public immutable owner;
    mapping(address => bool) public organisers;        // allow-listed organisers
    mapping(address => address) public guardianOf;     // organiser => anomaly monitor allowed to pause
    mapping(address => bool) public paused;            // kill-switch per organiser

    // ── rotation state ───────────────────────────────────────────────────────────────────────
    mapping(bytes32 => Rotation) private _r;
    mapping(bytes32 => address[]) private _members;    // ordered list, length == memberCount
    mapping(bytes32 => address[]) private _collectors; // ordered list, length == memberCount
    mapping(bytes32 => mapping(address => bool)) public isMember;
    mapping(bytes32 => Cycle[]) private _cycles;
    mapping(bytes32 => mapping(uint8 => mapping(address => bool))) public contributed;

    // ── events ───────────────────────────────────────────────────────────────────────────────
    event OrganiserAllowed(address indexed organiser, bool allowed);
    event GuardianSet(address indexed organiser, address indexed guardian);
    event Paused(address indexed organiser, bool paused, address by, string reason);

    event RotationSealed(
        bytes32 indexed rotationId,
        address indexed organiser,
        bytes32 rotationCommit,
        uint8 memberCount,
        uint64 contributionAmount,
        uint64 cycleLengthSeconds
    );
    event Contributed(
        bytes32 indexed rotationId,
        uint8 indexed cycleIndex,
        address indexed member,
        uint8 contributionsCount
    );
    event CyclePaidOut(
        bytes32 indexed rotationId,
        uint8 indexed cycleIndex,
        address indexed collector,
        uint64 potAmount
    );
    event CycleDefaulted(
        bytes32 indexed rotationId,
        uint8 indexed cycleIndex,
        uint8 contributionsCount,
        uint64 deadline
    );
    event RotationClosed(bytes32 indexed rotationId);

    // ── errors ───────────────────────────────────────────────────────────────────────────────
    error NotOwner();
    error NotOrganiser();
    error NotGuardian();
    error OrganiserNotAllowed();
    error IsPaused();
    error ZeroMembers();
    error MemberCountMismatch();
    error ZeroContribution();
    error ZeroCycleLength();
    error RotationAlreadyExists();
    error UnknownRotation();
    error NotMember();
    error NotCollector();
    error AlreadyContributed();
    error WrongCycleIndex();
    error CycleDeadlinePassed();
    error CycleDeadlineNotReached();
    error QuorumNotMet();
    error AlreadyPaid();
    error AlreadyDefaulted();
    error RotationNotOpen();
    error RotationHasOpenCycles();

    constructor() {
        owner = msg.sender;
    }

    // ── owner / organiser / guardian plumbing ────────────────────────────────────────────────
    function allowOrganiser(address organiser, bool allowed) external {
        if (msg.sender != owner) revert NotOwner();
        organisers[organiser] = allowed;
        emit OrganiserAllowed(organiser, allowed);
    }

    function setGuardian(address organiser, address guardian) external {
        if (msg.sender != organiser) revert NotOrganiser();
        guardianOf[organiser] = guardian;
        emit GuardianSet(organiser, guardian);
    }

    /// @notice Kill switch. The organiser may pause or resume with any reason; the appointed
    ///         guardian (anomaly monitor) may only PAUSE — mirrors MandateAnchor + Sakk.
    function setPaused(address organiser, bool p, string calldata reason) external {
        bool isSelf = msg.sender == organiser;
        bool guardianTrip = p && guardianOf[organiser] == msg.sender;
        if (!isSelf && !guardianTrip) revert NotGuardian();
        paused[organiser] = p;
        emit Paused(organiser, p, msg.sender, reason);
    }

    // ── the esusu rail ───────────────────────────────────────────────────────────────────────

    /// @notice Seal a rotation. The organiser fixes the member set, the collector order, the
    ///         per-cycle contribution, and the cycle length. The `rotationCommit` is
    ///         `keccak256(abi.encode(members, collectorOrder, contrib, cycleLen))` so a
    ///         regulator replaying this submission later proves the rotation order was fixed at
    ///         inception, not rewritten against a latecomer.
    function seal(
        bytes32 rotationId,
        address[] calldata members,
        address[] calldata collectorOrder,
        uint64 contributionAmount,
        uint64 cycleLengthSeconds
    ) external {
        if (!organisers[msg.sender]) revert OrganiserNotAllowed();
        if (paused[msg.sender]) revert IsPaused();
        if (members.length == 0) revert ZeroMembers();
        if (members.length != collectorOrder.length) revert MemberCountMismatch();
        if (contributionAmount == 0) revert ZeroContribution();
        if (cycleLengthSeconds == 0) revert ZeroCycleLength();
        if (_r[rotationId].organiser != address(0)) revert RotationAlreadyExists();

        bytes32 commit = keccak256(
            abi.encode(members, collectorOrder, contributionAmount, cycleLengthSeconds)
        );

        uint8 n = uint8(members.length);
        uint64 sealedAt = uint64(block.timestamp);

        _r[rotationId] = Rotation({
            organiser: msg.sender,
            memberCount: n,
            nextCycle: 0,
            contributionAmount: contributionAmount,
            cycleLengthSeconds: cycleLengthSeconds,
            sealedAt: sealedAt,
            rotationCommit: commit,
            status: RotationStatus.Open
        });

        for (uint256 i = 0; i < members.length; i++) {
            _members[rotationId].push(members[i]);
            _collectors[rotationId].push(collectorOrder[i]);
            isMember[rotationId][members[i]] = true;
            _cycles[rotationId].push(
                Cycle({
                    index: uint8(i),
                    collector: collectorOrder[i],
                    deadline: sealedAt + cycleLengthSeconds * uint64(i + 1),
                    contributionsCount: 0,
                    status: CycleStatus.Pending
                })
            );
        }

        emit RotationSealed(
            rotationId,
            msg.sender,
            commit,
            n,
            contributionAmount,
            cycleLengthSeconds
        );
    }

    /// @notice A member attests their contribution for the given cycle. Phase A tracks the
    ///         attestation only; Phase B escrows the IERC20 pull. Exactly-once per (cycle, member).
    function contribute(bytes32 rotationId, uint8 cycleIndex) external {
        Rotation storage r = _r[rotationId];
        if (r.organiser == address(0)) revert UnknownRotation();
        if (r.status != RotationStatus.Open) revert RotationNotOpen();
        if (cycleIndex != r.nextCycle) revert WrongCycleIndex();
        if (!isMember[rotationId][msg.sender]) revert NotMember();

        Cycle storage c = _cycles[rotationId][cycleIndex];
        if (c.status != CycleStatus.Pending && c.status != CycleStatus.Funded) {
            revert AlreadyPaid();
        }
        if (block.timestamp >= c.deadline) revert CycleDeadlinePassed();
        if (contributed[rotationId][cycleIndex][msg.sender]) revert AlreadyContributed();

        contributed[rotationId][cycleIndex][msg.sender] = true;
        c.contributionsCount += 1;
        if (c.contributionsCount == r.memberCount) {
            c.status = CycleStatus.Funded;
        }
        emit Contributed(rotationId, cycleIndex, msg.sender, c.contributionsCount);
    }

    /// @notice Collector sweeps the cycle's pot after all contributions are observed and before
    ///         the cycle deadline. Advances `nextCycle` by one. Phase A emits a signal; Phase B
    ///         pulls the IERC20 pot and transfers to `c.collector`.
    function collect(bytes32 rotationId, uint8 cycleIndex) external {
        Rotation storage r = _r[rotationId];
        if (r.organiser == address(0)) revert UnknownRotation();
        if (r.status != RotationStatus.Open) revert RotationNotOpen();
        if (cycleIndex != r.nextCycle) revert WrongCycleIndex();

        Cycle storage c = _cycles[rotationId][cycleIndex];
        if (c.status == CycleStatus.Paid) revert AlreadyPaid();
        if (c.status == CycleStatus.Defaulted) revert AlreadyDefaulted();
        if (c.contributionsCount < r.memberCount) revert QuorumNotMet();
        if (msg.sender != c.collector) revert NotCollector();

        c.status = CycleStatus.Paid;
        r.nextCycle = cycleIndex + 1;

        uint64 pot = r.contributionAmount * uint64(r.memberCount);
        emit CyclePaidOut(rotationId, cycleIndex, c.collector, pot);

        if (r.nextCycle == r.memberCount) {
            r.status = RotationStatus.Closed;
            emit RotationClosed(rotationId);
        }
    }

    /// @notice Mark a cycle defaulted once its deadline passes without full attestations. Anyone
    ///         may call. Advances `nextCycle` so the rotation can proceed under a dispute flag.
    function markDefaulted(bytes32 rotationId, uint8 cycleIndex) external {
        Rotation storage r = _r[rotationId];
        if (r.organiser == address(0)) revert UnknownRotation();
        if (cycleIndex != r.nextCycle) revert WrongCycleIndex();

        Cycle storage c = _cycles[rotationId][cycleIndex];
        if (c.status == CycleStatus.Paid) revert AlreadyPaid();
        if (c.status == CycleStatus.Defaulted) revert AlreadyDefaulted();
        if (block.timestamp < c.deadline) revert CycleDeadlineNotReached();

        c.status = CycleStatus.Defaulted;
        r.nextCycle = cycleIndex + 1;
        r.status = RotationStatus.Defaulted;
        emit CycleDefaulted(rotationId, cycleIndex, c.contributionsCount, c.deadline);
    }

    // ── views ────────────────────────────────────────────────────────────────────────────────
    function rotationOf(bytes32 rotationId) external view returns (Rotation memory) {
        return _r[rotationId];
    }

    function cyclesOf(bytes32 rotationId) external view returns (Cycle[] memory) {
        return _cycles[rotationId];
    }

    function membersOf(bytes32 rotationId) external view returns (address[] memory) {
        return _members[rotationId];
    }

    function collectorsOf(bytes32 rotationId) external view returns (address[] memory) {
        return _collectors[rotationId];
    }

    /// @notice Canonical commitment hash — the same bytes the organiser committed at seal.
    ///         Reproducible off-chain by any party holding the member list, collector order,
    ///         contribution amount, and cycle length.
    function rotationCommit(bytes32 rotationId) external view returns (bytes32) {
        Rotation storage r = _r[rotationId];
        if (r.organiser == address(0)) revert UnknownRotation();
        return r.rotationCommit;
    }
}
