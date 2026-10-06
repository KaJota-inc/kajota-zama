# Mandate Beacon — BLI Legal Tech Hackathon 2 submission brief

**Deadline:** 2026-11-01 02:01 UTC (26 days from 2026-10-06).
**Target submit:** 2026-10-27 (5-day buffer per [[hackathon_winning_playbook]]).
**Branch:** `hackathon/bli-mandate-beacon` on `KaJota-inc/kajota-zama` (base: `hackathon/zama-season4`).
**Pool:** $20K (page caveats "still developing"); plan around a $10–12K floor.

> This file is the internal source-of-truth. The 2 000-character Devpost paste lives in the "Submission form text" section below, verbatim. Do not edit the paste in place — regenerate it from the longer sections above whenever anything upstream changes.

## 1. Rule-0 pitch (verbatim)

> **Payflow Mandate Beacon — a Chainlink-CRE-anchored direct-debit mandate registry that makes CBN consumer-dispute SLAs enforceable on-chain, without exposing customer PII.**

Slot-fill: `<CBN CPR 2019 + 2026 CBN/NCC draft 24-hour-refund framework>` + `<Chainlink-CRE workflow anchoring a redacted, replay-safe, regulator-verifiable mandate ledger>`.

## 2. The named host-protocol defect

CBN's NIP mandate specification publishes **no replay-safety primitive** for duplicate debits inside the SLA window. A compromised agent, or a merchant integration with retry-at-ambiguity semantics, can settle the same mandate twice before the dispute window has even opened. The fix:

- **Server-authored idempotency key**: `keccak256(canonicalMandate ‖ amount ‖ creTickBucket(5-min))`. The client cannot author it; a replay inside the bucket collides regardless of what mandate id the client minted.
- **Server-assigned occurrence counter**: the second attempt routes to `DuplicateRouted`, bumps the counter, and never overwrites the original Mandate record.
- **Sanctions-list version pinning** at ingest, so a regulator-replay never follows a drifted "current" list — the audit reproduces against the snapshot in force at ingest.

Honest adjacency: this is the same defect family **PocketChange's A2P2 §7** call-out named (A2P2 cumulative spend across delegation chain + replay inside token TTL) — different host, same shape. Cite it before someone else does.

## 3. Three mechanisms on one rail (one-rail promise per [[feedback_history_3d_hack_approach]])

Each mechanism is a plain-Solidity contract sharing the same role scaffolding (owner → allow-listed principal → guardian kill-switch) and the same regulator-verifiable public audit style. **26 tests passing on `hackathon/bli-mandate-beacon`.**

### MandateAnchor — CBN consumer-dispute mandate (11 tests · `fb3771c..` → inherited at `77141c6`)

Napoleonic 1804 lineage of direct-debit authority, modernised. A posting bank commits a redacted customer envelope hash, the server-authored idempotency key, the SLA deadline (CBN CPR 2019, 24 hours) and the pinned sanctions-list snapshot. Replay inside the TTL routes to `DuplicateRouted`. A missed SLA is callable by anyone via `emitSLABreach(mandateId)` — the regulator-verifiable chain is public; the gate is the deadline, not the caller. Canonical commitment is byte-identical to Payflow's `src/payflow/mandate/` Python mirror.

### SakkMandate — Abbasid sealed Islamic banking instruction (7 tests · HEAD `db967a3`)

10–11th century `صك` cross-city payment instruction, modernised. The payer seals a commit (`keccak256(abi.encode(mandateBody, nonce))`), a pre-arranged witness quorum attests, the beneficiary opens the pre-image. Historical failure: cross-city coordination could not scale under Mongol-era trade disruption, and physical-seal replay was undetectable. On-chain witnessing fixes both — replay fails by status, forgery fails by hash.

### EsusuMandate — Yoruba rotating-savings mandate (8 tests · HEAD `fb3771c`)

Pre-colonial West African rotating credit association, modernised. The organiser seals a rotation of N members and a fixed collector order; each cycle, every member attests their contribution and the designated collector sweeps the pot once the attestation set is full. Historical failure: informal ajo keepers absconded with early-cycle contributions or quietly reshuffled the collector order (chit funds banned 1905; modern Lagos operators default on ~1 in 20 rotations). On-chain fix: `rotationCommit = keccak256(abi.encode(members, order, contrib, cycleLen))` is pinned at seal, and no path rewrites it.

## 4. Hard-parts table (seven scars, each with a reproducer)

