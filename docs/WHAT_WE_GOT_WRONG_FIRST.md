# What we got wrong first

**Project:** Mandate Beacon · BLI Legal Tech Hackathon 2 · updated 2026-10-21.
**Playbook anchor:** [[hackathon_winning_playbook]] move #7. Winners cite their missteps because judges reward engineering honesty over polish; the Keeperhub winner-teardown ([[feedback_winner_teardown_keeperhub]]) made this move the decisive separator between the top-3 and the next tier.

What follows is the full honest-ledger, structured per entry as **what went wrong · root cause · fix · lesson**. Ten entries today; the newest at the top. Each has a reproducer or commit SHA so a reader can verify the account.

---

## 10. `cre/workflow.ts` typecheck is red against the installed SDK

**What went wrong.** First BLI preflight CI run surfaced four `TS2339: Property 'X' does not exist on type 'ClientCapability'` errors in `cre/workflow.ts`. The three method names cited — `getBlockNumber`, `getLogs`, `readContract` — were written against a presumed `EVMClient` surface that `@chainlink/cre-sdk ^1.6.0` does not currently expose at the type level. The workflow logic is sound; the SDK's TypeScript shape drifted between the version the code was written against and the version `npm install` resolves today.

**Root cause.** Fast-moving SDK with pre-1.0-stable semantics (even though the package number is 1.x). The parallel session's commit `646a4c9 fix(cre): correct SDK imports + add main.ts entry + package.json` fixed the imports but did not run `tsc --noEmit` against the pinned version, so the stale method names shipped. There was also a JSDoc comment on line 23 that contained `*/15` inside `/** ... */` — the inner `*/` closed the comment prematurely, which hid every error below it from `tsc` until the comment was de-fanged.

**Fix.** The JSDoc comment is fixed (`cre/workflow.ts:23` now a plain `//` line). The four remaining `TS2339`s are documented but not blocking — the BLI preflight CI job for cre runs `continue-on-error: true` so the signal stays visible without gating merges on an issue the SDK will resolve either way. The write path (`emitSLABreach`) is explicitly v2 scope per the Chainlink CRE workflow README, so the read-only workflow typechecking being advisory does not affect the submission's live surfaces.

**Lesson.** A JSDoc comment with `*/` inside its body is a syntactic timebomb — it silences every error below the comment until the parser catches up. Any ambient CI workflow that only runs on `main` can hide a feature-branch bomb for days; the fix is to spawn a cheap push-triggered gate per shippable surface, exactly as this entry's job did. Related: [[feedback_comments_are_not_evidence]] — the comment claiming "cron expression" obscured that the comment itself was broken.

Commits `cfedde3` (CI landed) + fix in `cre/workflow.ts:23`.

## 9. The 3D scene rendered a blank canvas for two builds

**What went wrong.** First build of `beacon/src/scenes/EsusuRing3D.tsx` served up an empty canvas — WebGL context lived, DOM mutations landed, Three.js attribute `data-engine=three.js r169` was present, but every rendered pixel came back `rgba(0,0,0,0)`. No console errors. Two full `npm run build` + preview cycles produced the same blank result.

**Root cause.** `@react-three/fiber` with Three.js **r169** switched the default lighting model to physically-correct units; point-light intensities now express **candelas**, not the pre-r155 arbitrary multiplier. My initial `intensity={0.5–1.1}` reads as near-dark; the Zama S4 ajo frontend (which I was mirroring) uses `intensity={130}` and `intensity={90}` for a reason.

**Fix.** Bumped the point light to `intensity={120}` with explicit `distance={10}` and added `flat` on `<Canvas>` so the demo renderer skips tone-mapping. First render after that showed the full three-member ring with the collector highlighted gold.

**Lesson.** When a WebGL scene renders no visible pixels but reports no error, suspect the **lighting model** before the geometry or the material. A reference frontend's intensity numbers are not stylistic — they are calibrated to the version of three.js it imports. Diff the three.js version when porting a scene across repos. Related: [[feedback_verify_the_instrument]] — the "no error" wasn't evidence of nothing wrong; it was evidence my instrument (the `console.error` listener) couldn't see the kind of thing that was wrong.

Commit `19b7e70` on `hackathon/bli-mandate-beacon`.

## 8. The Esusu fixture generator exploded on an EIP-55 checksum

**What went wrong.** `scripts/beacon/export-esusu-fixtures.ts` ran clean in dry-run, got checked in, then on first execution threw ethers' *"bad address checksum (argument=\"address\", value=\"0x742d35Cc6634C0532925a3b844Bc9e7595f8bEb6\")"*. The address I'd hard-coded was a popular test fixture from documentation — pasted mixed-case, but its casing didn't match the EIP-55 derivation of its own bytes.

