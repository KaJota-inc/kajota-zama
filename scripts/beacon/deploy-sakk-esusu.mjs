// Deploy Payflow Mandate Beacon — SakkMandate + EsusuMandate — to Sepolia.
//   node scripts/beacon/deploy-sakk-esusu.mjs
//
// Reads the existing deployments/beacon-sepolia.json (MandateAnchor already live) and extends it
// with the two historical-mechanism contracts, so the one-rail-three-mechanisms promise carries
// three Etherscan links. Pattern mirrors scripts/beacon/deploy-mandate-anchor.mjs — same wallet,
// same RPCs, same manifest file, just two more deploys and the allowlists that let the demo
// scripts seal a sakk / an esusu rotation immediately.

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
const MANIFEST = path.join(root, "deployments", "beacon-sepolia.json");

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

async function send(wallet, contract, method, args, label) {
  const fee = await wallet.provider.getFeeData();
  const gasPrice = (fee.gasPrice ?? ethers.parseUnits("2", "gwei")) * 2n;
  const tx = await contract[method](...args, { gasPrice });
  console.log(`  ${label} tx: ${tx.hash}`);
  await tx.wait();
  return tx.hash;
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(
      `${MANIFEST} missing — run deploy-mandate-anchor.mjs first so this script can extend the manifest`,
    );
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!manifest.MandateAnchor?.address) {
    throw new Error(`manifest missing MandateAnchor.address — run deploy-mandate-anchor.mjs first`);
  }
  if (manifest.SakkMandate?.address && manifest.EsusuMandate?.address) {
    console.log("Sakk + Esusu already live:");
    console.log("  SakkMandate: ", manifest.SakkMandate.address);
    console.log("  EsusuMandate:", manifest.EsusuMandate.address);
    console.log("Nothing to do. Remove those entries from the manifest to re-deploy.");
    return;
  }

  const provider = await connect();
  const mnemonic = fs.readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim();
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(provider);
  console.log(
    "Deployer:",
    wallet.address,
    "·",
    ethers.formatEther(await provider.getBalance(wallet.address)),
    "ETH",
  );
  if (wallet.address.toLowerCase() !== manifest.deployer.toLowerCase()) {
    throw new Error(
      `wallet ${wallet.address} does not match manifest deployer ${manifest.deployer}`,
    );
  }

  let sakk = manifest.SakkMandate;
  if (!sakk?.address) {
    sakk = await deploy(wallet, "SakkMandate", []);
    const { abi } = artefact("SakkMandate");
    const sakkContract = new ethers.Contract(sakk.address, abi, wallet);
    console.log("Allowlisting deployer as a sakk payer …");
    sakk.allowPayerTx = await send(
      wallet,
      sakkContract,
      "allowPayer",
      [wallet.address, true],
      "allowPayer",
    );
  }

  let esusu = manifest.EsusuMandate;
  if (!esusu?.address) {
    esusu = await deploy(wallet, "EsusuMandate", []);
    const { abi } = artefact("EsusuMandate");
    const esusuContract = new ethers.Contract(esusu.address, abi, wallet);
    console.log("Allowlisting deployer as an esusu organiser …");
    esusu.allowOrganiserTx = await send(
      wallet,
      esusuContract,
      "allowOrganiser",
      [wallet.address, true],
      "allowOrganiser",
    );
  }

  manifest.SakkMandate = sakk;
  manifest.EsusuMandate = esusu;
  manifest.sakkEsusuDeployedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n✅ patched ${path.relative(root, MANIFEST)}`);

  console.log(
    `  remaining: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`,
  );
  console.log(`\nEtherscan:`);
  console.log(`  MandateAnchor: https://sepolia.etherscan.io/address/${manifest.MandateAnchor.address}`);
  console.log(`  SakkMandate:   https://sepolia.etherscan.io/address/${sakk.address}`);
  console.log(`  EsusuMandate:  https://sepolia.etherscan.io/address/${esusu.address}`);
}

main().catch((e) => {
  console.error("\nDEPLOY FAILED:", e.message);
  process.exit(1);
});
