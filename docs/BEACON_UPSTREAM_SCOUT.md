# Mandate Beacon — upstream PR scout for playbook move #3

_Scouted 14 Oct 2026. **Halfway deadline: 18 Oct — 4 days.** BLI submit: 01 Nov — 18 days._

The Mandate Beacon write-up needs at least one upstream PR **merged** by 18 Oct to clear playbook move #3 (the Keeperhub-bursar pattern). The PayPal rail has five drafts under `~/Documents/kajota-paypal/docs/upstream-prs/`; this file is the BLI-specific sibling that targets repos the Beacon itself consumes:

- `@chainlink/cre-sdk` → the `cre/` workflow in this repo imports it directly;
- `zama-ai/fhevm` → the parent branch (`hackathon/zama-season4`) relied on FHEVM primitives, and the Beacon's canonical-hash story has a direct analogue in the FHEVM relayer's request-content hashing;
- `viem` / `OpenZeppelin` → tooling we lean on; thin pickings today.

Methodology: `gh issue list --state open` + `gh pr list --state all` on each repo; dropped bodies that are spam, empty, or outside the Beacon's seam. Ranked the remainder by `(merge-probability × beacon-relevance × size)` where size prefers one-line fixes a judge can read in a tweet.

---

## Tier 1 — open this week (bank a merge before 18 Oct)

### 1. `smartcontractkit/cre-sdk-typescript#314` — `preHook` makes every workflow fail with "Unexpected end of JSON input"

