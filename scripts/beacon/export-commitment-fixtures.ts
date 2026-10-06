// Export mandate-commitment round-trip fixtures.
//
//   npx hardhat run scripts/beacon/export-commitment-fixtures.ts > /tmp/fixtures.json
//
// Produces a JSON array of {inputs, expected} pairs where `expected` is the on-chain
// MandateAnchor.mandateCommitment() output for `inputs`. Payflow's Python
// `mandate_commitment()` consumes the file and asserts byte-equality, proving the cross-repo
// hashing primitive matches byte-for-byte.
//
// Each fixture is deterministic — all inputs are literal, no `now()` calls — so the output can be
// committed to the Payflow repo as a stable test asset.

import { ethers } from "hardhat";

type Fixture = {
  label: string;
  inputs: {
    mandateId: string;
    bank: string;
    idempotencyKey: string;
    amount: string; // uint64 as decimal string (JSON number is lossy at bigint range)
    envelopeHash: string;
    sanctionsListVersion: string;
    postedAt: string;
    deadline: string;
    occurrence: number;
  };
  expected: string;
};

async function main() {
  const [owner, bank] = await ethers.getSigners();
  const SLA = 86_400n;
  const F = await ethers.getContractFactory("MandateAnchor");
  const beacon = await F.connect(owner).deploy(SLA);
  await beacon.waitForDeployment();
  await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

  const fixtures: Fixture[] = [];

  const cases: { label: string; mandateId: string; idemKey: string; amount: bigint; env: string; listV: string }[] = [
    {
      label: "small amount, canonical sanctions list v1",
      mandateId: ethers.id("fx/mandate/alpha"),
      idemKey: ethers.id("fx/idem/alpha"),
      amount: 42_000n,
      env: ethers.id("fx/env/alpha"),
      listV: ethers.id("sanctions/cbn-dnd+ofac+un/snapshot/2026-10-06"),
    },
    {
      label: "large amount, different envelope",
      mandateId: ethers.id("fx/mandate/beta"),
      idemKey: ethers.id("fx/idem/beta"),
      amount: 18_446_744_073_709_551_000n, // close to uint64 max
      env: ethers.id("fx/env/beta"),
      listV: ethers.id("sanctions/snapshot/2026-10-06"),
    },
    {
      label: "amount == 1 minor unit, boundary occurrence",
      mandateId: ethers.id("fx/mandate/gamma"),
      idemKey: ethers.id("fx/idem/gamma"),
      amount: 1n,
      env: ethers.id("fx/env/gamma"),
      listV: ethers.id("sanctions/snapshot/2026-10-06"),
    },
  ];

  for (const c of cases) {
    const tx = await beacon
      .connect(bank)
      .postMandate(c.mandateId, c.idemKey, c.amount, c.env, c.listV);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const postedAt = BigInt(block!.timestamp);
    const deadline = postedAt + SLA;

    const commitment = await beacon.mandateCommitment(c.mandateId);

    fixtures.push({
      label: c.label,
      inputs: {
        mandateId: c.mandateId,
        bank: bank.address,
        idempotencyKey: c.idemKey,
        amount: c.amount.toString(),
        envelopeHash: c.env,
        sanctionsListVersion: c.listV,
        postedAt: postedAt.toString(),
        deadline: deadline.toString(),
        occurrence: 1,
      },
      expected: commitment,
    });
  }

  // Stable JSON: 2-space indent, sorted top-level keys per fixture, trailing newline.
  const out = {
    description:
      "Round-trip fixtures for MandateAnchor.mandateCommitment() ↔ payflow.mandate.mandate_commitment()",
    source: "scripts/beacon/export-commitment-fixtures.ts (hackathon/bli-mandate-beacon)",
    fixtures,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
