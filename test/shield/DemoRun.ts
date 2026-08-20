import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { writeFileSync } from "node:fs";

// Runs the full Kajota Shield scenario with REAL FHE on the in-process chain and writes
// scripts/shield/run.json — the real decisions the operator-console dashboard renders.
//   npx hardhat test test/shield/DemoRun.ts
function analyze(history: { ts: number; merchant: string }[], seen: Set<string>, now: number) {
  const cfg = { windowSec: 60, maxSpends: 5, maxNewMerchants: 3 };
  const recent = history.filter((e) => now - e.ts <= cfg.windowSec);
  const merchants = new Set(recent.map((e) => e.merchant));
  const newM = [...merchants].filter((m) => !seen.has(m));
  const reasons: string[] = [];
  if (recent.length > cfg.maxSpends) reasons.push(`velocity ${recent.length} > ${cfg.maxSpends} in ${cfg.windowSec}s`);
  if (newM.length > cfg.maxNewMerchants)
    reasons.push(`${newM.length} new merchants > ${cfg.maxNewMerchants} in ${cfg.windowSec}s`);
  return { trip: reasons.length > 0, reasons };
}

const idOf = (a: string) => ethers.solidityPackedKeccak256(["address"], [a]);

describe("Kajota Shield — demo scenario → run.json", function () {
  it("plays the full operator scenario and writes the dashboard feed", async function () {
    if (!fhevm.isMock) this.skip();
    const CAP = 1000n;
    const THRESHOLD = 50n;
    const s = await ethers.getSigners();
    const [bank, principal, agent, monitor] = [s[0], s[1], s[2], s[3]];
    const merchants = [
      { s: s[4], label: "coffee-api", flagged: false },
      { s: s[5], label: "cloud-bill", flagged: false },
      { s: s[6], label: "shell-co", flagged: true },
      { s: s[7], label: "vendor-3", flagged: false },
      { s: s[8], label: "vendor-4", flagged: false },
      { s: s[9], label: "vendor-5", flagged: false },
      { s: s[10], label: "vendor-6", flagged: false },
      { s: s[11], label: "vendor-7", flagged: false },
    ];
    const labelOf = (a: string) => merchants.find((m) => m.s.address === a)?.label ?? "unknown";

    const cusdt = await (await ethers.getContractFactory("ConfidentialUSDT")).deploy();
    const oracle = await (await ethers.getContractFactory("FraudOracle")).deploy();
    const mandate = await (
      await ethers.getContractFactory("AgentMandate")
    ).deploy(await oracle.getAddress(), await cusdt.getAddress(), THRESHOLD);
    const mandateAddr = await mandate.getAddress();

    await (await oracle.connect(bank).setMember(bank.address, true)).wait();
    await (await oracle.connect(bank).setMember(mandateAddr, true)).wait();
    await (await cusdt.connect(principal).faucet(100_000)).wait();
    await (await cusdt.connect(principal).setOperator(mandateAddr, 281474976710655n)).wait();

    const cap = await fhevm.createEncryptedInput(mandateAddr, principal.address).add64(CAP).encrypt();
    await (
      await mandate
        .connect(principal)
        .registerAgent(agent.address, cap.handles[0], cap.inputProof, 2_000_000_000, 3600, 50)
    ).wait();
    await (await mandate.connect(principal).setGuardian(agent.address, monitor.address)).wait();
    for (const m of merchants)
      await (await mandate.connect(principal).setMerchant(agent.address, m.s.address, true)).wait();
    const score = await fhevm
      .createEncryptedInput(await oracle.getAddress(), bank.address)
      .add64(80)
      .encrypt();
    await (await oracle.connect(bank).report(idOf(merchants[2].s.address), score.handles[0], score.inputProof)).wait();

    const plan: [number, number][] = [
      [0, 200],
      [1, 300],
      [2, 150],
      [0, 700],
      [3, 40],
      [4, 40],
      [5, 40],
      [6, 40],
      [7, 40],
    ];

    const timeline: unknown[] = [];
    const history: { ts: number; merchant: string }[] = [];
    const seen = new Set<string>();
    let spent = 0n;
    let paused = false;
    let monitorTrip: { at: number; reason: string } | null = null;
    const dec = async (h: string) =>
      h === ethers.ZeroHash ? 0n : await fhevm.userDecryptEuint(FhevmType.euint64, h, mandateAddr, principal);

    for (let i = 0; i < plan.length; i++) {
      const [mi, amount] = plan[i];
      const m = merchants[mi];
      const now = Number((await ethers.provider.getBlock("latest"))!.timestamp);
      let verdict: string, reason: string;
      let applied = 0n;

      if (paused) {
        verdict = "BLOCKED";
        reason = "agent frozen by anomaly monitor";
      } else {
        const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(amount).encrypt();
        await (await mandate.connect(agent).checkAndSpend(m.s.address, enc.handles[0], enc.inputProof)).wait();
        applied = await dec(await mandate.lastAppliedOf(agent.address));
        spent = await dec(await mandate.spentOf(agent.address));
        history.push({ ts: now, merchant: m.s.address });
        if (applied === BigInt(amount)) {
          verdict = "APPROVED";
          reason = "within mandate · counterparty clean";
        } else {
          verdict = "BLOCKED";
          reason = m.flagged ? "counterparty network-flagged" : "over encrypted budget";
        }
        const v = analyze(history, seen, now);
        history.forEach((e) => seen.add(e.merchant));
        if (v.trip && !paused) {
          await (await mandate.connect(monitor).setPaused(agent.address, true, v.reasons.join("; "))).wait();
          paused = true;
          monitorTrip = { at: i, reason: v.reasons.join("; ") };
        }
      }
      timeline.push({
        step: i + 1,
        merchant: labelOf(m.s.address),
        flagged: m.flagged,
        requested: amount,
        applied: Number(applied),
        spent: Number(spent),
        verdict,
        reason,
        monitorTripped: monitorTrip?.at === i,
      });
    }

    const out = {
      generatedAt: new Date().toISOString(),
      contracts: {
        AgentMandate: mandateAddr,
        FraudOracle: await oracle.getAddress(),
        ConfidentialUSDT: await cusdt.getAddress(),
      },
      agent: agent.address,
      principal: principal.address,
      monitor: monitor.address,
      cap: Number(CAP),
      threshold: Number(THRESHOLD),
      finalSpent: Number(spent),
      paused,
      monitorTrip,
      merchants: merchants.map((m) => ({ label: m.label, flagged: m.flagged })),
      timeline,
    };
    writeFileSync("scripts/shield/run.json", JSON.stringify(out, null, 2));
    console.log("wrote scripts/shield/run.json — paused:", paused, "steps:", timeline.length);
  });
});