- **Author:** @xavio2495 (09 Oct 2026, 0 comments, **unclaimed**).
- **Where:** `packages/cre-sdk/src/sdk/wasm/runner.ts` `RunnerBase.newRunnerHelper` runs `configHandler` (default `JSON.parse(Buffer.from(request.config).toString())`) on **every** phase before dispatching on `request.request.case`. The host sends `preHook`'s `ExecuteRequest` with an empty `config`, so `JSON.parse('')` throws before the hook ever runs.
- **Fix shape:** skip config parsing on the preHook phase — gate `configHandler` on `request.request.case !== 'preHook'`, or short-circuit when `request.config` is empty. The issue author explicitly offered to let someone else open the PR.
- **LOC:** ~5–8 + 1 test.
- **Capability or correctness:** correctness (bug blocks a declared feature).
- **Merge probability:** **HIGH.** Repo has merged 8/11 recent PRs (73%); the external-contributor PR #319 was approved by a maintainer in 12 days; the fix is small, mechanical, and the diagnosis is already pinned to a single file:line in the issue.
- **Beacon relevance:** DIRECT — Beacon's `cre/workflow.ts` doesn't use `preHook` today, but the SLA-breach v2 write path will (that's the hook where `emitSLABreach` guards would live). Opening this clears v2's blocker and takes the opportunity to cite the host-defect in the BLI write-up.
- **Open the PR:**

```bash
gh repo fork smartcontractkit/cre-sdk-typescript --clone && cd cre-sdk-typescript && \
  git checkout -b fix/prehook-config-parse-314 && \
  # Edit packages/cre-sdk/src/sdk/wasm/runner.ts per the issue — gate configHandler on request.request.case
  # Add packages/cre-sdk/test/preHook-empty-config.test.ts covering the regression
  bun test && bun run build && \
  git add -A && git commit -m "fix(runner): skip config parse on preHook phase (#314)" && \
  git push -u origin fix/prehook-config-parse-314 && \
  gh pr create --repo smartcontractkit/cre-sdk-typescript \
    --title "fix(runner): skip config parse on preHook phase (#314)" \
    --body "Fixes #314. Root cause and fix shape are both in @xavio2495's issue body — this PR mirrors the SDK-side option they described, leaving the host-side alternative out of scope."
```

### 2. `zama-ai/fhevm#2229` — relayer: canonicalize list ordering in request content hashes

- **Author:** @abc (01 Apr 2026, 0 comments, **unclaimed**).
- **Where:** `relayer/src/core/public_decrypt_request.rs` and `relayer/src/core/user_decrypt_request.rs` hash list fields (`ct_handles`, `contract_addresses`, `ct_handle_contract_pairs`) in incoming order. Two semantically-equivalent requests with different list orderings produce different `job_id`s, defeating the relayer's own deduplication contract. There is already a `TODO: Consider canonical ordering for list items.` comment at both call sites.
- **Fix shape:** sort each list field before hashing. Hex-order the handles and lexicographic-order the addresses. Add a test proving `hash({a, b}) == hash({b, a})`.
- **LOC:** ~10 across two files + 2 tests.
- **Capability or correctness:** correctness (dedup contract violation).
- **Merge probability:** **MEDIUM** — the issue has sat 6 months, but the TODO comment in the code pre-authorises the direction, and the fix is impossible to argue against on correctness grounds. The length of time more likely reflects maintainer bandwidth than controversy.
- **Beacon relevance:** **PITCH-DEFINING.** This issue IS the Beacon's canonical-hash primitive, played at the FHEVM relayer layer. Merging it lets the BLI write-up cite "we extended the same canonical-ordering invariant our Mandate Beacon enforces into the FHEVM relayer upstream" — a direct playbook move #2 bonus (named defect in the HOST project).
- **Open the PR:**

```bash
gh repo fork zama-ai/fhevm --clone && cd fhevm && \
  git checkout -b fix/relayer-canonical-list-ordering-2229 && \
  # Sort list fields before hashing in both request_hash functions
  # Add a test demonstrating hash({a, b}) == hash({b, a})
  cargo test -p relayer && \
  git add -A && git commit -m "fix(relayer): canonicalize list ordering in request content hashes (#2229)" && \
  git push -u origin fix/relayer-canonical-list-ordering-2229 && \
  gh pr create --repo zama-ai/fhevm \
    --title "fix(relayer): canonicalize list ordering in request content hashes (#2229)" \
    --body "Fixes #2229. Resolves the TODOs in public_decrypt_request.rs and user_decrypt_request.rs by sorting list items before hashing. Honours the dedup contract documented in the relayer tests."
```

---

## Tier 2 — pile-on signal (not our authorship but citeable)

### 3. `smartcontractkit/cre-sdk-typescript PR #319` — Fix default namespace in getSecret errors

- **Author:** @ChrisWozniak (NONE association, 12 Sep 2026).
- **State:** APPROVED by maintainer 24 Sep; awaiting merge-queue. Chris commented "Thanks for the review and approval!" that same day; three weeks later, still open.
- **Why cite:** proves the repo accepts outside correctness fixes and the lane is open. Watch for merge any day; if it lands between now and 01 Nov, add a line to BEACON_BRIEF §5 — "the SDK our Beacon workflow imports accepts outside correctness fixes; our own #314 PR follows the same lane."

### 4. `smartcontractkit/cre-sdk-typescript PR #316` — add `newTestTEERuntime`

- **Author:** @xavio2495 (same contributor who filed #314), 08 Sep 2026.
- **State:** OPEN, not yet reviewed.
- **Not our lane** — we would be duplicating authorship. Observe only.

---

## Tier 3 — Zama-adjacent correctness bugs (second shot if Tier 1 stalls)

### 5. `zama-ai/fhevm#3936` — `assertIsUint128` validates against uint256 bound

- **Author:** @abc (14 Sep 2026, 2 comments).
- **Where:** `sdk/js-sdk/src/core/base/uint.ts`. `assertIsUint128` calls `isUint256` instead of `isUint128`, while still reporting `expectedType: 'uint128'`. The sibling `assertIsUint8`/`16`/`32`/`64`/`256` all call the matching guard.
- **Fix shape:** one-character edit (`isUint256` → `isUint128`) + a regression test.
- **LOC:** ~1 + 1 test.
- **Capability or correctness:** correctness (type-contract violation).
- **Merge probability:** HIGH — undeniable one-character slip, pre-authorised by five sibling functions.
- **Beacon relevance:** indirect — the Beacon's commitments use `uint64`, not `uint128`, but the pattern (one-off slip in a canonical validator) is exactly the kind of thing the Beacon's own cross-repo fixture asserts against. Opening it is a cheap second shot if #314 or #2229 stall.

### 6. `zama-ai/fhevm#3076` — `CoreFhevm.init()` memoizes failure, wedging the client

- **Author:** @abc (09 Jul 2026, 0 comments).
- **Fix shape:** cache the resolved promise only on success; cache the rejection as `null` so subsequent calls retry.
- **Capability or correctness:** correctness (DoS surface).
- **Merge probability:** MEDIUM-HIGH — specific failure mode, no architectural debate.
- **Beacon relevance:** low. Keep as a third-tier backup.

---

## What's intentionally not here

- **`wevm/viem#5048`** (`isHex` nibble count) — three contributors already claiming it; piling on is bad form.
- **`NomicFoundation/hardhat`** — no `status:ready` open issues that match the Beacon seam.
- **`OpenZeppelin/openzeppelin-contracts`** — no `type: feature` open issues; the Beacon uses plain Solidity patterns and no OZ dependency surfaces today.
- **`smartcontractkit/cre-sdk-go`** — zero open issues as of today's scout.

---

## Recommended action, in order

1. **Today (14 Oct):** open **#314** on cre-sdk-typescript. Highest merge-probability lane with a fast-cadence repo. If merged by 18 Oct this clears playbook move #3 alone.
2. **This week (by 17 Oct):** open **#2229** on fhevm. Slower repo, higher pitch alignment. Even if not merged by 18 Oct, having it OPEN by halfway counts as "actively engaged upstream" per [[feedback_winner_teardown_keeperhub]]'s bursar precedent.
3. **If #314 stalls past 20 Oct:** open **#3936** on fhevm as a second-shot one-liner.
4. **Monitor #319 daily** — if it merges, cite in BEACON_BRIEF §5 under "the SDK our Beacon workflow imports".

Related: [[hackathon_winning_playbook]] (§move 3) · [[feedback_winner_teardown_keeperhub]] (bursar bank-a-merge pattern) · [[project_bli_legal_tech_2]] (Day-13 state) · `~/Documents/kajota-paypal/docs/upstream-prs/BACKLOG_SCOUT.md` (the sibling scout for the PayPal rail).
