// Kajota Shield — LIVE end-to-end flow on Sepolia. Real encrypted txs via the relayer.
// Approved → over-budget blocked → flagged blocked → hijack burst → anomaly monitor trips the
// on-chain kill switch → paused payment reverts. Then decrypts final `spent` to prove the blocked
// payments moved exactly 0.
//   node scripts/shield/live-flow.mjs
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Contract, HDNodeWallet, hexlify, solidityPackedKeccak256 } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const dep = JSON.parse(readFileSync(new URL("../../deployments/shield-sepolia.json", import.meta.url), "utf8"));
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const { ConfidentialUSDT: CUSDT, FraudOracle: ORACLE, AgentMandate: MANDATE } = Object.fromEntries(
  Object.entries(dep).filter(([k]) => ["ConfidentialUSDT", "FraudOracle", "AgentMandate"].includes(k)).map(([k, v]) => [k, v.address]),
);
const CLEAN = "0xE45E6b01742CDB4e3aECFEb364b2967415C551c1";
const SHELL = "0x000000000000000000000000000000000000dEaD";
const M3 = "0x1111111111111111111111111111111111111111";
const M4 = "0x2222222222222222222222222222222222222222";
const idOf = (a) => solidityPackedKeccak256(["address"], [a]);

const CUSDT_ABI = ["function faucet(uint64) returns (bytes32)", "function setOperator(address,uint48)"];
const ORACLE_ABI = ["function setMember(address,bool)", "function report(bytes32,bytes32,bytes)"];
const MANDATE_ABI = [
  "function registerAgent(address,bytes32,bytes,uint48,uint32,uint32)",
  "function setMerchant(address,address,bool)",
  "function setGuardian(address,address)",
  "function setPaused(address,bool,string)",
  "function checkAndSpend(address,bytes32,bytes) returns (bytes32)",
  "function spentOf(address) view returns (bytes32)",
];

let w, fhe, mandate;
async function send(label, c, m, args, gas) {
  const tx = await c[m](...args, { gasLimit: gas });
  const r = await tx.wait();
  console.log(`  ${r.status === 1 ? "✓" : "✗"} ${label.padEnd(34)} ${tx.hash}`);
  return r;
}
async function enc(contract, val) {
  const e = await fhe.createEncryptedInput(contract, w.address).add64(val).encrypt();
  return [hexlify(e.handles[0]), hexlify(e.inputProof)];
}
// off-chain anomaly monitor (deterministic)
function analyze(history) {
  const cfg = { windowSec: 900, maxSpends: 4, maxNewMerchants: 3 };
  const now = history.at(-1).ts;
  const recent = history.filter((e) => now - e.ts <= cfg.windowSec);
  const merchants = new Set(recent.map((e) => e.merchant));
  const reasons = [];
  if (recent.length > cfg.maxSpends) reasons.push(`velocity ${recent.length} > ${cfg.maxSpends}`);
  if (merchants.size > cfg.maxNewMerchants) reasons.push(`${merchants.size} distinct merchants > ${cfg.maxNewMerchants}`);
  return { trip: reasons.length > 0, reasons };
}

async function pay(label, merchant, amount, history) {
  const [h, p] = await enc(MANDATE, amount);
  try {
    const tx = await mandate.checkAndSpend(merchant, h, p, { gasLimit: 6_000_000n });
    await tx.wait();
    console.log(`  → ${label.padEnd(34)} ${tx.hash}`);
    history.push({ ts: Math.floor(Date.now() / 1000), merchant });
    return tx.hash;
  } catch (e) {
    console.log(`  ⛔ ${label.padEnd(34)} REVERTED (${(e.reason || e.shortMessage || "").slice(0, 40)})`);
    return null;
  }
}

async function decryptSpent() {
  const handle = await mandate.spentOf(w.address);
  const kp = fhe.generateKeypair();
  const start = Math.floor(Date.now() / 1000);
  const eip = fhe.createEIP712(kp.publicKey, [MANDATE], start, 1);
  const sig = await w.signTypedData(eip.domain, { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification }, eip.message);
  const res = await fhe.userDecrypt([{ handle, contractAddress: MANDATE }], kp.privateKey, kp.publicKey, sig.replace(/^0x/, ""), [MANDATE], w.address, start, 1);
  return BigInt(res[handle] ?? res[handle.toLowerCase()]);
}

async function main() {
  const p = new JsonRpcProvider(RPC);
  w = HDNodeWallet.fromPhrase(readFileSync(new URL("../../.secret.mnemonic", import.meta.url), "utf8").trim()).connect(p);
  fhe = await createInstance({ ...SepoliaConfig, network: RPC });
  const cusdt = new Contract(CUSDT, CUSDT_ABI, w);
  const oracle = new Contract(ORACLE, ORACLE_ABI, w);
  mandate = new Contract(MANDATE, MANDATE_ABI, w);
  console.log("Actor (principal + agent + monitor):", w.address);
  console.log("Balance:", (await p.getBalance(w.address)).toString(), "wei\n");

  console.log("── setup ──");
  await send("faucet cUSDT", cusdt, "faucet", [10000], 2_000_000n);
  await send("setOperator(mandate)", cusdt, "setOperator", [MANDATE, 281474976710655n], 200_000n);
  const [capH, capP] = await enc(MANDATE, 1000);
  await send("registerAgent (fresh, cap 1000)", mandate, "registerAgent", [w.address, capH, capP, 2_000_000_000, 3600, 50], 1_500_000n);
  await send("setGuardian(monitor)", mandate, "setGuardian", [w.address, w.address], 120_000n);
  for (const [m, n] of [[CLEAN, "clean"], [SHELL, "shell"], [M3, "m3"], [M4, "m4"]]) await send(`setMerchant(${n})`, mandate, "setMerchant", [w.address, m, true], 120_000n);
  const [sH, sP] = await enc(ORACLE, 80);
  await send("report(shell, risk 80)", oracle, "report", [idOf(SHELL), sH, sP], 2_000_000n);

  console.log("\n── flow (spent starts at 0; cap 1000) ──");
  const history = [];
  await pay("clean 300  → APPROVED", CLEAN, 300, history);
  await pay("clean 800  → over-budget BLOCK", CLEAN, 800, history);
  await pay("shell  50  → flagged BLOCK", SHELL, 50, history);
  await pay("m3     20  → APPROVED (hijack)", M3, 20, history);
  await pay("m4     20  → APPROVED (hijack)", M4, 20, history);

  const v = analyze(history);
  console.log(`\n── anomaly monitor ──\n  ${v.trip ? "⛔ TRIP" : "nominal"}: ${v.reasons.join("; ")}`);
  if (v.trip) await send("guardian setPaused(agent)", mandate, "setPaused", [w.address, true, v.reasons.join("; ")], 150_000n);

  console.log("\n── post-freeze ──");
  await pay("clean 20   → should REVERT (paused)", CLEAN, 20, history);

  const spent = await decryptSpent();
  console.log(`\n✅ decrypted final spent = ${spent}  (expected 340 = 300 + 20 + 20; the 800 over-budget and 50 flagged moved 0)`);
  console.log(spent === 340n ? "   ✔ fail-closed clamp verified live on Sepolia" : "   ⚠ unexpected — check state");
}
main().catch((e) => { console.error("\n❌", e.message); process.exit(1); });
