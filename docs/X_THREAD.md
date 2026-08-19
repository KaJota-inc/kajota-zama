# X thread — Àjọ (Zama Developer Program S4)

Post as a 4-tweet thread. Attach a demo GIF/clip to tweet 1 for reach. `@zama` + `#ZamaDeveloperProgram` are in tweet 1 (the program requirement). Add the YouTube link to tweet 4 once the video is up. Verify the repo branch is pushed before posting (links must resolve).

---

**1/**
Meet Àjọ — a Confidential PoolTogether on @zama FHEVM.

No-loss savings lottery: deposits, balances & winnings stay encrypted on-chain, yet a single winner is chosen by a draw anyone can verify.

Digital esusu, on-chain 🔒🎲
https://ajo-confidential.vercel.app
#ZamaDeveloperProgram

---

**2/**
The hard part: a fair *public* lottery over *encrypted* balances.

Public seed → an encrypted winning ticket `target = r·total / 2^64`. The contract walks an encrypted prefix sum and flags the one account whose range contains it — all on ciphertext. Anyone can re-derive the randomness and audit the draw; nobody sees the amounts.

---

**3/**
Built on OpenZeppelin's ERC-7984 confidential token (cUSDT) + Zama FHEVM.

Yield on the pooled principal funds a rollover jackpot; principal is withdrawable any time, and only the winner can decrypt their prize. It's esusu — the rotating savings millions across West Africa already run, minus the custodian.

---

**4/**
No mocked data — the full deposit → yield → draw → claim → withdraw lifecycle is live on Sepolia, 18/18 tests green.

Verify it yourself, no login → https://ajo-confidential.vercel.app/#evidence
Code → https://github.com/KaJota-inc/kajota-zama
Demo → [YouTube link]
