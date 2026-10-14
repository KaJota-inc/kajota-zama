# Mandate Beacon — pitch script (BLI, real-voice, ≤3:00)

**Purpose:** script for the ≤3-minute demo video the BLI submission requires. Real-person voice only — no AI narration ([[feedback_realvoice_demo_video]]). Record with QuickTime (or OBS) at 1080p/30fps + a USB mic; sync in whisper.cpp per [[feedback_realvoice_demo_video]].

**Target shape** (per [[hackathon_winning_playbook]]):
- **0:00–0:10** HOOK — one sentence that names what it does and the pain.
- **0:10–0:35** PROBLEM — make the judge feel the gap.
- **0:35–2:15** LIVE DEMO — the loop WORK end-to-end on the deployed Sepolia + inspector; the single thing most other submissions get wrong.
- **2:15–2:45** TECH + SPONSOR anchor — vocabulary a Chainlink/BLI judge will mark against.
- **2:45–2:55** QUANTIFIED IMPACT close — numbers, no hedging.

**Total: 2:55 (± 5s)** — leaves five seconds of margin before the 3:00 cliff. Record 1.0× only; never atempo per [[feedback_submission_form_rules_first]].

---

## The on-screen flow (what you'll record)

| # | Beat | Screen | What the user clicks |
|---|---|---|---|
| 1 | Hook | Inspector hero — https://beacon.kajota.io (or Vercel preview) | nothing — just the page |
| 2 | Problem | Inspector hero + a one-slide black card over it (optional) | nothing |
| 3 | MandateAnchor | Inspector `/` tab = MandateAnchor | one row in anchors table → Etherscan |
| 4 | SakkMandate | Inspector `SakkMandate` tab | seal tx → Etherscan |
| 5 | EsusuMandate + verifier | Inspector `EsusuMandate` tab | **"Verify this receipt in the browser"** button |
| 6 | Hard parts | README `docs/BEACON_BRIEF.md` §4 table | scroll one screen |
| 7 | Close | Inspector footer | nothing |

Record each beat as its own clip (no live tab-switching); `ffmpeg` concatenates per [[feedback_demo_video_production]].

---

## The script — read each line as its scene appears

### [0:00] HOOK · hero

> "Three historical payment mandates — Napoleonic direct debit, the Abbasid *sakk*, the Yoruba *esusu* — brought back on-chain, so a regulator can replay the audit without ever seeing a customer's PII. This is Mandate Beacon."

_(10s · 36 words at ≈ 160 wpm, deliberate pace)_

### [0:10] PROBLEM · hero stays on

> "The CBN Consumer Protection Regulation gives Nigerian banks twenty-four hours to reverse a failed transfer. The NIP mandate spec has no replay-safety primitive — an agent retrying inside that window can settle the same debit twice before the dispute clock even starts. PocketChange flagged the same defect family inside Google's Agent Payments Protocol in July. We fix it the same way, on-chain, without exposing the customer."

_(25s · 72 words)_

### [0:35] DEMO 1 · MandateAnchor tab

_(click into the MandateAnchor section of the inspector)_

> "MandateAnchor is the modern direct-debit shape. A posting bank commits a redacted envelope hash, a server-authored idempotency key, the SLA deadline, and a pinned sanctions-list snapshot. Here it is live on Sepolia, address `0x7A4C` through `2504`. Anchor number one, at block eleven-eight-five-eight-five-eight-five."

_(click the anchors-table Etherscan row)_

> "That's a real transaction. The commitment hash on the right is byte-identical to what the TypeScript inspector and the Python Payflow mirror would recompute."

_(20s · 70 words)_

### [0:55] DEMO 2 · SakkMandate tab

_(click to SakkMandate)_

> "SakkMandate is the tenth-century Abbasid sealed instruction. The payer commits a hash, two of three witnesses attest, the beneficiary opens the pre-image on-chain. The historical form died when cross-city coordination collapsed. On-chain witnessing fixes the forgery and the replay in one move."

_(click the seed-seal Etherscan link)_

> "This is the Basra draft — a real seal transaction on Sepolia, two-of-three quorum pinned at seal time."

_(20s · 71 words)_

### [1:15] DEMO 3 · EsusuMandate + browser verifier

_(click to EsusuMandate)_

> "EsusuMandate is the Yoruba rotating-savings mandate. The organiser seals the member set and the collector order at inception. Every historical operator who absconded or reshuffled the order against latecomers — gone. The rotation commit is pinned at seal, and nothing in the contract rewrites it."

_(click the Verify button)_

