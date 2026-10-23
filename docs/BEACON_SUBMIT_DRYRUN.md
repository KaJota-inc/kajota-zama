# Mandate Beacon — submission dry-run checklist

**Deadline:** 2026-11-01 02:01 UTC · **Target submit:** 2026-10-27 (5-day buffer) · **Updated:** 2026-10-23.

The one rule that governs this file: *open the submission FORM and click every step BEFORE finalising* ([[feedback_submission_form_rules_first]]). This runbook is designed to be walked **twice** — once at the T-5 dry-run, once at submission. Boxes stay empty until physically verified against the live surface.

Submission URL: https://dorahacks.io/hackathon/legal-hack-2026/submit *(verify with user; the dorahacks pattern is to require a logged-in BUIDL post)*

---

## T−48h gate (2026-10-30) · green or defer

Each item needs an unambiguous ✅ or the submission moves to the next business day. No "mostly green" rolls into the form.

- [ ] **Playbook move #3 posture resolved.** PR #326 either MERGED (full credit) or OPEN with a dated nudge comment ≥48h old (bursar-precedent — "actively engaged upstream" per [[feedback_winner_teardown_keeperhub]]). Write-up language locks to whichever.
- [ ] **Three live Sepolia contracts** verified by Etherscan source-verify (`npx hardhat verify`), not just deployed. Addresses:
  - MandateAnchor `0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504`
  - SakkMandate `0x0949aAa551d2Ea18D18b48D36063C9d7ce8349c1`
  - EsusuMandate `0x463463D0eE28fEdE89525cc28A261301f14Ab9fd`
- [ ] **Anchor roster ≥ 20 entries** across all four event colours (fresh/settled/replay/breached). Current snapshot: 10. The 6-hourly cron adds 4/day so by Oct 30 the natural count is ~34; verify not stalled.
- [ ] **Vercel inspector LIVE** at `kajota-mandate-beacon.vercel.app` (or custom domain if CNAMEd). URL responds 200, 3D toggle works, Esusu "Verify this receipt" button prints a hash matching on-chain `rotationCommit`.
- [ ] **kajota-hub route LIVE** at `kajota-hub.onrender.com/beacon/`. hub PR #25 merged + Render redeployed.
- [ ] **Demo video uploaded** to YouTube as **Unlisted**, marked "Not for Kids", duration ≤ 3:00 verified by `ffprobe`. Not atempo — any trim done at 1.0× by dropping/shortening lines.
- [ ] **BEACON_BRIEF §7 Devpost paste** stripped of markdown-only glyphs (no `**` or `[]()` the form field might not render); character count re-measured against the form's own max (common: 2 000 or 2 500).
- [ ] **Link-smoke CI green** on the last `hackathon/bli-mandate-beacon` push. If red, fix before the walk.
- [ ] **BLI preflight CI green** on same push. Solidity-tests + inspector-preflight must be ✓ (cre-typecheck is advisory per entry #10).

---

## Form-walk notes · pass 1 (T−5, dry-run — 2026-10-27)

Click every field on the live submission form. For each, note the field name, the character/word limit if any, the file-upload format if any, and whether the hackathon rules (not just the form) impose a hidden constraint.

### Repository fields

- [ ] **GitHub repo URL** — paste `https://github.com/KaJota-inc/kajota-zama/tree/hackathon/bli-mandate-beacon`. Confirm the link resolves to the branch's README (not main's Àjọ README). The branch's README was shipped `0f2cc19`; smoke-check against the live URL after push, not just locally.
- [ ] **License** — repo root is MIT; verify branch inherits (check `LICENSE` at branch HEAD).
- [ ] **Primary contract address** — paste MandateAnchor `0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504`. If the form only accepts ONE, use this; cite the other two in the body.

### Pitch fields

