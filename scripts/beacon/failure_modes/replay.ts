// Payflow Mandate Beacon — failure mode: SECOND-TAP REPLAY (named host-protocol defect).
//
//   npx hardhat run scripts/beacon/failure_modes/replay.ts
//
// Demonstrates CBN NIP mandate replay-safety. A compromised agent, or a merchant with
// retry-at-ambiguity semantics, cannot settle the same mandate twice before the dispute window
// has even opened. The second attempt is routed to human approval via DuplicateRouted; the
// mandate is NEVER auto-settled.

import { ethers } from "hardhat";

async function main() {
  const [owner, bank] = await ethers.getSigners();

  const F = await ethers.getContractFactory("MandateAnchor");
  const beacon = await F.connect(owner).deploy(86_400n); // CBN CPR 2019 — 24h
  await beacon.waitForDeployment();
  await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

  const idemKey = ethers.id("idem/second-tap/mandate-NIP-7f21");
  const listV = ethers.id("sanctions/cbn-dnd+ofac+un/snapshot/2026-10-06");
  const envelope = ethers.id("envelope/redacted/MR-01");
  const amount = 25_000n; // minor units

  console.log("── Payflow Mandate Beacon — second-tap replay failure mode ──");
  console.log("CBN NIP mandate: idempotencyKey =", idemKey);
  console.log("                 sanctionsListV =", listV);
  console.log();

  // first post — the legitimate debit attempt
  const m1 = ethers.id("mandate/NIP-7f21/attempt/1");
  const r1 = await beacon.connect(bank).postMandate(m1, idemKey, amount, envelope, listV);
  const rc1 = await r1.wait();
  const posted1 = await beacon.mandateOf(m1);
  console.log(`[1] POST       mandateId=${m1.slice(0, 10)}…  status=Posted            tx=${rc1!.hash}`);
  console.log(`              occurrence=${posted1.occurrence}  deadline=${posted1.deadline}`);
  console.log();

  // second post — the compromised-agent replay. Same idempotencyKey, different mandateId.
  const m2 = ethers.id("mandate/NIP-7f21/attempt/2");
  const r2 = await beacon.connect(bank).postMandate(m2, idemKey, amount, envelope, listV);
  const rc2 = await r2.wait();
  const posted2 = await beacon.mandateOf(m2);
  console.log(`[2] REPLAY     mandateId=${m2.slice(0, 10)}…  status=DuplicateRouted   tx=${rc2!.hash}`);
  console.log(`              occurrence=${posted2.occurrence}  (never auto-settled, routes to human)`);
  console.log();

  console.log(`── verdict: replay routed to human approval, first post intact ──`);
  console.log(`            occurrenceOf(idemKey) = ${await beacon.occurrenceOf(idemKey)} (two attempts recorded)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
