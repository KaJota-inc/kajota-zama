# Àjọ — Demo video beat-sheet & script

**Target: ≤ 3:00. Hook in the first 10 seconds.** Real voice only — Zama disqualifies AI-generated voice. Record the
screen and your narration; sync afterward.

App: https://ajo-confidential.vercel.app · Evidence (no-login): https://ajo-confidential.vercel.app/#evidence

**Structure — crux first.** Lead with the one property the bounty grades: **a fair draw that stays encrypted**. Spend
~80% of the video on the core confidential lifecycle (deposit → private balance → the verifiable-yet-encrypted draw →
no-loss withdraw), then close with ~20% breadth (the platform, the agent-safe mandate, and the two historical
mechanisms) as a fast montage. Do **not** open on the 3D games — they read as a gimmick if they come before the crux.

---

## Before you record (staging — do once)

1. **MetaMask on Sepolia**, funded with a little test ETH. **Record with the operator wallet** (`0xC58A77…`, the
   `.secret.mnemonic` account) — it's the pool's _sole_ participant, so it wins the draw with certainty. A fresh account
   would be a second, time-disfavored ticket and could lose on camera. Do one **Take out** (drains to 0 via `FHE.min`)
   before the take so Beat 3/4's "500" reads clean. Pool is already primed to Open · round #1 · 250-coin pot.
2. **Warm the WASM**: load the app, connect, do one throwaway **Show my balance** so the ~5 MB FHE WASM is cached —
   otherwise the first encrypt in your take stalls ~10 s.
3. Use the **Weekly Àjọ** pool (the default) for the lifecycle beats. It must start on a **fresh round** — `stage-round`
   runs `commitRound`, which reverts while a round is still open, so clear any in-flight round to "Open" first (ask me —
   ~1 min on-chain).
4. Keep a terminal ready for the one operator step:
   ```bash
   node scripts/stage-round.mjs 250      # funds a 250-coin prize, commits + reveals
   ```
   Run this **after** you film the deposit (Beat 3). As the sole fresh depositor you always win, so the collect beat
   lands every take.
5. For the breadth montage (Beat 8), pre-open the tabs/routes so you can cut between them fast: `#circles` (Galaxy),
   `#shield`, `#mechanisms`. No need to transact — this beat is a _tour_, not a lifecycle.

---

## Beat sheet

| #            | ~Time     | On screen                                                                                                                                                                                   | Narration (say this)                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (hook)     | 0:00–0:12 | **Classic view.** Cursor rests on **Total saved 🔒 private** and the **Prize pot**.                                                                                                         | "This is a no-loss savings lottery where I can prove the pool is real and the draw is fair — yet nobody, not even me, can see anyone's balance. Every figure here is encrypted, on-chain."                                                                                                                                                                                       |
| 2            | 0:12–0:26 | Slowly highlight the tagline (_esusu_).                                                                                                                                                     | "Where I'm from in Nigeria we call this _esusu_ — everyone pays into a pot, nobody loses their money, each round someone wins. Àjọ rebuilds it on Zama's FHEVM: private balances, public fairness."                                                                                                                                                                              |
| 3            | 0:26–0:50 | Connect → **Get 1,000 free coins** → confirm → type **500** → **Add to the pool** → "Added (encrypted)".                                                                                    | "I add some confidential cUSDT — an ERC-7984 token, so even the balance is ciphertext. Watch: the amount is encrypted in my browser _before_ it leaves the page. On-chain, my deposit is a blob."                                                                                                                                                                                |
| 4            | 0:50–1:08 | **🔓 Show my balance** → sign the EIP-712 popup → reveals **500 coins**.                                                                                                                    | "On-chain my balance reads as encrypted. To see it, the network checks a signature only I can give and hands the number to me alone. No one else can run this."                                                                                                                                                                                                                  |
| 5            | 1:08–1:20 | Terminal: `node scripts/stage-round.mjs 250` → "REVEALED — claims are open".                                                                                                                | "A keeper runs the round — it funds the prize, commits to a secret seed, then reveals it."                                                                                                                                                                                                                                                                                       |
| **6 (CRUX)** | 1:20–1:54 | Evidence `/#evidence` → open the **revealSeed** tx, then the **runDraw** tx on Etherscan → the "Check the draw was fair" tool recomputes the same numbers.                                  | "Here's the seed, public on Etherscan — anyone reads it. The winner is weighted by a _time-weighted_ deposit, but the whole check runs over encrypted balances: a public target versus an encrypted running prefix. Anyone recomputes the target from the seed and audits the draw — yet every balance stays ciphertext. No decryption, no trusted scorer. **That's the crux.**" |
| 7            | 1:54–2:12 | Back to app → **🎁 Collect** → **Show my balance** now **1,000** → **Take out**.                                                                                                            | "I collect — my encrypted balance jumps by the prize, and only I can see it. It's no-loss: I withdraw principal plus winnings any time. Over-withdraw just clamps to my balance — it never reverts, so it never leaks how much I had."                                                                                                                                           |
| 8 (breadth)  | 2:12–2:42 | **Fast montage** — cut between: **Circles → Galaxy** (dive into a ring) · **＋ Create a circle** (one tx, land inside) · **🛡️ Shield** console · **History** page (chit fund + tontine 3D). | "Because it's built for the real world, it's more than one pool. It's a whole platform of confidential circles you can launch in one transaction. A confidential mandate even lets a _safe autonomous agent_ save in under an encrypted cap. And the same rail runs pooled-money ideas history abandoned — a sealed-bid chit fund and a survivorship tontine — all live."        |
| 9 (close)    | 2:42–3:00 | Evidence proof trail + the Àjọ hero.                                                                                                                                                        | "No mocked data — the full lifecycle is live on Sepolia, thirty-two tests green, on OpenZeppelin's ERC-7984 and Zama FHEVM. A fair draw that stays encrypted, that anyone can verify. _Esusu_, on-chain."                                                                                                                                                                        |

