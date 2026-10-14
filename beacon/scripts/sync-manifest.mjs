// Copy the live `deployments/beacon-sepolia.json` into `public/beacon-sepolia.json` so the
// Vite build bundles it. `deployments/` itself is gitignored (environment artefact), but
// `public/beacon-sepolia.json` is TRACKED so Vercel can build from the beacon/ subdir alone
// without needing the parent deployments/ dir.
//
// Behaviour:
//   - Parent manifest present + fresher → copy it (local dev loop).
//   - Parent manifest missing (Vercel build / fresh clone) → no-op, the tracked snapshot in
//     public/ is used as-is. Hard-fail only when NEITHER exists, since then the inspector
//     has no manifest to render against.

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const src = join(root, "deployments", "beacon-sepolia.json");
const dst = join(here, "..", "public", "beacon-sepolia.json");

const srcExists = existsSync(src);
const dstExists = existsSync(dst);

if (!srcExists && !dstExists) {
  console.error(
    `✗ no manifest found at either source (${src}) or snapshot (${dst}) — run scripts/beacon/deploy-mandate-anchor.mjs first, then this script`,
  );
  process.exit(1);
}

if (!srcExists) {
  console.log(`• parent manifest missing; using tracked snapshot ${dst}`);
  process.exit(0);
}

if (dstExists) {
  const srcMtime = statSync(src).mtimeMs;
  const dstMtime = statSync(dst).mtimeMs;
  if (dstMtime >= srcMtime) {
    console.log(`• snapshot ${dst} is current; no copy needed`);
    process.exit(0);
  }
}

mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`✓ synced ${src} → ${dst}`);