- [ ] **Title** — "Payflow Mandate Beacon". Avoid "Kajota" prefix (judges don't know the brand); the pitch leads with the primitive, not the org.
- [ ] **Tagline / one-liner** (usually ≤ 100 chars) — "Regulator-replayable payment-dispute SLAs — three historical mechanisms, one on-chain rail, zero PII on-chain." 118 chars; **trim to ≤ 100 if the form rejects**. Fallback: "Regulator-replayable NIP mandate SLAs — three historical mechanisms, one on-chain rail." (89 chars)
- [ ] **Full description / write-up** — the 1,858-char paste from BRIEF §7. Verify form's own max before pasting; if ≤ 1,500, trim the "Cross-repo" paragraph; if ≥ 2,500, extend with the §9 Hustle-Engine linkage paragraph.
- [ ] **How we built it / stack** — Solidity + Hardhat + ethers v6 + Chainlink CRE + Zama FHEVM lineage (branch base) + Vite + React 18 + react-three-fiber + viem. Dedicated field or a sub-section of description; depends on form.
- [ ] **Track selection** — LegalTech & RegTech. Verify from the official track list; don't guess.
- [ ] **Chainlink CRE bounty** opt-in — tick if the form has it. Cite `cre/workflow.ts` + `cre/README.md`.

### Media fields

- [ ] **Demo video URL** — YouTube Unlisted. Confirm playback in incognito (judges can't see Private). Not for Kids ticked.
- [ ] **Hero image / cover** — 1280×720 or form-specified. Use the inspector 3D-scene screenshot (Esusu ring with gold collector) via a QuickTime capture; export at the required ratio. Alt option: a mermaid-render of the architecture diagram at 1280×720.
- [ ] **Screenshots** — the five scenes: hero, MandateAnchor tab, SakkMandate tab, EsusuMandate tab with verifier expanded, hub-route index. Each 1280×720.

### Contact / team fields

- [ ] **Team members** — solo. Don't invent collaborators to pad.
- [ ] **Email** — `oluwaboriife@gmail.com`.
- [ ] **Nigerian geography** — the form may ask for country / organisation / academic affiliation. Nigeria / independent / none unless Imperial × York PhD lane applies by then.
- [ ] **Social links** — GitHub `bori7`; optionally the Hustle Engine artifact as a strategy pointer.

### Agreement fields

- [ ] **ToS / IP acknowledgement** — read, don't skim. Dorahacks's BUIDL ToS sometimes requires original-work certifications that affect reuse-disclosure wording.
- [ ] **Reuse / prior-work disclosure** — if the form asks: honest, "Branch inherits scaffolding from parent `hackathon/zama-season4` (Àjọ submission); every file under `contracts/beacon/`, `beacon/`, `cre/`, `scripts/beacon/`, and `docs/BEACON_*.md` is new for this submission."

### Hidden-rule risks ([[feedback_submission_form_rules_first]])

- [ ] **Video speed** — Zama bans atempo-sped-up voice; most hackathons silently flag or disqualify. BLI's own rules TBC — read verbatim; if the rule is "normal speed only", the pitch script's 2:55 is already at 1.0×, confirm.
- [ ] **AI voice ban** — [[feedback_realvoice_demo_video]]. Zama bans; BLI unknown; verify from the form, not the announcement page. Default plan is real-voice recording per BEACON_PITCH_SCRIPT.md.
- [ ] **Hosting constraints** — some events require a self-hosted URL, others accept Vercel; `kajota-mandate-beacon.vercel.app` is accepted on every event studied so far. Hub route is a vanity sibling.
- [ ] **Name format** — some events reject project names with special characters; "Payflow Mandate Beacon" is safe.
- [ ] **Chainlink CRE bounty prerequisites** — their rules may require a specific tag or opt-in checkbox; don't assume the main track qualifies.

---

## Form-walk notes · pass 2 (T−1, submission eve — 2026-10-26)

Repeat the walk end-to-end. **Nothing in pass 1 carries over.** Fields may have changed; the form rules may have changed; your own answers may have improved. Note any delta since pass 1.

- [ ] Walked every field, no delta from pass 1
- [ ] Walked every field, deltas captured here:
  - *(empty)*

Any delta reopens the T−48h gate — do not submit under time pressure if a new field or a new rule needs new work. Submit the next day if needed; the 5-day buffer absorbs one slip.

---

## Submission-day runbook (T=0, 2026-10-27 target)

Timed, in order. No reordering.

1. **09:00 WAT** — re-run `scripts/beacon/link-smoke.sh` on `README.md` + the four BEACON_*.md docs. All six must pass before any form interaction.
2. **09:15** — pull latest `hackathon/bli-mandate-beacon`, confirm 0 unpushed commits.
3. **09:20** — spot-check the live inspector URL and the hub route in **two** browsers (Safari + Chrome, incognito on both). Verify Esusu's in-browser verifier prints a hash matching the on-chain `rotationCommit`.
4. **09:30** — paste every answer into the form from the dry-run notes. **Do not re-write live.**
5. **09:50** — before Submit, click out of the form and back in to confirm the draft persisted (dorahacks has lost drafts before).
6. **10:00** — hit Submit. Screenshot the confirmation page immediately.
7. **10:05** — post-submission smoke: hit the public BUIDL URL as logged-out, confirm every link in the pasted write-up resolves.
8. **10:15** — update `project_bli_legal_tech_2` memory with "✅ SUBMITTED <date>, BUIDL #<number>, <url>". Flip `[BLI Legal Tech 2]` in MEMORY.md.
9. **10:30** — post the submission link into any pre-arranged channels (Twitter/X, Discord, Hustle Engine project artifact as the "deployed" state).

If any step fails, abort to the next business day — the buffer is for this.

---

## Post-submission (T+1 onwards)

- [ ] **Monitor cron**. The anchor-runner keeps writing. If a judge checks the roster 10 days after submission, the chain shows accumulating evidence (bursar pattern per [[feedback_winner_teardown_keeperhub]]).
- [ ] **Watch comments / mentor feedback** on the submission page daily. Respond within 24h; silence reads as abandonment.
- [ ] **Secondary channel seeding**. One concise LinkedIn / X post with the demo video + Etherscan links. The Hustle Engine artifact gets a "deployed" row-edit if the user decides on #4 from the Hustle Engine introspection ("deliberate").
- [ ] **Honest-ledger entry** for anything that went wrong on submission day (promoted to [WHAT_WE_GOT_WRONG_FIRST.md](./WHAT_WE_GOT_WRONG_FIRST.md) within the T+2 window).

---

## Known risks captured today

| Risk | Mitigation |
|---|---|
| PR #326 not merged by submit | Write-up locks to "actively engaged upstream" language; cite the open PR by number |
| Vercel deploy pending user | Hub route (if PR #25 merged) is the fallback live surface |
| Demo video not yet recorded | 45 min of user time; script is in [BEACON_PITCH_SCRIPT.md](./BEACON_PITCH_SCRIPT.md); has backup trim lines if the first take overshoots 3:00 |
| Dorahacks form field names change | Pass-2 walk catches this; buffer absorbs the fix |
| cre-sdk `TS2339` surface drifts further | `cre-typecheck` CI stays advisory until the SDK stabilises; see entry #10 |
| Branch inheritance from Àjọ confuses a judge | The branch root README's first paragraph names the parent and links the Àjọ README; no silent reuse |

Related: [[feedback_submission_form_rules_first]] · [[feedback_fact_check_public_posts]] · [[feedback_winner_teardown_keeperhub]] · [[hackathon_winning_playbook]] (§≤3-min demo + §seven moves) · [BEACON_BRIEF.md §5 submission package manifest](./BEACON_BRIEF.md).
