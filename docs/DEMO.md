# Àjọ — Demo video beat-sheet & script

**Target: ≤ 2:50 (hard cap 3:00). Hook in the first 10 seconds.** Real voice only — Zama disqualifies AI-generated voice. Record the screen and your narration; sync afterward.

App: https://ajo-confidential.vercel.app · Evidence: https://ajo-confidential.vercel.app/#evidence

---

## Before you record (staging — do once)

1. **MetaMask on Sepolia**, funded with a little test ETH. Use a fresh account so the faucet/deposit beats look clean.
2. **Warm the WASM**: load the app, connect, and do one throwaway "Reveal my balance" so the ~5 MB FHE WASM is cached — otherwise the first encrypt in your take stalls ~10 s.
3. The app should be in **Phase: Open** (it is now, round #1). You'll deposit live, then run the keeper step below to open the draw.
4. Keep a terminal ready for the one operator step:
   ```bash
   node scripts/stage-round.mjs 250      # funds a 250 cUSDT prize, commits + reveals
   ```
   Run this **after** you film the deposit (Beat 4). As the sole depositor you always win, so the claim beat lands every take.

---

## Beat sheet

| # | ~Time | On screen | Narration (say this) |
|---|---|---|---|
| 1 | 0:00–0:12 | Landing page. Cursor rests on **Pool total 🔒 encrypted** and **Prize**. | "This is a savings lottery where I can prove the pool is real and the draw is fair — but I can't see anyone's balance, and nobody can see mine. Every figure here lives encrypted, on-chain." |
| 2 | 0:12–0:34 | Slowly highlight the tagline ("Digital *esusu*"). | "Where I'm from in Nigeria we call this *esusu* — everyone pays into a pot, nobody loses their money, and each round someone wins. The catch was always trust: who holds the pot, who saw your balance, was the draw honest? Àjọ rebuilds *esusu* on Zama's FHEVM — private balances, public fairness." |
| 3 | 0:34–0:52 | Connect Wallet → **Mint 1,000 cUSDT** → MetaMask confirm → activity log. | "I mint some confidential cUSDT — an ERC-7984 token, so even the token balance is encrypted." |
| 4 | 0:52–1:14 | Type **500**, click **Deposit privately** → MetaMask confirm → "Deposited (encrypted)". | "Now I deposit. Watch: the amount is encrypted in my browser *before* it leaves this page. On-chain, my deposit is ciphertext — not hidden behind a UI, the state itself is encrypted." |
| 5 | 1:14–1:32 | Click **🔓 Reveal my balance** → 🔒 → sign EIP-712 in MetaMask → shows **500 cUSDT**. | "My balance reads as encrypted. When I decrypt it, the network checks a signature only I can give and hands the number back to me alone. No one else can run this." |
| 6 | 1:32–1:42 | Cut to terminal: `node scripts/stage-round.mjs 250` scrolling to "REVEALED — claims are open". | "Each round a keeper triggers the draw — it funds the prize, commits to a secret seed, then reveals it." |
| 7 | 1:42–2:12 | Evidence page `/#evidence` (live Phase: Revealed) → click the **revealSeed** tx on Etherscan, then the **claim** tx. | "Here's the seed, public on Etherscan — anyone can read it. The winner is weighted by deposit size, but the entire check runs over encrypted balances: `p · total < 2^64 · balance`. Anyone can recompute `p` from the seed and audit the draw — yet every balance stays encrypted. No decryption, no trusted scorer." |
| 8 | 2:12–2:34 | Back to app → **Claim this round** → MetaMask → **Reveal my balance** now shows **750** → **Withdraw**. | "I claim. My encrypted balance jumps by the prize — and only I can see it. It's no-loss: I withdraw principal plus winnings any time. Over-withdraw and the contract just clamps to my balance — it never reverts, so it never leaks how much I had." |
| 9 | 2:34–2:50 | Evidence page proof trail (the tx list) + contracts, then the Àjọ hero. | "No mocked data — the full lifecycle is live on Sepolia, sixteen tests green, built on OpenZeppelin's ERC-7984 and Zama FHEVM. Àjọ: the community savings I grew up with, with encrypted balances and a draw the whole world can verify. *Esusu*, on-chain." |

---

## Clean script (read straight through, ~2:45)

> This is a savings lottery where I can prove the pool is real and the draw is fair — but I can't see anyone's balance, and nobody can see mine. Every figure here lives encrypted, on-chain.
>
> Where I'm from in Nigeria we call this *esusu* — everyone pays into a pot, nobody loses their money, and each round someone wins. The catch was always trust: who holds the pot, who saw your balance, was the draw honest? Àjọ rebuilds *esusu* on Zama's FHEVM — private balances, public fairness.
>
> I mint some confidential cUSDT — an ERC-7984 token, so even the token balance is encrypted. Now I deposit. Watch: the amount is encrypted in my browser before it leaves this page. On-chain, my deposit is ciphertext — not hidden behind a UI, the state itself is encrypted.
>
> My balance reads as encrypted. When I decrypt it, the network checks a signature only I can give and hands the number back to me alone. No one else can run this.
>
> Each round a keeper triggers the draw — it funds the prize, commits to a secret seed, then reveals it. Here's the seed, public on Etherscan — anyone can read it. The winner is weighted by deposit size, but the entire check runs over encrypted balances: p times total, less than two-to-the-sixty-four times balance. Anyone can recompute p from the seed and audit the draw — yet every balance stays encrypted. No decryption, no trusted scorer.
>
> I claim. My encrypted balance jumps by the prize — and only I can see it. It's no-loss: I withdraw principal plus winnings any time. Over-withdraw and the contract just clamps to my balance — it never reverts, so it never leaks how much I had.
>
> No mocked data — the full lifecycle is live on Sepolia, sixteen tests green, built on OpenZeppelin's ERC-7984 and Zama FHEVM. Àjọ: the community savings I grew up with, with encrypted balances and a draw the whole world can verify. *Esusu*, on-chain.

---

## Recording notes

- **Skip boilerplate** — don't film wallet unlock or network-switch fumbling; start each beat on the action.
- MetaMask popups are fine to show (they prove it's real), but keep them quick — cut dead air while a tx confirms; the activity log gives you a natural "confirmed" beat to land on.
- Film in **1080p**, browser zoomed so text is legible on a phone.
- Upload to **YouTube (unlisted or public), not "made for kids"**, and put the link in the README + submission form. Upload early — processing varies.
- If a take of the encrypt/claim stalls, it's the WASM/relayer — wait it out once to warm it, then re-take (see staging step 2).
- After you have the video URL, I'll drop it into the README, the submission form, and the X post.
