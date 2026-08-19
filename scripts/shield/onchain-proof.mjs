// Kajota Shield — live Sepolia proof. Sets up a mandate + fraud flag, then shows an APPROVED
// payment and a BLOCKED (network-flagged) payment — real encrypted txs via the relayer SDK.
//   node scripts/shield/onchain-proof.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { JsonRpcProvider, Contract, Mnemonic, HDNodeWallet, hexlify, solidityPackedKeccak256 } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const dep = JSON.parse(readFileSync(new URL("../../deployments/shield-sepolia.json", import.meta.url), "utf8"));
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CUSDT = dep.ConfidentialUSDT.address;
const ORACLE = dep.FraudOracle.address;
const MANDATE = dep.AgentMandate.address;

const CLEAN = "0xE45E6b01742CDB4e3aECFEb364b2967415C551c1"; // clean merchant
const SHELL = "0x000000000000000000000000000000000000dEaD"; // to-be-flagged merchant
const idOf = (a) => solidityPackedKeccak256(["address"], [a]);

const CUSDT_ABI = ["function faucet(uint64) returns (bytes32)", "function setOperator(address,uint48)"];
const ORACLE_ABI = ["function setMember(address,bool)", "function report(bytes32,bytes32,bytes)"];
const MANDATE_ABI = [
  "function registerAgent(address,bytes32,bytes,uint48,uint32,uint32)",
  "function setMerchant(address,address,bool)",
  "function checkAndSpend(address,bytes32,bytes) returns (bytes32)",
];

const proofs = [];
async function send(label, c, m, args, gas) {
  process.stdout.write(`\n▶ ${label} … `);
  const tx = await c[m](...args, { gasLimit: gas });
  process.stdout.write(`${tx.hash}\n`);
  const r = await tx.wait();
  console.log(`  ${r.status === 1 ? "✅" : "❌"} block ${r.blockNumber} gas ${r.gasUsed}`);
  proofs.push({ step: label, txHash: tx.hash });
  if (r.status !== 1) throw new Error(label + " reverted");
}

async function main() {
  const p = new JsonRpcProvider(RPC);
  const w = HDNodeWallet.fromPhrase(readFileSync(new URL("../../.secret.mnemonic", import.meta.url), "utf8").trim()).connect(p);
  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });
  const cusdt = new Contract(CUSDT, CUSDT_ABI, w);
  const oracle = new Contract(ORACLE, ORACLE_ABI, w);
  const mandate = new Contract(MANDATE, MANDATE_ABI, w);
  console.log("Actor (principal + agent + bank):", w.address);

  const encFor = async (contract, val) => {
    const e = await fhe.createEncryptedInput(contract, w.address).add64(val).encrypt();
    return [hexlify(e.handles[0]), hexlify(e.inputProof)];
  };

  await send("oracle.setMember(bank)", oracle, "setMember", [w.address, true], 120_000n);
  await send("oracle.setMember(mandate)", oracle, "setMember", [MANDATE, true], 120_000n);
  await send("cUSDT.faucet(10000)", cusdt, "faucet", [10000], 2_000_000n);
  await send("cUSDT.setOperator(mandate)", cusdt, "setOperator", [MANDATE, 281474976710655n], 200_000n);

  const [capH, capP] = await encFor(MANDATE, 1000);
  await send("mandate.registerAgent (encrypted 1,000 cap)", mandate, "registerAgent", [w.address, capH, capP, 2_000_000_000, 3600, 50], 1_500_000n);
  await send("mandate.setMerchant(clean)", mandate, "setMerchant", [w.address, CLEAN, true], 120_000n);
  await send("mandate.setMerchant(shell)", mandate, "setMerchant", [w.address, SHELL, true], 120_000n);

  const [scoreH, scoreP] = await encFor(ORACLE, 80);
  await send("oracle.report(shell, encrypted 80)", oracle, "report", [idOf(SHELL), scoreH, scoreP], 2_000_000n);

  const [a1H, a1P] = await encFor(MANDATE, 200);
  await send("checkAndSpend clean 200 -> APPROVED", mandate, "checkAndSpend", [CLEAN, a1H, a1P], 6_000_000n);

  const [a2H, a2P] = await encFor(MANDATE, 100);
  await send("checkAndSpend shell 100 -> BLOCKED (flagged)", mandate, "checkAndSpend", [SHELL, a2H, a2P], 6_000_000n);

  const out = { network: "sepolia", contracts: { ConfidentialUSDT: CUSDT, FraudOracle: ORACLE, AgentMandate: MANDATE }, actor: w.address, proofs, generatedAt: new Date().toISOString() };
  writeFileSync(new URL("../../deployments/shield-proofs.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log(`\n✅ ${proofs.length} live Shield proofs -> deployments/shield-proofs.json`);
  proofs.forEach((x) => console.log(`  ${x.step.padEnd(46)} https://sepolia.etherscan.io/tx/${x.txHash}`));
}
main().catch((e) => {
  console.error("\n❌ FAILED:", e.message);
  if (proofs.length) console.error("done:", proofs.map((p) => p.step).join(" · "));
  process.exit(1);
});