> "Here's the audit property the pitch names. The browser recomputes the commitment from the manifest alone — the same `keccak256` of ABI-encoded members, order, contribution, cycle length. The hash it prints matches the on-chain `rotationCommit` byte-for-byte, right now, no node required."

_(25s · 95 words)_

### [1:40] DEMO 4 · hard-parts receipts

_(scroll to BEACON_BRIEF §4 or the HARD_PARTS section)_

> "Seven engineering scars, each with a runnable reproducer. Replay inside the TTL. Sanctions-list drift pinning. Rotation-order collusion. Cross-city witness race. Byte-identical cross-rail commitment. The failure modes are scripts, not prose — the auditor runs them."

_(20s · 48 words)_

### [2:00] DEMO 5 · the Chainlink CRE workflow

_(cre/ dir in VSCode, or a terminal `cre/workflow.ts` glimpse)_

> "An SLA breach is permissionless to call. The Chainlink CRE workflow watches `MandatePosted` events every fifteen minutes and queues breach candidates once the deadline lapses. The write path — `emitSLABreach` on-chain — is deferred to v2, so this release is a read-only oracle today, not an autonomous actor."

_(15s · 56 words)_

### [2:15] TECH + SPONSOR

_(back to the inspector hero, or the README's tech line)_

> "Twenty-six Solidity tests across three mechanisms. Sixteen Python tests round-tripping fixtures from the Solidity side byte-for-byte. Three contracts live on Sepolia — MandateAnchor, SakkMandate, EsusuMandate — all addressable, all seeded with real state, all deployed from one wallet. Chainlink CRE as the oracle rail. Zama FHEVM is the sibling branch this work was carved out of. BLI is the venue."

_(30s · 86 words)_

### [2:45] CLOSE · hero

> "Three historical mechanisms. One on-chain rail. Twenty-six tests. Three live addresses. Zero PII on-chain. A regulator can replay this submission without a bank login. That is the Mandate Beacon."

_(10s · 32 words)_

### Total: 2:55 (± 5s). Word count ≈ 566, ≈ 193 wpm — deliberate but not slow.

---

## Record-and-cut recipe (per [[feedback_realvoice_demo_video]] + [[feedback_demo_video_production]])

1. **Record each beat separately** in QuickTime (File → New Screen Recording, select the browser window only, 1080p). Save each as `beacon-01-hook.mov` through `beacon-07-close.mov`.
2. **Voice track separately** with QuickTime audio or OBS — one WAV per beat so you can retake lines without re-recording video.
3. **Sync with whisper.cpp** — transcribe each WAV, align to the script lines, then ffmpeg-overlay the audio onto the matching video clip.
4. **Concatenate** with `ffmpeg -f concat -safe 0 -i clips.txt -c copy beacon.mp4`.
5. **Verify duration ≤ 3:00** with `ffprobe -show_format beacon.mp4 | grep duration`. **No `atempo` — trim at 1.0× by dropping or shortening lines.**
6. Upload to YouTube as **Unlisted**, mark "Not for Kids", drop the link into the BEACON_BRIEF §5 submission manifest row.

---

## Backup lines if you need to trim

- Drop beat 4 (hard parts) entirely → saves 20s; the HARD_PARTS table lives in the README anyway.
- Drop the CRE sentence from beat 5 → saves 10s; mention CRE in the Devpost write-up instead.
- Replace the three dates in beat 3 with "block eleven million" (five syllables shorter per anchor).

---

## What NOT to say

- No "AI" / "LLM" / "autonomous" framing — BLI judges mark on regulatory realism, not AI buzz.
- No "beta" / "coming soon" — only ship-today claims.
- No references to Zama S4 (`Àjọ`) by name — that is the parent branch, not the submission.
- No "we / our team" — the project is solo-authored; use "I built" or passive voice.

---

## Honest-ledger entry for the record

The first draft of this script tried to pitch all three mechanisms chronologically (10c → 19c → 20c). That read as a history lecture. Current script leads with the Napoleonic shape (familiar) and uses the Abbasid + Yoruba as proof-points of the rail, which is the posture the Zama S4 Àjọ submission learned the hard way per [[project_zama_season4]].

Related: [[hackathon_winning_playbook]] (demo-video shape) · [[feedback_realvoice_demo_video]] (sync + no-AI-voice) · [[feedback_demo_video_production]] (ffmpeg recipe) · [[feedback_submission_form_rules_first]] (1.0× trim only) · [[project_bli_legal_tech_2]] (what's live, what's deferred).
