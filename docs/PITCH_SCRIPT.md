> ⚠️ **SUPERSEDED — old Season-3 "KaJota Confidential Pay" copy.** For the current Àjọ (Confidential PoolTogether, S4)
> pitch, use **[DEMO.md](./DEMO.md)** (beat-sheet + clean script) and **[SUBMISSION_FORM.md](./SUBMISSION_FORM.md)**.
> Kept only for reference. Ask and I'll rewrite this as a real-person pitch for Àjọ.

# Pitch script — real-person video (Zama Builder Track, ≤ 3:00)

The form requires a **real-person pitch** (AI voice/video is disqualified). So this is _you_ — your voice, and ideally
your face on camera for the intro/outro. Aim for ~2:30. Speak naturally; these are talking points, not a teleprompter —
paraphrasing is fine and sounds better.

**Format that works:** 15 s talking-head intro (webcam) → screen-record the live app while you narrate → 10 s
talking-head close. Or one continuous screen recording with your voice. Either qualifies.

---

### [0:00–0:15] Intro — on camera

> "Hi, I'm [your name] from KaJota. This is KaJota Confidential Pay — private payments on Ethereum, built with Zama's
> FHEVM. Let me show you why it matters, and then show it working live on Sepolia."

### [0:15–0:35] The problem

> "On a normal blockchain, every payment is public — your balance, and the exact amount of every transfer. For real
> businesses — payroll, supplier payments, remittances — that's a dealbreaker. We keep the amounts private, while
> staying fully on-chain and verifiable."

### [0:35–1:05] Balance + decrypt _(screen: the app, connected)_

> "Here's the app, live on Sepolia. On-chain, my balance is just ciphertext — nobody can read it. I claim a starting
> balance; that's a real transaction that runs encryption inside the smart contract. Now I sign once, and only I can
> decrypt my own balance: ten thousand."

### [1:05–1:35] Confidential transfer _(screen: send + Etherscan)_

> "Now a private transfer. The amount is encrypted in my browser before it ever leaves. On Etherscan, the value is zero
> and the amount is an encrypted blob — unreadable. I decrypt again: seven-thousand-five-hundred. It moved exactly
> two-thousand-five-hundred, privately. And if I overspend, the contract moves zero instead of failing — so even whether
> a payment succeeded leaks nothing."

### [1:35–2:00] Disperse (TokenOps) _(screen: disperse)_

> "The same idea scales: confidential disperse splits a private balance across many recipients in one transaction, each
> amount individually encrypted — a confidential payout or a private airdrop."

### [2:00–2:25] Proof + close _(screen: Etherscan / terminal, then back on camera)_

> "This isn't a mock — it's live on Sepolia right now: a deploy, a confidential transfer, and a disperse, all verifiable
> on-chain, with eight of eight tests passing. Confidential balances, confidential payments, confidential disperse.
> That's KaJota Confidential Pay. Thanks for watching."

---

## How to record (macOS, simple)

- **Screen + voice:** QuickTime Player → **File → New Screen Recording** → click the mic icon and pick your microphone →
  record the app at https://kajota-confidential-pay.vercel.app while you narrate and click through (wallet on Sepolia).
- **Face intro/outro (optional but recommended):** QuickTime → **New Movie Recording** for a 15 s webcam intro + 10 s
  close.
- **Warm the app first** (one throwaway encrypt) so the first decrypt is instant on camera.
- Keep MetaMask popups on screen when signing — it sells "only you can decrypt."

## When you're done

- Upload to YouTube (Unlisted or Public). Send me the link → I update the submission docs + the X thread's [VIDEO LINK].
- **Optional:** if you'd rather record only the talking-head bits (intro/close) and let me splice them onto the
  captioned screen b-roll we already have, just send me those clips and I'll stitch + caption the whole thing. Your
  call.
