// Emits ajo/src/poolArtifact.ts from the compiled ConfidentialPool artifact, so the frontend can
// deploy a fresh confidential circle from the browser wallet.  Run after `npx hardhat compile`.
//   node scripts/gen-pool-artifact.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = JSON.parse(
  readFileSync(path.join(root, "artifacts", "contracts", "ConfidentialPool.sol", "ConfidentialPool.json"), "utf8"),
);
const deployAbi = [
  { inputs: [{ internalType: "contract IERC7984", name: "asset_", type: "address" }], stateMutability: "nonpayable", type: "constructor" },
  "function harvestYield(uint64 amount)",
  "function setDepositor(address gateway, bool allowed)",
];
const out = `// AUTO-GENERATED from artifacts/contracts/ConfidentialPool.sol — the compiled bytecode + a minimal
// deploy ABI, so a saver can launch their own confidential circle straight from the browser wallet.
// Regenerate: node scripts/gen-pool-artifact.mjs
export const POOL_BYTECODE =
  "${a.bytecode}";

export const POOL_DEPLOY_ABI = ${JSON.stringify(deployAbi, null, 2)} as const;
`;
writeFileSync(path.join(root, "ajo", "src", "poolArtifact.ts"), out);
console.log("wrote ajo/src/poolArtifact.ts");
