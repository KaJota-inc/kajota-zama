// Export EsusuMandate rotationCommit round-trip fixtures.
//
//   npx hardhat run scripts/beacon/export-esusu-fixtures.ts > /tmp/esusu-fixtures.json
//
// Produces a JSON array of {inputs, expected} pairs where `expected` matches
// `EsusuMandate.rotationCommit`: `keccak256(abi.encode(members[], order[], contrib, cycleLen))`.
// Payflow's Python `rotation_commit()` consumes the file and asserts byte-equality.
//
// No on-chain exercise required — the commit is a pure function of its inputs.

import { AbiCoder, keccak256, getAddress } from "ethers";

type Fixture = {
  label: string;
  inputs: {
    members: string[];
    collectorOrder: string[];
    contributionAmount: string;
    cycleLengthSeconds: string;
  };
  expected: string;
};

const abi = AbiCoder.defaultAbiCoder();

function fx(
  label: string,
  members: string[],
  collectorOrder: string[],
  contributionAmount: bigint,
  cycleLengthSeconds: bigint,
): Fixture {
  const checksummed = members.map(getAddress);
  const orderChecksummed = collectorOrder.map(getAddress);
  const encoded = abi.encode(
    ["address[]", "address[]", "uint64", "uint64"],
    [checksummed, orderChecksummed, contributionAmount, cycleLengthSeconds],
  );
  return {
    label,
    inputs: {
      members: checksummed,
      collectorOrder: orderChecksummed,
      contributionAmount: contributionAmount.toString(),
      cycleLengthSeconds: cycleLengthSeconds.toString(),
    },
    expected: keccak256(encoded),
  };
}

// Lowercased inputs; `fx` runs them through `getAddress` to produce EIP-55 checksum form.
const A = "0xe45e6b01742cdb4e3aecfeb364b2967415c551c1";
const B = "0x2f76906b39a484cc43cf911ffd9893f52258e4c2";
const C = "0xe1bacf1f7c87f1dc03c401c8bd96cd48d3f13d4f";
const D = "0x742d35cc6634c0532925a3b844bc9e7595f8beb6";

const WEEK = 7n * 24n * 60n * 60n;      // 604_800
const MONTH = 30n * 24n * 60n * 60n;    // 2_592_000

const fixtures: Fixture[] = [
  fx(
    "lagos market, 3 members, in-order collectors, weekly, 100 units",
    [A, B, C],
    [A, B, C],
    100n,
    WEEK,
  ),
  fx(
    "lagos market, 3 members, auction-order collectors, weekly, 100 units",
    [A, B, C],
    [B, C, A],
    100n,
    WEEK,
  ),
  fx(
    "ibadan market, 4 members, in-order, monthly, 50_000 units",
    [A, B, C, D],
    [A, B, C, D],
    50_000n,
    MONTH,
  ),
  fx(
    "boundary: 1 member, 1 unit, 1 second cycle",
    [A],
    [A],
    1n,
    1n,
  ),
];

const out = {
  description:
    "Round-trip fixtures for EsusuMandate.rotationCommit ↔ payflow.mandate.rotation_commit()",
  source: "scripts/beacon/export-esusu-fixtures.ts (hackathon/bli-mandate-beacon)",
  formula: "keccak256(abi.encode(address[] members, address[] collectorOrder, uint64 contrib, uint64 cycleLen))",
  fixtures,
};
console.log(JSON.stringify(out, null, 2));
