// Payflow Mandate Beacon — failure mode: SLA BREACH (CBN CPR 2019 24-hour window).
//
//   npx hardhat run scripts/beacon/failure_modes/breach.ts
//
// Demonstrates the SLA-breach oracle. A mandate is posted; the 24-hour reversal window elapses
// without a matching settlement; SLABreached fires on-chain. The regulator audits the chain, not
// the bank's logs. Firing SLABreached before the deadline reverts with NotYetBreached.

import { ethers } from "hardhat";

async function main() {
  const [owner, bank, anyone] = await ethers.getSigners();

  const SLA = 86_400n; // CBN CPR 2019
  const F = await ethers.getContractFactory("MandateAnchor");
  const beacon = await F.connect(owner).deploy(SLA);
  await beacon.waitForDeployment();
  await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

  const mandateId = ethers.id("mandate/NIP-breach/9c71");
  const idemKey = ethers.id("idem/breach");
  const listV = ethers.id("sanctions/snapshot/2026-10-06");

  console.log("── Payflow Mandate Beacon — SLA breach failure mode ──");
  console.log();

  const r1 = await beacon
    .connect(bank)
    .postMandate(mandateId, idemKey, 15_000n, ethers.id("env/breach"), listV);
  const rc1 = await r1.wait();
  const m = await beacon.mandateOf(mandateId);
  console.log(`[1] POST        mandateId=${mandateId.slice(0, 10)}…  deadline=${m.deadline}  tx=${rc1!.hash}`);

  // try to breach too early — the deadline has not yet elapsed
  try {
    await beacon.connect(anyone).emitSLABreach(mandateId);
    console.log(`[2] EARLY BREACH  ✗ should have reverted`);
    process.exit(1);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[2] EARLY BREACH  reverted correctly: ${msg.includes("NotYetBreached") ? "NotYetBreached" : "<other>"}`);
  }

  // advance past the 24-hour window
  await ethers.provider.send("evm_increaseTime", [Number(SLA) + 1]);
  await ethers.provider.send("evm_mine", []);

  const r2 = await beacon.connect(anyone).emitSLABreach(mandateId);
  const rc2 = await r2.wait();
  console.log();
  console.log(`[3] 24h+ ELAPSED  SLABreached fired  tx=${rc2!.hash}`);
  console.log(`                 isBreached(mandateId) = ${await beacon.isBreached(mandateId)}`);
  console.log();

  console.log("── verdict: SLA deadline enforced on-chain, regulator-replayable without bank logs ──");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
