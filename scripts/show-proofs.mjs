// Prints the live on-chain proofs from deployments/sepolia.json as a clean table.
import { readFileSync } from "node:fs";

const d = JSON.parse(readFileSync(new URL("../deployments/sepolia.json", import.meta.url), "utf8"));

console.log(`\n  KaJota Confidential Pay — live on ${d.chainName ?? "Sepolia"} (chainId ${d.chainId})`);
console.log(`  Contract: ${d.contracts.ConfidentialPay.address}\n`);
for (const p of d.onchainProofs) {
  const label = p.action.split("—")[0].trim();
  console.log(`  ✔ ${label.padEnd(24)}  ${p.tx.slice(0, 22)}…  (block ${p.block})`);
}
console.log(`\n  Verify any of them on https://sepolia.etherscan.io\n`);