| # | Scar | How solved | Verify |
|---|---|---|---|
| 1 | Replay inside the TTL | Server-authored idempotency key; `DuplicateRouted` with occurrence bump | `scripts/beacon/failure_modes/replay-within-ttl.ts` |
| 2 | mandateId collision across chains | Same-chain collision preserves earliest record; emits `DuplicateRouted(mandate-id-collision)` | `scripts/beacon/failure_modes/mandate-id-collision.ts` |
| 3 | SLA breach missed by callers | `emitSLABreach(mandateId)` is permissionless; only gate is the deadline | `scripts/beacon/failure_modes/sla-breach.ts` |
| 4 | Sanctions-list drift between ingest and replay | `sanctionsListVersion` pinned at post; mutable `status` excluded from the commitment hash so settlement does not rewrite audit lineage | `test/beacon/MandateAnchor.ts` |
| 5 | Rotating-savings organiser rewrites collector order | `rotationCommit` fixed at seal; no path updates `_collectors[]` after inception | `test/beacon/EsusuMandate.ts` |
| 6 | Sakk cross-city witness race | k-of-n quorum pinned at seal; `attest()` is one-shot per witness, forgery fails the pre-image hash | `test/beacon/SakkMandate.ts` |
| 7 | Cross-rail commitment drift | Payflow `src/payflow/mandate/` Python mirror consumes `scripts/beacon/export-commitment-fixtures.ts` fixtures; byte-identical keccak | Payflow `52f23e0`, 232 tests, 3 fixtures |

## 5. Submission package manifest

