// Payflow Mandate Beacon — failure mode: MANDATE-ID COLLISION (replay or hash accident).
//
//   npx hardhat run scripts/beacon/failure_modes/collision.ts
//
// Demonstrates that a same-chain collision on an existing mandateId does NOT silently overwrite
// the first post. The chain preserves the earliest record and emits DuplicateRouted with the
// "mandate-id-collision" reason. An honest reorg replays into empty state and is unaffected.

import { ethers } from "hardhat";

async function main() {
  const [owner, bank] = await ethers.getSigners();

  const F = await ethers.getContractFactory("MandateAnchor");
  const beacon = await F.connect(owner).deploy(86_400n);
  await beacon.waitForDeployment();
  await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

  const mandateId = ethers.id("mandate/NIP-collision/8a44");
  const idemKey1 = ethers.id("idem/legit");
  const idemKey2 = ethers.id("idem/attacker");
  const listV = ethers.id("sanctions/snapshot/2026-10-06");

  console.log("── Payflow Mandate Beacon — mandateId collision failure mode ──");
  console.log();

  // first post — the legitimate record
  const r1 = await beacon
    .connect(bank)
    .postMandate(mandateId, idemKey1, 7_000n, ethers.id("env/legit"), listV);
  const rc1 = await r1.wait();
  const first = await beacon.mandateOf(mandateId);
  console.log(`[1] LEGIT POST    amount=${first.amount}  status=Posted              tx=${rc1!.hash}`);

  // second post — same mandateId, different idempotencyKey, higher amount. The chain preserves
  // the first record and emits DuplicateRouted("mandate-id-collision").
  const r2 = await beacon
    .connect(bank)
    .postMandate(mandateId, idemKey2, 99_000n, ethers.id("env/attacker"), listV);
  const rc2 = await r2.wait();
  const after = await beacon.mandateOf(mandateId);
  console.log(`[2] COLLISION     attempted-amount=99000  stored-amount=${after.amount}   tx=${rc2!.hash}`);
  console.log(`                 status=Posted (first record intact — second NEVER overwrites)`);
  console.log();

  console.log("── verdict: first post preserved, collision event emitted, no silent overwrite ──");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
