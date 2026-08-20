# Submission — Àjọ · Confidential PoolTogether

**Zama Developer Program — Mainnet Season 4** · **Confidential PoolTogether** bounty (5,000 cUSDT, up to 3 winners;
grand prize = OpenZeppelin audit + production launch).

> The full technical narrative is the repo **[README](../README.md)**. Paste-ready form fields are in
> **[SUBMISSION_FORM.md](./SUBMISSION_FORM.md)**. Demo beat-sheet + script in **[DEMO.md](./DEMO.md)**. This file is the
> one-page summary.

## One-liner

A platform of confidential no-loss savings circles on FHEVM — encrypted balances, a publicly-verifiable single-winner
draw computed over ciphertext, and a shared trust circle that rates every pool.

## What it is

Àjọ is a **confidential PoolTogether** on Zama's FHEVM: deposit into a shared pool, the pooled yield is drawn as a prize
each round, withdraw principal any time — **money stays private while the fairness stays public.**

- **A fair draw that stays encrypted** _(the crux of the bounty)_ — a public commit-revealed seed drives
  `target = (r · drawTotal) / 2^64`; we walk participants with an encrypted running prefix and test
  `won = (prefix ≤ target) ∧ (target < prefix + balance)`. Odds are **time-weighted** (TWAB, anti-snipe). No on-chain
  decryption, no trusted scorer, no `ct×ct` multiply — anyone recomputes `target` from the seed and audits the draw.
- **Confidential by construction** — deposits, balances and winnings are `euint64` ciphertext on an OpenZeppelin
  **ERC-7984** rail (`ConfidentialUSDT`). Not a privacy overlay; the state itself is encrypted.
- **True no-loss** — principal withdrawable any time; only the round's yield is at stake; only the winner can decrypt
  the prize. Over-withdraw **clamps to your balance** (`FHE.select`) instead of reverting, so failure leaks nothing.

**Beyond the core** — Àjọ is digital _esusu_, which was always a pot _and_ a trust circle. On top of a complete
confidential PoolTogether, three exhibits show what the primitive makes possible (secondary to the core above):

- **A platform, not one pool** — a directory of circles, browsable as a **3D galaxy**; **launch your own in one
  transaction** and land inside it as owner.
- **The trust circle, restored** — a confidential spend **mandate** (encrypted cap, allow-list, kill-switch) + a
  privacy-preserving shared **fraud memory** (reveals only "aggregate ≥ threshold", never a single report) let even a
  _safe autonomous agent_ save into a pool without exposing balances. The agent bridge is live on-chain.
- **Three ways history pooled money** — the same encrypted rail also runs a sealed-bid **chit fund** (winner = a
  homomorphic argmax over encrypted bids) and a survivorship **tontine** (dividend grows as members exit; banned in 1905
  for opacity). Both are **fully playable pools** — deposit, bid or join, and settle in your wallet — each with a
  plain-language explainer and an interactive 3D view. Live at [/#chit](https://ajo-confidential.vercel.app/#chit) ·
  [/#tontine](https://ajo-confidential.vercel.app/#tontine) (Etherscan-verified, mock-FHE tested).

## Verifiable now (Sepolia)

- **App:** https://ajo-confidential.vercel.app · **No-login evidence page:**
  https://ajo-confidential.vercel.app/#evidence
- **Contracts:** ConfidentialPool `0x885843C8…4767A` · ConfidentialUSDT `0x6Be1122C…F790B8` · AgentMandate
  `0x5BA60079…0a32c` · FraudOracle `0x14C93328…37BAc`
- **Proof trail:** the full deposit→commit→reveal→tallyDraw→runDraw→claim→withdraw lifecycle + the agent bridge, as real
  Sepolia txs (see README table / SUBMISSION_FORM.md).
- **Tests:** the Àjọ pool + Shield + bridge suites → **29 passing** (`npx hardhat test` runs 38 in total; the extra 8
  are a legacy S3 `ConfidentialPay` suite unrelated to this submission).

## Stack

`@fhevm/solidity` 0.11 · `@fhevm/hardhat-plugin` · `@openzeppelin/confidential-contracts` 0.5 (ERC-7984) ·
`@zama-fhe/relayer-sdk` · Vite + React + ethers v6 · Three.js / react-three-fiber · Ethereum Sepolia.

## Links

- **Repo:** https://github.com/KaJota-inc/kajota-zama
- **Demo video:** _(recording — link added on publish)_
