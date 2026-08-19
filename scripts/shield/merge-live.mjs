// Canonical MERGED deployment: reuse the deployed pool (v3 TWAB + bridge) + cUSDT + oracle, deploy
// a matching AgentMandate (with depositToPool), wire everything, and prove an agent saving into the
// confidential pool on-chain. One cUSDT + one oracle + one mandate + one pool.
//   node scripts/shield/merge-live.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { JsonRpcProvider, Contract, ContractFactory, HDNodeWallet, hexlify } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CUSDT = "0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8";
const ORACLE = "0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc";
const POOL = "0x885843C8110aEe5eFe3c69810ef89790AB74767A"; // v3 TWAB + bridge, already deployed

const artifact = (n) => JSON.parse(readFileSync(path.join(root, "artifacts", "contracts", "shield", `${n}.sol`, `${n}.json`), "utf8"));

async function main() {
  const p = new JsonRpcProvider(RPC);
  const w = HDNodeWallet.fromPhrase(readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim()).connect(p);
  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });
  const gp = ((await p.getFeeData()).gasPrice ?? 2_000_000_000n) * 2n;
  console.log("Deployer:", w.address, "·", (await p.getBalance(w.address)).toString(), "wei\n");

  // deploy matching AgentMandate (has depositToPool)
  const A = artifact("AgentMandate");
  const mandate = await new ContractFactory(A.abi, A.bytecode, w).deploy(ORACLE, CUSDT, 50, { gasPrice: gp });
  console.log("deploy AgentMandate tx:", mandate.deploymentTransaction().hash);
  await mandate.waitForDeployment();
  const MANDATE = await mandate.getAddress();
  console.log("  AgentMandate (merged):", MANDATE);

  const send = async (label, c, m, args, gas) => {
    const tx = await c[m](...args, { gasLimit: gas });
    await tx.wait();
    console.log(`  ✓ ${label.padEnd(30)} ${tx.hash}`);
    return tx.hash;
  };
  const enc = async (contract, val) => {
    const e = await fhe.createEncryptedInput(contract, w.address).add64(val).encrypt();
    return [hexlify(e.handles[0]), hexlify(e.inputProof)];
  };

  const oracle = new Contract(ORACLE, ["function setMember(address,bool)"], w);
  const pool = new Contract(POOL, ["function setDepositor(address,bool)", "function balanceOf(address) view returns (bytes32)"], w);
  const cusdt = new Contract(CUSDT, ["function faucet(uint64) returns (bytes32)", "function setOperator(address,uint48)"], w);
  const mC = new Contract(MANDATE, [
    "function registerAgent(address,bytes32,bytes,uint48,uint32,uint32)",
    "function setMerchant(address,address,bool)",
    "function depositToPool(address,bytes32,bytes) returns (bytes32)",
  ], w);

  console.log("\n── wire the merged system ──");
  await send("oracle.setMember(mandate)", oracle, "setMember", [MANDATE, true], 120_000n);
  await send("pool.setDepositor(mandate)", pool, "setDepositor", [MANDATE, true], 120_000n);
  await send("cUSDT.faucet(10000)", cusdt, "faucet", [10000], 2_000_000n);
  await send("cUSDT.setOperator(mandate)", cusdt, "setOperator", [MANDATE, 281474976710655n], 200_000n);
  const [capH, capP] = await enc(MANDATE, 1000);
  await send("mandate.registerAgent", mC, "registerAgent", [w.address, capH, capP, 2_000_000_000, 3600, 50], 1_500_000n);
  await send("mandate.setMerchant(pool)", mC, "setMerchant", [w.address, POOL, true], 120_000n);

  console.log("\n── LIVE bridge: agent saves 500 into the confidential pool for its principal ──");
  const [aH, aP] = await enc(MANDATE, 500);
  const bridgeTx = await send("depositToPool(pool, 500)", mC, "depositToPool", [POOL, aH, aP], 6_000_000n);

  const handle = await pool.balanceOf(w.address);
  const kp = fhe.generateKeypair();
  const start = Math.floor(Date.now() / 1000);
  const eip = fhe.createEIP712(kp.publicKey, [POOL], start, 1);
  const sig = await w.signTypedData(eip.domain, { UserDecryptRequestVerification: eip.types.UserDecryptRequestVerification }, eip.message);
  const res = await fhe.userDecrypt([{ handle, contractAddress: POOL }], kp.privateKey, kp.publicKey, sig.replace(/^0x/, ""), [POOL], w.address, start, 1);
  const bal = BigInt(res[handle] ?? res[handle.toLowerCase()]);
  console.log(`\n✅ decrypted principal's pool balance = ${bal}  ${bal === 500n ? "✔ agent saved into the confidential pool, LIVE" : "⚠ unexpected"}`);

  writeFileSync(path.join(root, "deployments", "ajo-merged-sepolia.json"), JSON.stringify({
    network: "sepolia", ConfidentialUSDT: CUSDT, FraudOracle: ORACLE, AgentMandate: MANDATE, ConfidentialPool: POOL,
    bridgeProofTx: bridgeTx, generatedAt: new Date().toISOString(),
  }, null, 2));
  console.log("saved deployments/ajo-merged-sepolia.json");
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
