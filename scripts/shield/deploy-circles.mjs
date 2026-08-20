// Deploy extra confidential esusu "circles" (pools) so Àjọ becomes a platform: a directory of
// prize circles, each rated by the shared FraudOracle. Harvests a jackpot on each and flags one.
//   node scripts/shield/deploy-circles.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { JsonRpcProvider, Contract, ContractFactory, HDNodeWallet, hexlify, solidityPackedKeccak256 } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CUSDT = "0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8";
const ORACLE = "0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc";
const MANDATE = "0x5BA600798E834E12b48648488C7eb12d92e0a32c";
const idOf = (a) => solidityPackedKeccak256(["address"], [a]);
const art = (n) => JSON.parse(readFileSync(path.join(root, "artifacts", "contracts", `${n}.sol`, `${n}.json`), "utf8"));

// circles to create (name/theme are frontend metadata; the contract stores none)
const CIRCLES = [
  { name: "Agent Treasury", theme: "Idle-funds autopilot for autonomous agents", jackpot: 500_000000, flag: false },
  { name: "Quick Draw", theme: "Fast daily rounds — small stakes", jackpot: 150_000000, flag: true },
];

async function main() {
  const p = new JsonRpcProvider(RPC);
  const w = HDNodeWallet.fromPhrase(readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim()).connect(p);
  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });
  const gp = ((await p.getFeeData()).gasPrice ?? 2_000_000_000n) * 2n;
  console.log("Deployer:", w.address, "·", (await p.getBalance(w.address)).toString(), "wei\n");
  const A = art("ConfidentialPool");
  const oracle = new Contract(ORACLE, ["function report(bytes32,bytes32,bytes)"], w);

  const out = [];
  for (const c of CIRCLES) {
    const pool = await new ContractFactory(A.abi, A.bytecode, w).deploy(CUSDT, { gasPrice: gp });
    await pool.waitForDeployment();
    const addr = await pool.getAddress();
    console.log(`▶ ${c.name.padEnd(16)} ${addr}  (deploy ${pool.deploymentTransaction().hash})`);
    const pc = new Contract(addr, [
      "function harvestYield(uint64)",
      "function setDepositor(address,bool)",
      "function disclosePublicTotal()",
    ], w);
    await (await pc.harvestYield(c.jackpot, { gasLimit: 2_500_000n })).wait();
    await (await pc.setDepositor(MANDATE, true, { gasLimit: 120_000n })).wait();
    console.log(`   harvested ${c.jackpot / 1e6} cUSDT jackpot · mandate authorised`);
    if (c.flag) {
      const e = await fhe.createEncryptedInput(ORACLE, w.address).add64(70).encrypt();
      await (await oracle.report(idOf(addr), hexlify(e.handles[0]), hexlify(e.inputProof), { gasLimit: 2_000_000n })).wait();
      console.log(`   ⚠ flagged in the fraud oracle (encrypted risk 70)`);
    }
    out.push({ name: c.name, theme: c.theme, address: addr, flagged: c.flag });
  }

  writeFileSync(path.join(root, "deployments", "circles-sepolia.json"), JSON.stringify(out, null, 2));
  console.log("\n✅ saved deployments/circles-sepolia.json");
  console.log("remaining:", (await p.getBalance(w.address)).toString(), "wei");
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
