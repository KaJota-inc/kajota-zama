// Kajota Shield — anomaly monitor ("the agent watches the agent").
// Deterministic detection trips the on-chain kill switch; a human decides whether to resume.
// The DECISION is rules-based and fail-closed; an LLM only EXPLAINS it in plain English.
//
//   node scripts/shield/monitor.mjs --simulate     # offline demo of the detection logic
//   node scripts/shield/monitor.mjs                # live: watch Spend events, trip via guardian
//
import { readFileSync } from "node:fs";

// ── detection config (deterministic policy) ───────────────────────────────────────────────
const CFG = {
  windowSec: 60, // sliding window
  maxSpends: 5, // > this many payments in the window → velocity anomaly
  maxNewMerchants: 3, // > this many first-seen merchants in the window → burst anomaly
};

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/// Pure, deterministic analysis of one agent's recent spend history.
/// history: [{ ts:seconds, merchant:address }] ; seen: Set of merchants seen before the window.
export function analyze(history, seen, now, cfg = CFG) {
  const recent = history.filter((e) => now - e.ts <= cfg.windowSec);
  const merchants = new Set(recent.map((e) => e.merchant));
  const newMerchants = [...merchants].filter((m) => !seen.has(m));

  const velocity = recent.length;
  const reasons = [];
  if (velocity > cfg.maxSpends) reasons.push(`velocity ${velocity} > ${cfg.maxSpends} in ${cfg.windowSec}s`);
  if (newMerchants.length > cfg.maxNewMerchants)
    reasons.push(`${newMerchants.length} first-seen merchants > ${cfg.maxNewMerchants} in ${cfg.windowSec}s`);

  return { trip: reasons.length > 0, velocity, newMerchants, reasons };
}

/// The "LLM explains" layer — deterministic decision, human-readable rationale. (A production
/// deployment swaps this for a model call enriched with the agent's baseline; the DECISION never
/// depends on the model.)
function explain(agent, verdict) {
  if (!verdict.trip) return `Agent ${short(agent)} nominal — ${verdict.velocity} recent payment(s), within policy.`;
  return (
    `⛔ Paused agent ${short(agent)} — ${verdict.reasons.join("; ")}. ` +
    `${verdict.newMerchants.length} new counterparties in the window is consistent with a hijacked or ` +
    `prompt-injected agent draining a mandate. Deterministic policy tripped the kill switch; ` +
    `a human must review before resuming.`
  );
}

// ── offline simulation ─────────────────────────────────────────────────────────────────────
function simulate() {
  const agent = "0xA9e5f0c31Bd7248fE6bC0a11c2D3e4F5061728a9";
  const known = new Set(["0xCoffeeApi000000000000000000000000000001", "0xCloudBill00000000000000000000000000002"]);
  const now = 1_000_000;

  console.log("Kajota Shield · anomaly monitor — offline simulation\n");

  // 1) normal day: a couple of payments to known merchants
  let history = [
    { ts: now - 40, merchant: "0xCoffeeApi000000000000000000000000000001" },
    { ts: now - 12, merchant: "0xCloudBill00000000000000000000000000002" },
  ];
  let v = analyze(history, known, now);
  console.log("NORMAL   →", explain(agent, v));

  // 2) hijack: a burst of payments to many first-seen merchants inside the window
  const burst = Array.from({ length: 9 }, (_, i) => ({
    ts: now - (50 - i * 5),
    merchant: "0xSh3ll" + String(i).padStart(34, "0"),
  }));
  history = [...history, ...burst];
  v = analyze(history, known, now);
  console.log("HIJACK   →", explain(agent, v));
  console.log(`\n→ on-chain action: mandate.setPaused(agent, true, "${v.reasons.join("; ")}") as guardian`);
}

// ── live watcher (ready once Shield is deployed) ────────────────────────────────────────────
async function live() {
  const { JsonRpcProvider, Wallet, Contract, Mnemonic, HDNodeWallet } = await import("ethers");
  const dep = JSON.parse(readFileSync(new URL("../../deployments/shield-sepolia.json", import.meta.url), "utf8"));
  const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new JsonRpcProvider(RPC);
  const phrase = readFileSync(new URL("../../.secret.mnemonic", import.meta.url), "utf8").trim();
  const guardian = new Wallet(HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0").privateKey, provider);

  const abi = [
    "event Spend(address indexed agent, address indexed merchant)",
    "function guardianOf(address) view returns (address)",
    "function setPaused(address agent, bool p, string reason)",
  ];
  const mandate = new Contract(dep.AgentMandate.address, abi, guardian);
  const hist = new Map(); // agent → [{ts,merchant}]
  const seen = new Map(); // agent → Set(merchant)
  console.log("Kajota Shield · anomaly monitor — watching", short(dep.AgentMandate.address));

  mandate.on("Spend", async (agent, merchant) => {
    const now = Math.floor(Date.now() / 1000);
    if (!hist.has(agent)) { hist.set(agent, []); seen.set(agent, new Set()); }
    hist.get(agent).push({ ts: now, merchant });
    const v = analyze(hist.get(agent), seen.get(agent), now);
    hist.get(agent).forEach((e) => seen.get(agent).add(e.merchant));
    if (v.trip && (await mandate.guardianOf(agent)) === guardian.address) {
      console.log(explain(agent, v));
      await (await mandate.setPaused(agent, true, v.reasons.join("; "))).wait();
    }
  });
}

if (process.argv.includes("--simulate")) simulate();
else live().catch((e) => { console.error("monitor error:", e.message); process.exit(1); });
