// Seed one demo-grade `seal` on SakkMandate and one demo-grade `seal` on EsusuMandate so each
// deployed contract carries observable state, not just bytecode. Playbook move #1 extended to
// the two historical-mechanism contracts; MandateAnchor's own seeding is handled by
// scripts/beacon/anchor-mandate.mjs on the 6-hour cron.
//
//   node scripts/beacon/seed-sakk-esusu.mjs
//
// Idempotent — if the demo sakkId / rotationId already exists on-chain the call is skipped and
// the Etherscan tx is printed from the manifest. The deployer plays both the sakk payer and the
// esusu organiser (same allowlists are set at deploy time by deploy-sakk-esusu.mjs).

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

function readManifest() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(
      `${MANIFEST} missing — run deploy-mandate-anchor.mjs + deploy-sakk-esusu.mjs first`,
    );
  }
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
}

function writeManifest(m) {
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
}

function artefact(name) {
  const p = path.join(root, "artifacts", "contracts", "beacon", `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
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

async function sendTx(wallet, contract, method, args, label) {
  const fee = await wallet.provider.getFeeData();
  const gasPrice = (fee.gasPrice ?? ethers.parseUnits("2", "gwei")) * 2n;
  const tx = await contract[method](...args, { gasPrice });
  console.log(`  ${label} tx: ${tx.hash}`);
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt?.blockNumber ?? null };
}

async function seedSakk(wallet, manifest) {
  if (!manifest.SakkMandate?.address) throw new Error("manifest missing SakkMandate.address");
  if (manifest.SakkMandate.seedSealTx) {
    console.log(`SakkMandate seed already landed @ ${manifest.SakkMandate.seedSealTx}`);
    return;
  }

  const { abi } = artefact("SakkMandate");
  const contract = new ethers.Contract(manifest.SakkMandate.address, abi, wallet);

  // 10-11c Abbasid sealed instruction demo. One payer, three witnesses, 2-of-3 quorum, a
  // mandate body that reads like the Basra draft the historians cite.
  const sakkId = ethers.id("beacon/demo/sakk/basra-draft-01");
  const bodyText = "Pay to the bearer at Basra the sum of 1000 dinars drawn upon the house of al-Rashid.";
  const bodyBytes = ethers.toUtf8Bytes(bodyText);
  const nonce = 0xdeadbeefn;
  const commit = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["bytes", "uint256"], [bodyBytes, nonce]),
  );
  // Three fixed witness addresses derived from the deployer so the demo is reproducible — a
  // judge replaying the same inputs computes the same addresses. Phase B rotates to real
  // multi-sig witnesses.
  const [w1, w2, w3] = Array.from({ length: 3 }, (_, i) =>
    ethers.HDNodeWallet.fromPhrase(
      fs.readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim(),
      undefined,
      `m/44'/60'/0'/0/${i + 1}`,
    ).address,
  );
  const beneficiary = w3; // the merchant at Basra, in the parlance
  const far = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600);

  console.log(`SakkMandate.seal(${sakkId.slice(0, 10)}…)`);
  const { txHash, blockNumber } = await sendTx(
    wallet,
    contract,
    "seal",
    [sakkId, commit, beneficiary, [w1, w2, w3], 2, far],
    "SakkMandate.seal",
  );

  manifest.SakkMandate.seedSakkId = sakkId;
  manifest.SakkMandate.seedCommit = commit;
  manifest.SakkMandate.seedWitnesses = [w1, w2, w3];
  manifest.SakkMandate.seedBeneficiary = beneficiary;
  manifest.SakkMandate.seedSealTx = txHash;
  manifest.SakkMandate.seedSealBlock = blockNumber;
  console.log(`  → block ${blockNumber}`);
}

async function seedEsusu(wallet, manifest) {
  if (!manifest.EsusuMandate?.address) throw new Error("manifest missing EsusuMandate.address");
  if (manifest.EsusuMandate.seedSealTx) {
    console.log(`EsusuMandate seed already landed @ ${manifest.EsusuMandate.seedSealTx}`);
    return;
  }

  const { abi } = artefact("EsusuMandate");
  const contract = new ethers.Contract(manifest.EsusuMandate.address, abi, wallet);

  const mnemonic = fs.readFileSync(path.join(root, ".secret.mnemonic"), "utf8").trim();
  const members = Array.from({ length: 3 }, (_, i) =>
    ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i + 1}`).address,
  );
  const collectorOrder = [members[1], members[2], members[0]]; // auction result
  const rotationId = ethers.id("beacon/demo/esusu/lagos-market-01");
  const contribution = 100n; // minor units (demo scale)
  const cycleLength = 7n * 24n * 60n * 60n; // one week

  console.log(`EsusuMandate.seal(${rotationId.slice(0, 10)}…)`);
  const { txHash, blockNumber } = await sendTx(
    wallet,
    contract,
    "seal",
    [rotationId, members, collectorOrder, contribution, cycleLength],
    "EsusuMandate.seal",
  );

  manifest.EsusuMandate.seedRotationId = rotationId;
  manifest.EsusuMandate.seedMembers = members;
  manifest.EsusuMandate.seedCollectorOrder = collectorOrder;
  manifest.EsusuMandate.seedContribution = contribution.toString();
  manifest.EsusuMandate.seedCycleLength = cycleLength.toString();
  manifest.EsusuMandate.seedSealTx = txHash;
  manifest.EsusuMandate.seedSealBlock = blockNumber;
  console.log(`  → block ${blockNumber}`);
}

async function main() {
  const manifest = readManifest();
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

  await seedSakk(wallet, manifest);
  await seedEsusu(wallet, manifest);

  manifest.sakkEsusuSeededAt = new Date().toISOString();
  writeManifest(manifest);

  console.log(`\n✅ patched ${path.relative(root, MANIFEST)}`);
  console.log(
    `  remaining: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`,
  );
  console.log(
    `\nEtherscan proof surfaces:`,
  );
  console.log(
    `  Sakk seal:    https://sepolia.etherscan.io/tx/${manifest.SakkMandate.seedSealTx}`,
  );
  console.log(
    `  Esusu seal:   https://sepolia.etherscan.io/tx/${manifest.EsusuMandate.seedSealTx}`,
  );
}

main().catch((e) => {
  console.error("\nSEED FAILED:", e.message);
  process.exit(1);
});
