# Àjọ — Demo video beat-sheet & script

**Target: ≤ 3:00. Hook in the first 10 seconds.** Real voice only — Zama disqualifies AI-generated voice. Record the
screen and your narration; sync afterward.

App: https://ajo-confidential.vercel.app · Evidence (no-login): https://ajo-confidential.vercel.app/#evidence

**What's new vs the single-pool cut:** Àjọ is now a _platform_ — a directory of confidential esusu **Circles**, each
rated by a shared trust circle, browsable as a **3D galaxy** you can dive into. Anyone can **launch their own circle**
in one transaction and land straight inside it. The demo opens on the platform, dives into one circle for the encrypted
lifecycle, then shows a judge creating their own.

---

## Before you record (staging — do once)

1. **MetaMask on Sepolia**, funded with a little test ETH (you'll deploy a contract live in the create-a-circle beat, so
   leave ~0.02 ETH headroom). Use a fresh account so the faucet/deposit beats look clean.
2. **Warm the WASM**: load the app, connect, do one throwaway **Reveal my balance** so the ~5 MB FHE WASM is cached —
   otherwise the first encrypt in your take stalls ~10 s.
3. Pick the **Weekly Àjọ** circle for the lifecycle beats — it already holds a live jackpot and a depositor, so the draw
   lands.
4. Keep a terminal ready for the one operator step:
   ```bash
   node scripts/stage-round.mjs 250      # funds a 250 cUSDT prize, commits + reveals
   ```
   Run this **after** you film the deposit (Beat 5). As the sole fresh depositor you always win, so the claim beat lands
   every take.
5. **Create-a-circle beat is a real deploy** (~20–30 s of confirmations). Either pre-warm by creating one throwaway
   circle before recording (so the flow is familiar), or narrate over the confirmation wait — the "you're now inside
   your own pool" payoff is worth it.

---

## Beat sheet

