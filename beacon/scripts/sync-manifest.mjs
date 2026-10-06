// Copy the live `deployments/beacon-sepolia.json` into `public/beacon-sepolia.json` so the
// Vite build bundles it. `deployments/` itself is gitignored (environment artefact), but the
// inspector needs the manifest at build time, so this script is the one bridge between the
// chain-side state and the frontend. Run before `pnpm build` / `pnpm dev`.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const src = join(root, "deployments", "beacon-sepolia.json");
const dst = join(here, "..", "public", "beacon-sepolia.json");

if (!existsSync(src)) {
  console.error(`✗ ${src} missing — run scripts/beacon/deploy-mandate-anchor.mjs first`);
  process.exit(1);
}
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`✓ synced ${src} → ${dst}`);
