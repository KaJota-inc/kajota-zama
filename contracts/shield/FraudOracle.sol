// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title  Kajota Shield — Confidential Fraud Oracle
/// @notice A privacy-preserving shared fraud brain for the agentic-payments era. Vetted members
///         (banks, fintechs, agent operators) contribute ENCRYPTED risk signals about hashed
///         identifiers — an account, an autonomous agent, a device or merchant. The oracle keeps an
///         encrypted aggregate per id; a member can learn only whether an id's collective risk
///         crosses THEIR threshold — never the score, never who reported it, never anyone's raw data.
/// @dev    This is the privacy unlock: institutions won't share fraud intelligence today because of
///         competition, privacy and regulation. Computing the aggregate homomorphically removes that
///         blocker — the network gets a shared fraud signal without a shared database.
contract FraudOracle is ZamaEthereumConfig, Ownable {
    /// @notice Vetted members allowed to contribute and query.
    mapping(address => bool) public isMember;
    /// @dev Encrypted aggregate risk per identifier (sum of members' encrypted scores).
    mapping(bytes32 => euint64) private _risk;
    /// @notice Public count of contributions on an id (how many flagged it — not who, not the score).
    mapping(bytes32 => uint32) public reportCount;

    event MemberSet(address indexed member, bool allowed);
    event Reported(bytes32 indexed id, address indexed by, uint32 reportCount);
    event Screened(bytes32 indexed id, address indexed by, uint64 threshold);

    error NotMember();

    constructor() Ownable(msg.sender) {}

    function setMember(address m, bool allowed) external onlyOwner {
        isMember[m] = allowed;
        emit MemberSet(m, allowed);
    }

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    /// @notice Contribute an encrypted risk score (e.g. 1–100) about `id`; added to the aggregate.
    ///         No other member — or the oracle owner — sees this member's individual input.
    function report(bytes32 id, externalEuint64 score, bytes calldata proof) external onlyMember {
        euint64 s = FHE.fromExternal(score, proof);
        euint64 agg = FHE.add(_risk[id], s); // uninitialised aggregate is treated as 0
        _risk[id] = agg;
        FHE.allowThis(agg);
        reportCount[id] += 1;
        emit Reported(id, msg.sender, reportCount[id]);
    }

    /// @dev The current aggregate, or an encrypted 0 if nothing has been reported.
    function _agg(bytes32 id) private returns (euint64) {
        return FHE.isInitialized(_risk[id]) ? _risk[id] : FHE.asEuint64(0);
    }

    /// @notice Privacy-preserving query. Returns an encrypted boolean "aggregate risk ≥ threshold",
    ///         granted to the caller (usable in the same transaction, e.g. by AgentMandate, or
    ///         decryptable by the caller). Reveals ONLY the yes/no against the caller's own
    ///         threshold — not the score, not the contributors.
    function riskFlag(bytes32 id, uint64 threshold) external onlyMember returns (ebool) {
        ebool over = FHE.ge(_agg(id), threshold);
        FHE.allowThis(over);
        FHE.allow(over, msg.sender);
        FHE.allowTransient(over, msg.sender);
        emit Screened(id, msg.sender, threshold);
        return over;
    }

    /// @notice Encrypted aggregate handle for `id` (owner-decryptable — for audit / dispute only).
    function riskOf(bytes32 id) external view returns (euint64) {
        return _risk[id];
    }
}
