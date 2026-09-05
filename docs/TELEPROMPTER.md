# Àjọ — Teleprompter (read this on camera)

**Your voice only — Zama disqualifies AI-generated narration.** Read straight down; each block is one breath-group. Cues
in `[brackets]` are what to click — glance, don't read them aloud.

**Pace:** ~135 words/min lands the whole script at **~2:20**, leaving ~40 s of slack for tx waits and pauses —
comfortably under the **3:00** cap. If you feel rushed, you're going too fast; the numbers say you have room.

**App:** https://ajo-confidential.vercel.app · **Evidence:** https://ajo-confidential.vercel.app/#evidence

---

## ✅ Pre-flight (do once, before you hit record)

> The pool has been **primed** to phase **Open**, round **#1**, a live **250-coin** jackpot, and **one participant** —
> the operator wallet. Two rules make the draw land every take:

1. **Record with the operator wallet, so you always win.** The pool's sole participant is the operator account (the one
   in `.secret.mnemonic`, `0xC58A77…`) — import it into MetaMask and record with it. Because it's the only ticket, it
   wins the draw with certainty. Odds are time-weighted, so a _second_, brand-new wallet would actually be _favored
   against_ and you could lose on camera — don't record with a fresh account.
2. **Zero it once for a clean deposit beat.** That wallet carries a residual balance, so before the take, do a single
   **Take out** (type a big number → it clamps to your balance) to reset to 0. Then Beat 3's "add 500" → Beat 4's
   "reveals 500" reads clean. (Skip this only if you don't mind the reveal showing residual + 500.)
3. **The round is already fresh (Open).** `stage-round.mjs` will `commitRound` cleanly. If you re-run a take and the
   pool is left mid-round, ask me to `closeRound` it back to Open (~1 min on-chain).
4. **Warm the WASM:** load the app, connect, do one throwaway **Show my balance** so the ~5 MB FHE bundle is cached —
   otherwise the first encrypt in your take stalls ~10 s.
5. **Pre-open the montage tabs** (Beat 8) so you can cut fast: `#circles`, `#shield`, `#mechanisms`.
6. Film **1080p**, browser zoomed so text is legible on a phone. Skip wallet-unlock / network-switch fumbling — start
   each beat on the action.

---

## The script (with timecodes)

### ▸ 0:00 — Beat 1 · HOOK `[Classic view. Cursor on "Total saved 🔒 private", then the Prize pot.]`

> This is a savings lottery where nobody loses their money — and I can prove the pool is real and the draw is fair, yet
> no one, not even me, can see what anyone has saved. Every number on this screen is encrypted, on-chain.

### ▸ 0:12 — Beat 2 · ESUSU `[Slowly highlight the esusu tagline.]`

> Where I'm from in Nigeria, we call this _esusu_. Everyone pays into one pot. Nobody loses. Each round, someone wins.
> Àjọ rebuilds it on Zama's FHEVM — private balances, public fairness.

### ▸ 0:26 — Beat 3 · DEPOSIT `[Connect → Get 1,000 free coins → confirm → type 500 → Add to the pool.]`

> I'll add five hundred confidential coins. It's an ERC-7984 token, so even the balance is ciphertext. Watch — the
> amount is encrypted in my browser _before_ it ever leaves the page. On-chain, my deposit is just a blob.

### ▸ 0:50 — Beat 4 · REVEAL `[🔓 Show my balance → sign the popup → reveals 500.]`

> On-chain, my balance reads as encrypted. To see it, the network checks a signature only I can give, and hands the
> number to me alone. No one else can run this.

### ▸ 1:08 — Beat 5 · KEEPER `[Terminal: node scripts/stage-round.mjs 250]`

> A keeper runs the round. It funds the prize, commits to a secret seed, then reveals it.

### ▸ 1:22 — Beat 6 · THE CRUX `[Evidence page → open revealSeed tx, then runDraw tx on Etherscan → run "Check the draw was fair".]`

> Here's the seed — public on Etherscan. Anyone can read it. The winner is picked by a _time-weighted_ deposit, but the
> whole check runs over encrypted balances: a public target, against an encrypted running total. Anyone can recompute
> that target from the seed and audit the draw — yet every balance stays ciphertext. No decryption. No trusted scorer.
> **That is the crux.**

### ▸ 1:56 — Beat 7 · COLLECT / NO-LOSS `[🎁 Collect → Show my balance now 1,000 → Take out.]`

> I collect. My encrypted balance jumps by the prize — and only I can see it. It's no-loss: I take out my savings plus
> winnings any time. Over-withdraw just clamps to my balance. It never reverts, so it never leaks.

### ▸ 2:14 — Beat 8 · BREADTH (montage) `[Cut fast: Circles → Galaxy (dive a ring) · ＋ Create a circle · 🛡️ Shield · History (chit + tontine 3D).]`

> And it's more than one pool. It's a whole platform of confidential circles you can launch in one transaction. A
> confidential mandate even lets a _safe autonomous agent_ save under an encrypted cap. And the same rail brings back
> money ideas history abandoned — a sealed-bid chit fund, and a survivorship tontine. All live.

### ▸ 2:44 — Beat 9 · CLOSE `[Evidence proof trail → the Àjọ hero.]`

> No mocked data. The full lifecycle is live on Sepolia. Thirty-two tests green. Built on OpenZeppelin's ERC-7984 and
> Zama's FHEVM. A fair draw that stays encrypted — that anyone can verify. _Esusu_, on-chain.

---

## If the form caps length at 2:00

Keep Beats 1, 3, 4, 5, 6, 7 (the confidential lifecycle — the part judges must see). Compress Beat 8 to one line — _"and
it's also a platform, agent-safe, and runs two more historical mechanisms"_ — over a single Galaxy shot. Drop Beat 2 if
you must. **Never cut Beat 6 (the crux).**

---

## After you have the video URL

Hand me the YouTube link and I'll drop it into `README.md`, `docs/SUBMISSION_FORM.md`, and `docs/X_THREAD.md` in one
pass, then walk the final submit at forms.zama.org with you.