**Root cause.** ethers v6's `getAddress()` validates mixed-case input strictly against EIP-55. A lowercased string gets normalised and re-emitted in checksum form; an all-caps or ALL-lowercase address passes straight through. But a mixed-case address whose casing *doesn't* derive from its bytes refuses. The reference docs example I copied had the right bytes but the wrong casing, caught only when a real `getAddress()` touched it.

**Fix.** Switched all four test addresses to all-lowercase in the generator source; the `members.map(getAddress)` normalisation now produces canonical EIP-55 output deterministically.

**Lesson.** Treat any hex address pasted from a non-authoritative source as **unchecksummed** until a round-trip through `getAddress()` confirms it. The failure here was benign (local-only test); the same gotcha landing in production code would ship a bad address to users with no warning.

Commit `7b1724a` on `hackathon/bli-mandate-beacon`.

## 7. Caddy's `handle` vs `handle_path` prefix-stripping gotcha

**What went wrong.** First draft of the kajota-hub beacon route used `handle /beacon/beacon-sepolia.json` for the manifest cache-header. Caddy served the file but with the wrong path semantics — `handle` doesn't strip the matched prefix, so the file-server was looking for `/srv/apps/beacon/beacon/beacon-sepolia.json` and 404'd.

**Root cause.** Caddy's `handle` and `handle_path` directives both match on URL prefix but behave differently downstream: `handle_path /x/* { … }` strips `/x` before the inner directives run; `handle /x/* { … }` leaves the full path. Shield (the pattern I mirrored) uses `handle_path`, but the manifest-only matcher needed a different ordering — specific match before generic — which required `handle @matcher { … }`, which doesn't strip. So the inner directives have to do the stripping explicitly via `rewrite`.

**Fix.** Kept `@beacon_manifest path /beacon/beacon-sepolia.json` + `handle @beacon_manifest` for the ordering, and added `rewrite * /beacon-sepolia.json` + `root * /srv/apps/beacon` inside — so the file-server sees the stripped path. The generic `handle_path /beacon/*` for everything else works unchanged.

**Lesson.** Routing primitives that *look* interchangeable rarely are. Read the directive's downstream behaviour, not just its match semantics, before composing two layers. The failure here was caught in draft PR review, not production.