| Artefact | State | Owner (user vs me) |
|---|---|---|
| 26 beacon tests passing | ✅ `fb3771c` | me |
| Deploy script → sepolia + galileo | ✅ `5ac748f` + `scripts/beacon/deploy-sakk-esusu.mjs` | me |
| **MandateAnchor LIVE on Sepolia** | ✅ [`0x7A4C…2504`](https://sepolia.etherscan.io/address/0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504) · anchor #1 @ block 11858585 | ✅ |
| **SakkMandate LIVE on Sepolia** | ✅ [`0x0949…49c1`](https://sepolia.etherscan.io/address/0x0949aAa551d2Ea18D18b48D36063C9d7ce8349c1) · [seed seal](https://sepolia.etherscan.io/tx/0xeb6361408fadea77966e8610986699067e6d12c58f27e4636a7617ff3ec55114) @ block 11858671 | ✅ |
| **EsusuMandate LIVE on Sepolia** | ✅ [`0x4634…b9fd`](https://sepolia.etherscan.io/address/0x463463D0eE28fEdE89525cc28A261301f14Ab9fd) · [seed seal](https://sepolia.etherscan.io/tx/0x6a8fc41d2242dc360a1a0b9b7c1172c029cfe67090eac5c8a1ff43d9efd8b2d1) @ block 11858672 | ✅ |
| Etherscan source verification (all 3) | ⬜ `npx hardhat verify --network sepolia <addr>` once `ETHERSCAN_API_KEY` is set | user to set key; me to run |
| Chainlink CRE workflow YAML | ⬜ Oct 11 target per project memory | me (next) |
| 3D scene + action HUD per [[feedback_history_3d_hack_approach]] | ⬜ | me |
| ≤3 min demo video (owner's voice, 1.0× trim only) | ⬜ | user+me |
| Devpost submission form walk per [[feedback_submission_form_rules_first]] | ⬜ | user |
| 2 000-char Devpost paste | ⬜ (see §7 below) | me |
| Live hosted inspector URL | ⬜ kajota-hub route planned (`beacon` slot) | me+user |

## 6. Decision gates still open

- **Oct 11** — Chainlink CRE workflow ships green or Chainlink CRE $2K bounty drops (optional, not Rule-0 anchor).
- ~~**Oct 20** — all three contracts verified on 0G Galileo or Arb Sepolia.~~ ✅ **done 2026-10-06** — three live Sepolia addresses now carry the Rule-0 pitch's "verify on Etherscan" links.
- **Oct 27** — target submit, 5-day buffer.
- **Oct 28** — kajota-paypal retrofit go/no-go, per `~/Documents/kajota-paypal/docs/planning/mandate-beacon-reuse-brief.md`.

## 7. The 2 000-character Devpost paste (first draft, 1 823 chars)

> **Mandate Beacon — regulator-verifiable payment-dispute SLAs, without the PII leak.**
>
> Nigerian consumer-protection law (CBN CPR 2019; CBN × NCC 2026 draft 24-hour-refund framework) obliges banks to resolve failed-transfer disputes inside tight windows. The NIP mandate protocol publishes no replay-safety primitive: an agent or a retry-at-ambiguity integration can settle the same debit twice inside the dispute window before the clock has even started. Mandate Beacon closes the gap on-chain, keeping customer PII off-chain.
>
> The primitive is a public, regulator-verifiable mandate registry. A posting bank commits a redacted envelope hash, a server-authored idempotency key (keccak over canonical mandate ‖ amount ‖ 5-min CRE tick), an SLA deadline, and a pinned sanctions-list snapshot. Replay inside the TTL routes to DuplicateRouted — human approval owns the next step, never auto-settle. SLA breach is permissionless; the deadline is the gate, not the caller.
>
> Three historical mechanisms share one rail. MandateAnchor is the modern direct-debit shape (Napoleonic 1804 lineage, 11 tests). SakkMandate is the 10–11c Abbasid sealed instruction, revived with on-chain witnessing (7 tests). EsusuMandate is the Yoruba rotating-savings mandate, revived with an on-chain rotation commit so no organiser reshuffles the collector order after inception (8 tests). 26 passing on `hackathon/bli-mandate-beacon`.
>
> Cross-repo: Payflow's Python canonical hasher consumes a stable fixture set from the Solidity side and asserts byte-equality (232 tests). The AP2 Payment Mandate adaptation ships separately on `kajota-paypal feat/mandate-beacon-ap2-plug` — same primitive, Reg E 12 CFR 1005.11 anchor instead of CBN CPR 2019.
>
> Honest adjacency: PocketChange's A2P2 §7 call-out names the same defect family in Google's Agent Payments Protocol. Different host, same shape — different sovereign regulators, same mandate replay surface.

**Char count: 1 823.** Headroom for a link row + a "verify on Arbiscan" line once deployed.

## 8. What we got wrong first ([[hackathon_winning_playbook]] move #7)

- **Oct 4 SKIP decision** was correct given the then-blank state of Payflow (65-day dormant, no deployed healthz, no real-bank CSV eval). Oct 5 override was correct — the pitch shifted from "Payflow-forward" to "Beacon-on-one-rail" — but the override meant we lost Day-1 and Day-2 of a 27-day window to re-planning.
- **Zama S4 docs inheritance** carried over to this branch unchanged. We only noticed at Day-4 that `docs/SUBMISSION.md`, `docs/PITCH_SCRIPT.md`, `docs/DEMO.md` are all Zama S4 artefacts — not BLI. Fix: this file. All BLI docs land under `BEACON_*.md`.
- **The 3-mechanism promise was 2/3 for three days.** The one-rail-N-mechanisms shape per [[feedback_history_3d_hack_approach]] is only credible when all three are green. Esusu landing on Day-4 (`fb3771c`) completes it. **Lesson: a half-shipped historical-mechanism rail reads as a scoped-down pitch, not a crescendo.**
- **The anchor-runner GitHub secret was briefly the literal string `"-"`.** The first `gh secret set DEPLOYER_MNEMONIC --repo … --body -` set the secret to a one-character dash, because `gh`'s `-b/--body` treats `-` as a literal value, not a stdin sentinel. The next workflow run failed cleanly with ethers' *"invalid mnemonic length (argument=\"mnemonic\", value=\"[ REDACTED ]\")"*. Fix: pipe the file into `gh secret set` without `--body`, so stdin is read. **Lesson: a sentinel's semantics is tool-specific — verify the flag against the help text before passing a credential-shaped value, especially when the tool silently rewrites the error to protect secrets. The REDACTED value here was both the smoking gun and the thing hiding it.** Caught in run `37537524027` before the second attempt landed anchor #2.
- **The anchor-runner workflow was first committed only to `hackathon/bli-mandate-beacon`.** Both `workflow_dispatch` and `schedule` require the workflow file to be on the repository's default branch — a GitHub security property, not documented inline. First `gh workflow run` returned HTTP 404 with *"workflow … not found on the default branch"*. Fix: cherry-pick only the YAML to `main` and keep the job's `if: github.ref == 'refs/heads/hackathon/bli-mandate-beacon'` clause so the workflow is inert everywhere else. **Lesson: a CI feature's gates are not always symmetrical — a *write* permission on a working branch does not imply a *run* permission for events the central scheduler owns.**
- **Shield's `AgentMandate.sol` was almost inherited into a regulator-verifiable rail.** The Day-1 plan said *"fork AgentMandate.sol."* The actual contract leans on `@fhevm/solidity/lib/FHE.sol`, `euint64`, and encrypted-balance operations because its home domain is confidential agent-spending in [[project_zama_season4]]. For a regulator-verifiable mandate the opacity actively hurts the pitch — a regulator wants to audit, not stay blind. Fix: do not inherit; mirror the role scaffolding (payer / guardian / kill-switch) in plain Solidity, keep state public. **Lesson: inheritance across sibling-primitive codebases is contagious when the parent primitive's invariants diverge from yours. Mirror the pattern, port the shape, re-author the state.**

Related: [[project_bli_legal_tech_2]] · [[project_paypal_ai_hackathon]] · [[hackathon_winning_playbook]] · [[feedback_history_3d_hack_approach]] · [[feedback_scout_the_field_before_positioning]] · [[feedback_submission_form_rules_first]] · [[feedback_winner_teardown_keeperhub]].