---

## Clean script (read straight through, ~2:55)

> This is a no-loss savings lottery where I can prove the pool is real and the draw is fair — yet nobody, not even me,
> can see anyone's balance. Every figure here is encrypted, on-chain.
>
> Where I'm from in Nigeria we call this _esusu_ — everyone pays into a pot, nobody loses their money, each round
> someone wins. Àjọ rebuilds it on Zama's FHEVM: private balances, public fairness.
>
> I add some confidential cUSDT — an ERC-7984 token, so even the balance is ciphertext. Watch: the amount is encrypted
> in my browser before it leaves the page. On-chain, my deposit is a blob. To see my own balance, the network checks a
> signature only I can give and hands the number to me alone.
>
> A keeper runs the round — it funds the prize, commits to a secret seed, then reveals it. Here's the seed, public on
> Etherscan — anyone reads it. The winner is weighted by a time-weighted deposit, but the whole check runs over
> encrypted balances: a public target versus an encrypted running prefix. Anyone recomputes the target from the seed and
> audits the draw — yet every balance stays ciphertext. No decryption, no trusted scorer. That's the crux.
>
> I collect — my encrypted balance jumps by the prize, and only I can see it. It's no-loss: I withdraw principal plus
> winnings any time; over-withdraw just clamps to my balance, never reverts, never leaks.
>
> And because it's built for the real world, it's more than one pool. It's a platform of confidential circles you can
> launch in one transaction; a confidential mandate that even lets a safe autonomous agent save in under an encrypted
> cap; and the same rail running pooled-money ideas history abandoned — a sealed-bid chit fund and a survivorship
> tontine — all live.
>
> No mocked data: the full lifecycle is live on Sepolia, thirty-two tests green, on OpenZeppelin's ERC-7984 and Zama
> FHEVM. A fair draw that stays encrypted, that anyone can verify. Esusu, on-chain.

---

## Shorter cut (≤ 2:00, if the form caps length)

Keep beats 1–7 (the confidential lifecycle — the part judges must see) and compress the breadth montage (beat 8) to a
5-second "and it's also a platform, agent-safe, and runs two more historical mechanisms" over a single Galaxy shot. Cut
beat 2 if needed. Never cut the crux (beat 6).

---

## Recording notes

- **Skip boilerplate** — don't film wallet unlock or network-switch fumbling; start each beat on the action.
- **Lead with the core, not the 3D.** The galaxy/auction/tontine scenes are the closing montage (beat 8), not the open —
  putting them first makes a serious FHE submission read as a toy.
- The 3D views are WASM/WebGL heavy — if you show one in the montage, let it settle a second before it's on screen.
- MetaMask popups are fine to show (they prove it's real), but keep them quick — cut dead air while a tx confirms; the
  activity log gives a natural "confirmed" beat to land on.
- Film in **1080p**, browser zoomed so text is legible on a phone.
- Upload to **YouTube (unlisted or public), not "made for kids"**, and put the link in the README + submission form.
  Upload early — processing varies.
- After you have the video URL, I'll drop it into the README, the submission form, and the X post.