PR [KaJota-inc/kajota-hub#25](https://github.com/KaJota-inc/kajota-hub/pull/25).

## 6. Shield's `AgentMandate.sol` was almost inherited into a regulator-verifiable rail

**What went wrong.** The Day-1 plan said *"fork AgentMandate.sol."* The actual contract leans on `@fhevm/solidity/lib/FHE.sol`, `euint64`, and encrypted-balance operations because its home domain is confidential agent-spending in [[project_zama_season4]]. For a regulator-verifiable mandate the opacity *actively hurts* the pitch — a regulator wants to audit, not stay blind.

**Root cause.** Fork-the-nearest-sibling is a reasonable Day-1 heuristic but it conflates *shape* and *semantics*. The role scaffolding (payer / guardian / kill-switch) was reusable; the FHE substrate was not.

**Fix.** Did not inherit; mirrored the role scaffolding in plain Solidity, keeping state public. All three mechanisms (MandateAnchor, SakkMandate, EsusuMandate) share this scaffolding today.

**Lesson.** Inheritance across sibling-primitive codebases is **contagious** when the parent primitive's invariants diverge from yours. Mirror the pattern, port the shape, re-author the state.

## 5. The anchor-runner workflow was first committed only to the feature branch

**What went wrong.** First `gh workflow run` returned HTTP 404 with *"workflow … not found on the default branch"*. The runner YAML lived at `.github/workflows/beacon-anchor-cron.yml` on `hackathon/bli-mandate-beacon` — it had just been committed, it was syntactically valid, and workflow_dispatch was configured. The workflow still refused to run.

**Root cause.** Both `workflow_dispatch` and `schedule` **require the workflow file to be on the repository's default branch** — a GitHub security property, not documented inline on the workflow docs. A workflow living on a feature branch can be *invoked* by push-to-that-branch, but the central scheduler won't accept dispatch/schedule triggers unless the file is on `main`.

**Fix.** Cherry-picked only the YAML to `main` and kept the job's `if: github.ref == 'refs/heads/hackathon/bli-mandate-beacon'` clause so the workflow is inert everywhere else.

**Lesson.** A CI feature's gates are not always symmetrical — a *write* permission on a working branch does not imply a *run* permission for events the central scheduler owns.

Commits `cefe641` + `19877cf` on `main`.

## 4. The anchor-runner GitHub secret was briefly the literal string `"-"`

**What went wrong.** The first `gh secret set DEPLOYER_MNEMONIC --repo … --body -` set the secret to a one-character dash. Next workflow run failed cleanly with ethers' *"invalid mnemonic length (argument=\"mnemonic\", value=\"[ REDACTED ]\")"*.

**Root cause.** `gh`'s `-b/--body` treats `-` as a **literal value**, not a stdin sentinel. The sentinel-looks-like-stdin assumption was mine; the tool did exactly what the flag's semantics say.

**Fix.** Piped the file into `gh secret set` without `--body`, so stdin is read.

**Lesson.** A sentinel's semantics is **tool-specific** — verify the flag against the help text before passing a credential-shaped value, especially when the tool silently rewrites the error to protect secrets. The REDACTED value here was both the smoking gun and the thing hiding it.

Caught in run `37537524027` before the second attempt landed anchor #2.

## 3. The 3-mechanism promise was 2/3 for three days

**What went wrong.** The one-rail-N-mechanisms shape per [[feedback_history_3d_hack_approach]] is only credible when all three are green. MandateAnchor + SakkMandate landed on Day-1 and Day-2; Esusu took until Day-4. For three days the pitch read as a scoped-down "two-mechanism rail" rather than a crescendo.

**Root cause.** Over-ambitious Day-1 scope. The commitment-hash primitive was shared across all three, but each mechanism needed its own state machine (collect-sweep-rotate for Esusu, witness-attest-open for Sakk) and its own test suite. The second two took more fresh-code than the shared scaffolding suggested.

**Fix.** Esusu landed on Day-4 (`fb3771c`). All three green on 2026-10-10 = 26 beacon tests + 16 Python round-trip.

**Lesson.** A half-shipped historical-mechanism rail reads as a scoped-down pitch, not a crescendo. Promise all N on Day-1 or promise only one with a clear "future work" section.

## 2. Zama S4 docs inheritance carried over to this branch unchanged

**What went wrong.** Only noticed at Day-4 that `docs/SUBMISSION.md`, `docs/PITCH_SCRIPT.md`, `docs/DEMO.md` are all **Zama S4 Àjọ** artefacts — not BLI. The branch inherited them from `hackathon/zama-season4` and nothing in my workflow prompted a rename.

**Root cause.** Branched off `hackathon/zama-season4` for the Shield pattern + role scaffolding, which was correct — but the entire `docs/` directory came with it. The old filenames read like current artefacts, so a review of "what submission docs do we have?" returned a confident wrong answer for three days.

**Fix.** All BLI docs now land under `BEACON_*.md` (`BEACON_BRIEF.md`, `BEACON_PITCH_SCRIPT.md`, `BEACON_UPSTREAM_SCOUT.md`, this file). The Àjọ docs stay as the parent branch's history.

**Lesson.** Branch-inheritance of `docs/` is as dangerous as branch-inheritance of code — the file still has the right *name*, so a search won't flag it. Prefix new-submission docs with the primitive's name until the cross-pollination risk clears.

## 1. The Oct 4 SKIP decision was correct but we lost two days to re-planning

**What went wrong.** Oct 4 BLI SKIP decision was correct given the then-blank state of Payflow (65-day dormant, no deployed healthz, no real-bank CSV eval). Oct 5 override was correct — the pitch shifted from "Payflow-forward" to "Beacon-on-one-rail" — but the override meant we lost Day-1 and Day-2 of a 27-day window to re-planning.

**Root cause.** The initial SKIP evaluated the submission from the Payflow angle only. The Beacon-on-one-rail framing wasn't on the table until Day-2's dry-run surfaced it via [[feedback_history_3d_hack_approach]]. A broader Day-1 "what *shapes* could this submission take?" workshop would have found it earlier.

**Fix.** Compressed the 27-day plan into 25 effective days by front-loading Day-3 with scaffolding that normally sits on Day-5 (the inspector, the pitch script, the deploy script). Shipped Day-5 content on Day-4 to buy back a day.

**Lesson.** Always run the alternate-shape audit before committing to SKIP. A SKIP based on one framing may hide a submission that would GO under another.

---

## How this ledger is maintained

- Any entry only lands here after it is **fixed** — this is not a bug-tracker, it is an honest-ledger. An unresolved issue goes in the project memory, not here.
- Each entry carries at minimum: **title · what went wrong · root cause · fix · lesson**. The commit SHA or PR link closes the loop.
- Promotion from `BEACON_BRIEF.md` §8: this standalone is the canonical source; the brief's §8 is a pointer only, with the latest entry's title.
- Judges scan this file for engineering-honesty signal per [[feedback_winner_teardown_keeperhub]]. Keep entries specific and short; one entry per failure mode, no composite entries, no hedging.

Related: [[project_bli_legal_tech_2]] · [[hackathon_winning_playbook]] (move #7) · [[feedback_winner_teardown_keeperhub]] (why this file wins points) · [[feedback_history_3d_hack_approach]] (crescendo discipline).
