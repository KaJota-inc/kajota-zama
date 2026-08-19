// Standalone Sepolia deploy for Àjọ — Confidential PoolTogether.
// Bypasses hardhat-deploy's interactive pending-tx handling: explicit gas, multi-RPC
// fallback, writes addresses + tx hashes to deployments/ajo-sepolia.json.
import { ethers } from "ethers";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
  "https://sepolia.drpc.org",
];

function loadArtifact(name) {
  const p = path.join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  const a = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: a.abi, bytecode: a.bytecode };
}

async function getProvider() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await Promise.race([p.getBlockNumber(), new Promise((_, r) => setTimeout(() => r(new Error("t/o")), 6000))]);
      console.log("RPC:", url);
      return p;
    } catch (e) {
      console.log("RPC skip", url, e.message);
    }
  }
  throw new Error("all RPCs unreachable");
}

async function deployOne(wallet, name, args = []) {
  const { abi, bytecode } = loadArtifact(name);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const fee = await wallet.provider.getFeeData();
  const gasPrice = (fee.gasPrice ?? ethers.parseUnits("2", "gwei")) * 2n; // pad to clear quickly
  console.log(`\nDeploying ${name} … (gasPrice ${ethers.formatUnits(gasPrice, "gwei")} gwei)`);
  const c = await factory.deploy(...args, { gasPrice });
  const tx = c.deploymentTransaction();
  console.log(`  tx: ${tx.hash}`);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  ${name}: ${addr}`);
  return { address: addr, txHash: tx.hash };
}

async function main() {
  const mnemonic = fs.readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim();
  const provider = await getProvider();
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(provider);
  console.log("Deployer:", wallet.address);
  console.log("Balance :", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

  const cusdt = await deployOne(wallet, "ConfidentialUSDT");
  const pool = await deployOne(wallet, "ConfidentialPool", [cusdt.address]);

  const out = {
    network: "sepolia",
    chainId: 11155111,
    deployer: wallet.address,
    ConfidentialUSDT: cusdt,
    ConfidentialPool: pool,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(root, "deployments", "ajo-sepolia.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nSaved →", outPath);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("DEPLOY FAILED:", e.message);
  process.exit(1);
});
