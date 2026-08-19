// Deploy Kajota Shield to Sepolia: ConfidentialUSDT (rail) + FraudOracle (B) + AgentMandate (A).
//   node scripts/shield/deploy.mjs
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RPCS = ["https://ethereum-sepolia-rpc.publicnode.com", "https://1rpc.io/sepolia", "https://sepolia.drpc.org"];
const THRESHOLD = 50;

function art(name) {
  const p = path.join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  // shield contracts live under contracts/shield/
  const p2 = path.join(root, "artifacts", "contracts", "shield", `${name}.sol`, `${name}.json`);
  const a = JSON.parse(fs.readFileSync(fs.existsSync(p) ? p : p2, "utf8"));
  return { abi: a.abi, bytecode: a.bytecode };
}
async function provider() {
  for (const u of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(u);
      await Promise.race([p.getBlockNumber(), new Promise((_, r) => setTimeout(() => r(new Error("t/o")), 6000))]);
      console.log("RPC:", u);
      return p;
    } catch {
      /* next */
    }
  }
  throw new Error("no RPC");
}
async function deploy(w, name, args = []) {
  const { abi, bytecode } = art(name);
  const fee = await w.provider.getFeeData();
  const gasPrice = (fee.gasPrice ?? ethers.parseUnits("2", "gwei")) * 2n;
  process.stdout.write(`\nDeploying ${name} … `);
  const c = await new ethers.ContractFactory(abi, bytecode, w).deploy(...args, { gasPrice });
  const tx = c.deploymentTransaction();
  console.log("tx", tx.hash);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  ${name}: ${addr}`);
  return { address: addr, txHash: tx.hash };
}

async function main() {
  const p = await provider();
  const mnemonic = fs.readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim();
  const w = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(p);
  console.log("Deployer:", w.address, "·", ethers.formatEther(await p.getBalance(w.address)), "ETH");

  const cusdt = await deploy(w, "ConfidentialUSDT");
  const oracle = await deploy(w, "FraudOracle");
  const mandate = await deploy(w, "AgentMandate", [oracle.address, cusdt.address, THRESHOLD]);

  const out = {
    network: "sepolia",
    chainId: 11155111,
    deployer: w.address,
    threshold: THRESHOLD,
    ConfidentialUSDT: cusdt,
    FraudOracle: oracle,
    AgentMandate: mandate,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(root, "deployments", "shield-sepolia.json"), JSON.stringify(out, null, 2));
  console.log("\n✅ saved deployments/shield-sepolia.json");
  console.log(`  remaining: ${ethers.formatEther(await p.getBalance(w.address))} ETH`);
}
main().catch((e) => {
  console.error("DEPLOY FAILED:", e.message);
  process.exit(1);
});
