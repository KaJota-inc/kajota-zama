> ⚠️ **SUPERSEDED — old Season-3 "KaJota Confidential Pay" copy.** For the current Àjọ (Confidential PoolTogether, S4) narration, use the clean script in **[DEMO.md](./DEMO.md)**. Kept only for reference. (Zama disqualifies AI voice — record this yourself.)

# Voiceover script — synced to `kajota-zama-demo-full.mp4` (≈ 1:55)

Read each line as its scene appears (the on-screen caption matches). There are multi-second holds between scenes, so you
have room to breathe — don't rush. Total ≈ 290 words.

Cues in _(italics)_ are what's on screen. The **[m:ss]** is when that scene starts.

---

**[0:00]** _(hero)_

> "Every payment on a public blockchain is exposed — your balance, every amount, all of it. KaJota Confidential Pay
> changes that: private payments on Ethereum, powered by Zama's FHEVM."

**[0:07]** _(connect wallet)_

> "I connect a Sepolia wallet. From here, every balance and every amount lives on-chain — fully encrypted."

**[0:15]** _(claim faucet)_

> "First, I claim a starting balance. It's a real transaction, and it runs encryption right inside the smart contract."

**[0:23]** _(decrypt → 10,000)_

> "On-chain, my balance is just ciphertext. I sign once — and only I can decrypt it. Ten thousand."

**[0:31]** _(confidential transfer)_

> "Now a private transfer. The amount is encrypted in my browser before it ever leaves. The chain never sees the
> number."

**[0:39]** _(re-decrypt → 7,500)_

> "I decrypt again: seven thousand five hundred. It moved exactly two thousand five hundred — privately, and provably."

**[0:47]** _(confidential disperse — TokenOps)_

> "The same primitive scales up. Confidential disperse splits a private balance across many recipients in one
> transaction, each amount individually encrypted. This is our TokenOps flow — a confidential payout, or a private
> airdrop."

**[1:03]** _(encrypted note)_

> "Every amount stays encrypted, end to end. The chain only ever stores ciphertext."

**[1:11]** _(disperse confirmed)_

> "And it confirms on-chain like any other transaction — just without leaking a single number."

**[1:20]** _(terminal — 8 passing)_

> "Under the hood: eight of eight tests green. Encrypted transfers, an overspend that clamps to zero with no balance
> leak, and strict, owner-only decryption."

**[1:36]** _(terminal — proofs table)_

> "And it's live on Sepolia right now — a deploy, a confidential transfer, and a disperse, all verifiable on-chain.
> Confidential balances, confidential payments, confidential disperse. That's KaJota Confidential Pay."

---

## How to record (easiest path)

1. **Open the video** so you can watch it play: `docs/demo/kajota-zama-demo-full.mp4` (or the captioned cut). Loop it
   once to get the rhythm.
2. **Record just your voice** while watching — any of:
   - macOS **Voice Memos** app (simplest), or
   - **QuickTime → File → New Audio Recording**, or
   - Any phone voice recorder. Read the lines at the **[m:ss]** cues. Export as `.m4a`, `.wav`, or `.mp3`.
3. **Send me the audio file path** (e.g. `~/Downloads/kajota-vo.m4a`) and I'll **mux it onto the video** with ffmpeg → a
   finished `.mp4` with your narration, ready to upload.

Tips: record in a quiet room; leave ~1 s of silence at the very start; if you fumble a line, just pause and re-read it —
I can trim. Prefer the **uncaptioned** cut if you don't want captions competing with your voice; the captioned cut is
great if you want both.
