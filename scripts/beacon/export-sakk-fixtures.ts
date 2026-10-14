// Export SakkMandate commit round-trip fixtures.
//
//   npx hardhat run scripts/beacon/export-sakk-fixtures.ts > /tmp/sakk-fixtures.json
//
// Produces a JSON array of {inputs, expected} pairs where `expected` matches
// `SakkMandate.seal`'s commit field: `keccak256(abi.encode(bodyBytes, nonce))`.
// Payflow's Python `sakk_commit()` consumes the file and asserts byte-equality,
// extending the one-rail-three-mechanisms cross-repo invariant from MandateAnchor to Sakk.
//
// No on-chain exercise required — the commit is a pure function of its two
// inputs, so the fixture is deterministic and reproducible without a live chain.

import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";

type Fixture = {
  label: string;
  inputs: { bodyHex: string; nonce: string };
  expected: string;
};

const abi = AbiCoder.defaultAbiCoder();

function fx(label: string, bodyText: string, nonce: bigint): Fixture {
  const bodyBytes = toUtf8Bytes(bodyText);
  const bodyHex = "0x" + Buffer.from(bodyBytes).toString("hex");
  const encoded = abi.encode(["bytes", "uint256"], [bodyBytes, nonce]);
  const expected = keccak256(encoded);
  return {
    label,
    inputs: { bodyHex, nonce: nonce.toString() },
    expected,
  };
}

const fixtures: Fixture[] = [
  fx(
    "basra draft, 1000 dinars, nonce=0xdeadbeef",
    "Pay to the bearer at Basra the sum of 1000 dinars drawn upon the house of al-Rashid.",
    0xdeadbeefn,
  ),
  fx(
    "short body, nonce=0",
    "pay 1 dinar",
    0n,
  ),
  fx(
    "long body, nonce=uint256-max",
    "A longer sakk body: pay to the merchant at Baghdad the sum of five hundred dirhams, witnessed by the three undersigned, redeemable on sight.",
    (1n << 256n) - 1n,
  ),
  fx(
    "empty body, nonce=1",
    "",
    1n,
  ),
];

const out = {
  description:
    "Round-trip fixtures for SakkMandate.seal commit ↔ payflow.mandate.sakk_commit()",
  source: "scripts/beacon/export-sakk-fixtures.ts (hackathon/bli-mandate-beacon)",
  formula: "keccak256(abi.encode(bytes bodyBytes, uint256 nonce))",
  fixtures,
};
console.log(JSON.stringify(out, null, 2));
