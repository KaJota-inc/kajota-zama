// Deploy Payflow Mandate Beacon — MandateAnchor only — to Sepolia.
//   node scripts/beacon/deploy-mandate-anchor.mjs
//
// Prints the deployed address and tx hash, and writes deployments/beacon-sepolia.json.
// Pattern mirrors scripts/shield/deploy.mjs so the operational muscle memory transfers.

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
  "https://sepolia.drpc.org",
];

// CBN CPR 2019 — 24-hour reversal window
const CBN_SLA_SECONDS = 86_400;

function artefact(name) {
  const p = path.join(root, "artifacts", "contracts", "beacon", `${name}.sol`, `${name}.json`);
  const art = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: art.abi, bytecode: art.bytecode };
}

async function connect() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, r) => setTimeout(() => r(new Error("t/o")), 6000)),
      ]);
      console.log("RPC:", url);
      return p;
    } catch {
      /* next */
    }
  }
  throw new Error("no live Sepolia RPC");
}

async function deploy(wallet, name, args = []) {
  const { abi, bytecode } = artefact(name);
  const fee = await wallet.provider.getFeeData();
  const gasPrice = (fee.gasPrice ?? ethers.parseUnits("2", "gwei")) * 2n;
  process.stdout.write(`\nDeploying ${name}(${args.join(", ")}) … `);
  const contract = await new ethers.ContractFactory(abi, bytecode, wallet).deploy(...args, {
    gasPrice,
  });
  const tx = contract.deploymentTransaction();
  console.log(`tx ${tx.hash}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ${name}: ${address}`);
  return { address, txHash: tx.hash };
}

async function main() {
  const provider = await connect();
  const mnemonic = fs.readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim();
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(provider);

  const balance = await provider.getBalance(wallet.address);
  console.log("Deployer:", wallet.address, "·", ethers.formatEther(balance), "ETH");
  if (balance === 0n) {
    throw new Error("deployer has 0 ETH on Sepolia — fund the address and retry");
  }

  const mandate = await deploy(wallet, "MandateAnchor", [CBN_SLA_SECONDS]);

  // Allowlist the deployer as a bank, so the seed-anchor runner can post immediately.
  // Switch-tier framing: in production this would be a switch operator (Remita, Interswitch,
  // NIBSS), not the deployer; for Sepolia seeding they coincide.
  console.log("\nAllowlisting deployer as a bank …");
  const { abi } = artefact("MandateAnchor");
  const contract = new ethers.Contract(mandate.address, abi, wallet);
  const fee = await provider.getFeeData();
  const gasPrice = (fee.gasPrice ?? ethers.parseUnits("2", "gwei")) * 2n;
  const tx = await contract.allowBank(wallet.address, true, { gasPrice });
  console.log(`  allowBank tx: ${tx.hash}`);
  await tx.wait();

  const out = {
    network: "sepolia",
    chainId: 11155111,
    deployer: wallet.address,
    slaWindowSeconds: CBN_SLA_SECONDS,
    MandateAnchor: mandate,
    allowBankTx: tx.hash,
    deployedAt: new Date().toISOString(),
    branch: "hackathon/bli-mandate-beacon",
  };
  fs.mkdirSync(path.join(root, "deployments"), { recursive: true });
  const outPath = path.join(root, "deployments", "beacon-sepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ saved ${path.relative(root, outPath)}`);
  console.log(`  remaining: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`);
  console.log(`\nEtherscan: https://sepolia.etherscan.io/address/${mandate.address}`);
}

main().catch((e) => {
  console.error("\nDEPLOY FAILED:", e.message);
  process.exit(1);
});
