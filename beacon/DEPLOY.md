# Mandate Beacon inspector — Vercel deploy

Single-page Vite inspector for the three deployed Sepolia Beacon contracts. Static output;
no server runtime needed. Vercel's free Hobby tier is sufficient.

## One-time setup (`vercel link`)

Run from the `beacon/` directory. Needs the Vercel CLI (`npm i -g vercel`) and a logged-in session (`vercel login`).

```bash
cd beacon
vercel link --yes --project kajota-mandate-beacon --scope <your-vercel-team-or-user>
```

That writes `.vercel/project.json` (gitignored) so later deploys know which project to push to.

## Every deploy

```bash
cd beacon
npm run preflight     # sync manifest → typecheck → build; refuses if any step fails
vercel --prod         # pushes dist/ to production
```

The `prebuild` script re-runs `sync-manifest` so `public/beacon-sepolia.json` is always fresh at
build time. If the chain-side manifest (`../deployments/beacon-sepolia.json`) is newer than the
tracked snapshot, the newer one is copied in-place.

## Keeping the manifest fresh

The tracked snapshot (`public/beacon-sepolia.json`) is the authoritative Vercel input. After any
chain-state update — a new anchor from the GitHub Actions cron, another `seal`, a redeploy — do:

```bash
# From repo root
cd beacon
npm run sync-manifest
git add public/beacon-sepolia.json
git commit -m "chore(beacon): sync inspector manifest (anchor #N @ block NNNNNNNN)"
git push
```

If Vercel's git integration is wired to this branch (`hackathon/bli-mandate-beacon`), the push
triggers an automatic preview build. The main-branch deploy stays untouched until the branch
merges, so the submission URL is stable during the hackathon window.

## Local verification before `vercel --prod`

```bash
npm run preview       # serve dist/ on :4173
open http://localhost:4173
```

Click through all three tabs; verify the Esusu "Verify this receipt in the browser" button
prints a hash that matches the on-chain `EsusuMandate.rotationCommit(rotationId)`. If either is
missing, the build picked up a stale manifest — re-run `npm run sync-manifest` and rebuild.

## `vercel.json` highlights

- `framework: "vite"` — Vercel autodetects, but pinning it is defensive.
- `/beacon-sepolia.json` headers: `s-maxage=300, must-revalidate` so the CDN edge caches for
  5 minutes but revalidates on every request. Keeps the inspector showing fresh anchor rows
  within one cron tick, without hammering the origin.
- `/assets/(.*)` headers: `immutable` + 1-year cache for the Vite content-hashed JS/CSS.

## Judging-day URL plan

Target `beacon.kajota.io` behind a Vercel CNAME to the production deploy — one `vercel domains add`
+ a Cloudflare DNS entry. If the custom domain is not ready by Oct 27, the auto-provisioned
`kajota-mandate-beacon.vercel.app` is a fine substitute; the submission form accepts either.

## Troubleshooting

- **`✗ no manifest found at either source or snapshot`** — ran a fresh clone without the
  Sepolia manifest committed. Resolve by running `scripts/beacon/deploy-mandate-anchor.mjs`
  from the repo root, then `cd beacon && npm run sync-manifest`.
- **Build warns "chunks > 500 kB"** — expected; the three.js bundle is 300 kB gzipped.
  Phase B knob is `React.lazy`-splitting the `scenes/` imports behind the 2D/3D toggle.
- **Vercel build fails with "manifest-sync parent missing"** — Vercel only ships `beacon/`
  in the build context. The sync-manifest script no-ops gracefully in that case, using the
  tracked snapshot. If the snapshot itself is missing from the clone, see the first bullet.

Related: `../docs/BEACON_BRIEF.md` §5 (submission package manifest) ·
`../docs/BEACON_PITCH_SCRIPT.md` (the demo video that walks this URL).
