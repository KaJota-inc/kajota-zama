import { AbiCoder, keccak256 } from "ethers";

/**
 * In-browser reproduction of `MandateAnchor.mandateCommitment()`.
 *
 * The on-chain Solidity view is:
 *
 *   keccak256(abi.encode(
 *     mandateId, bank, idempotencyKey, amount,
 *     postedAt, deadline, envelopeHash,
 *     sanctionsListVersion, occurrence
 *   ))
 *
 * The inspector lets a judge verify a receipt without running a node by
 * recomputing this hash from the manifest's own fields and comparing it
 * against the chain's commitment. Mirror of
 * `lib/beacon/canonical.ts:mandateCommitment` in kajota-paypal.
 */
export type AnchorCommitmentInput = {
  mandateId: string;
  bank: string;
  idempotencyKey: string;
  amount: string | bigint;
  postedAt: string | bigint;
  deadline: string | bigint;
  envelopeHash: string;
  sanctionsListVersion: string;
  occurrence: number;
};

export function mandateCommitment(input: AnchorCommitmentInput): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    [
      "bytes32",
      "address",
      "bytes32",
      "uint64",
      "uint64",
      "uint64",
      "bytes32",
      "bytes32",
      "uint8",
    ],
    [
      input.mandateId,
      input.bank,
      input.idempotencyKey,
      BigInt(input.amount),
      BigInt(input.postedAt),
      BigInt(input.deadline),
      input.envelopeHash,
      input.sanctionsListVersion,
      input.occurrence,
    ],
  );
  return keccak256(encoded);
}

/**
 * The Esusu rotation commitment — pinned at `seal` time. A judge who holds
 * the members, collector order, contribution amount, and cycle length can
 * recompute the hash and verify it against `EsusuMandate.rotationCommit(id)`.
 */
export function rotationCommitment(input: {
  members: string[];
  collectorOrder: string[];
  contribution: string | bigint;
  cycleLength: string | bigint;
}): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address[]", "address[]", "uint64", "uint64"],
    [
      input.members,
      input.collectorOrder,
      BigInt(input.contribution),
      BigInt(input.cycleLength),
    ],
  );
  return keccak256(encoded);
}