| #   | ~Time     | On screen                                                                                                                                                        | Narration (say this)                                                                                                                                                                                                                                                                                                                                          |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0:00–0:12 | **Circles → Galaxy**. The 3D constellation: gold rings orbiting the teal _trust-circle_ core; one ring is red.                                                   | "This isn't one savings pool — it's a whole platform of them. Every ring is a confidential prize-savings circle, and they all orbit one shared _trust circle_ that rates them. The red one? The network has privately flagged it."                                                                                                                            |
| 2   | 0:12–0:30 | Slow orbit; hover the labels ("1,500 cUSDT · trusted", "flagged"). Then **click the Weekly Àjọ ring** → camera dives inside.                                     | "Where I'm from in Nigeria we call this _esusu_ — everyone pays into a pot, nobody loses their money, each round someone wins. It was always two things: the pot, _and_ the circle that remembers who to trust. Let me dive into one."                                                                                                                        |
| 3   | 0:30–0:44 | Now _inside_ the circle (3D draw): enclosing gold ring, the vault with the live jackpot, encrypted ticket crystals. Header reads **Inside Weekly Àjọ**.          | "Now I'm inside that circle. The vault is the prize; each crystal is an encrypted ticket. On Zama's FHEVM every balance here is ciphertext on-chain — not a privacy overlay, the state itself is encrypted."                                                                                                                                                  |
| 4   | 0:44–1:04 | Switch to **Classic** view (same circle). Connect → **Mint 1,000 cUSDT** → confirm → type **500** → **Deposit privately** → "Deposited (encrypted)".             | "I mint some confidential cUSDT — an ERC-7984 token, so even the balance is encrypted. Now I deposit. The amount is encrypted in my browser _before_ it leaves the page — on-chain, my deposit is ciphertext."                                                                                                                                                |
| 5   | 1:04–1:22 | **🔓 Reveal my balance** → 🔒 → sign EIP-712 → shows **500 cUSDT**.                                                                                              | "My balance reads as encrypted. To see it, the network checks a signature only I can give and hands the number to me alone. No one else can run this."                                                                                                                                                                                                        |
| 6   | 1:22–1:34 | Terminal: `node scripts/stage-round.mjs 250` → "REVEALED — claims are open".                                                                                     | "Each round a keeper triggers the draw — it funds the prize, commits to a secret seed, then reveals it."                                                                                                                                                                                                                                                      |
| 7   | 1:34–2:02 | Evidence page `/#evidence` → open the **revealSeed** tx, then the **runDraw** tx on Etherscan.                                                                   | "Here's the seed, public on Etherscan — anyone can read it. The winner is weighted by a _time-weighted_ deposit, but the whole check runs over encrypted balances: a public target versus an encrypted running prefix. Anyone recomputes the target from the seed and audits the draw — yet every balance stays encrypted. No decryption, no trusted scorer." |
| 8   | 2:02–2:20 | Back to app → **Claim** → **Reveal my balance** now shows **750** → **Withdraw**.                                                                                | "I claim. My encrypted balance jumps by the prize — and only I can see it. It's no-loss: I withdraw principal plus winnings any time. Over-withdraw and the contract clamps to my balance — it never reverts, so it never leaks how much I had."                                                                                                              |
| 9   | 2:20–2:40 | **Circles → ＋ Create a circle** → name it "Judges' Àjọ", seed prize, **Deploy** → wallet confirm → lands **inside the new circle** (Classic, you're the owner). | "And this is a platform — anyone launches their own. One transaction deploys a confidential pool _I_ own, and drops me straight inside it, ready to run its first round. Every circle I create is rated by that same shared trust circle."                                                                                                                    |
| 10  | 2:40–3:00 | **🛡️ Shield** page → the mandate + fraud-oracle console; then the Evidence proof trail + the Àjọ hero.                                                           | "That trust circle is the other half of _esusu_, restored — a confidential mandate that even lets a _safe autonomous agent_ save into a pool under an encrypted cap. No mocked data: the full lifecycle plus the agent bridge are live on Sepolia, twenty-nine tests green, on OpenZeppelin's ERC-7984 and Zama FHEVM. _Esusu_, on-chain."                    |

---

## Clean script (read straight through, ~2:55)

> This isn't one savings pool — it's a whole platform of them. Every ring is a confidential prize-savings circle, and
> they all orbit one shared trust circle that rates them. The red one? The network has privately flagged it.
>
> Where I'm from in Nigeria we call this _esusu_ — everyone pays into a pot, nobody loses their money, each round
> someone wins. It was always two things: the pot, and the circle that remembers who to trust. Let me dive into one.
>
> Now I'm inside that circle. The vault is the prize; each crystal is an encrypted ticket. On Zama's FHEVM every balance
> here is ciphertext on-chain — not a privacy overlay, the state itself is encrypted.
>
> I mint some confidential cUSDT — an ERC-7984 token, so even the balance is encrypted. Now I deposit. The amount is
> encrypted in my browser before it leaves the page — on-chain, my deposit is ciphertext. My balance reads as encrypted;
> to see it, the network checks a signature only I can give and hands the number to me alone.
>
> Each round a keeper triggers the draw — it funds the prize, commits to a secret seed, then reveals it. Here's the
> seed, public on Etherscan. The winner is weighted by a time-weighted deposit, but the whole check runs over encrypted
> balances: a public target versus an encrypted running prefix. Anyone recomputes the target from the seed and audits
> the draw — yet every balance stays encrypted. No decryption, no trusted scorer.
>
> I claim. My encrypted balance jumps by the prize — and only I can see it. It's no-loss: I withdraw principal plus
> winnings any time. Over-withdraw and the contract clamps to my balance — it never reverts, so it never leaks how much
> I had.
>
> And this is a platform — anyone launches their own. One transaction deploys a confidential pool I own, and drops me
> straight inside it, ready to run its first round, rated by that same shared trust circle. That trust circle is the
> other half of esusu, restored — a confidential mandate that even lets a safe autonomous agent save into a pool under
> an encrypted cap.
>
> No mocked data: the full lifecycle plus the agent bridge are live on Sepolia, twenty-nine tests green, on
> OpenZeppelin's ERC-7984 and Zama FHEVM. Àjọ: the community savings I grew up with, with encrypted balances and a draw
> the whole world can verify. Esusu, on-chain.

---

## Shorter cut (≤ 2:00, if the form caps length)

Drop beats 3 and 9 (the dive lingering + create-a-circle) and open on the **Galaxy** for 6 s before diving. Keep: galaxy
hook → deposit(encrypted) → reveal → seed on Etherscan → claim/withdraw → "and anyone can launch their own, agents
included." The encrypted-lifecycle spine is the part judges must see; the platform is the frame.

---

## Recording notes

- **Skip boilerplate** — don't film wallet unlock or network-switch fumbling; start each beat on the action.
- The 3D views are WASM/WebGL heavy — let the **Galaxy** settle for a second before you start narrating so the rings and
  labels have painted.
- When you **dive into a ring**, the camera flies through the rim (a ~0.85 s animation). Pause your click so it reads on
  camera.
- MetaMask popups are fine (they prove it's real), but keep them quick — cut dead air while a tx confirms; the activity
  log gives a natural "confirmed" beat.
- The **create-a-circle** deploy takes ~20–30 s. Either speed-ramp that footage in editing, or talk over it ("this is a
  real contract deploy, from the browser").
- Film in **1080p**, browser zoomed so text is legible on a phone.
- Upload to **YouTube (unlisted or public), not "made for kids"**; put the link in the README + submission form. Upload
  early — processing varies.
- After you have the video URL, I'll drop it into the README, the submission form, and the X post.
