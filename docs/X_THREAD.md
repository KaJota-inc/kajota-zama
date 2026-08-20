# X thread — Àjọ (Zama Developer Program S4)

Post as a 5-tweet thread. Attach a demo GIF/clip (the 3D galaxy → dive, or the encrypted deposit) to tweet 1 for reach.
`@zama` + `#ZamaDeveloperProgram` are in tweet 1 (the program requirement). Add the YouTube link to tweet 5 once the
video is up. Verify the repo branch is pushed before posting (links must resolve).

---

**1/** Meet Àjọ — a Confidential PoolTogether on @zama FHEVM.

No-loss prize savings where deposits, balances & winnings stay encrypted on-chain — yet each round a single winner is
picked by a draw ANYONE can re-check. A fair lottery over ciphertext, no decryption.

Digital esusu, on-chain 🔒🎲 https://ajo-confidential.vercel.app #ZamaDeveloperProgram

---

**2/** The hard part: a fair _public_ lottery over _encrypted_ balances.

Public seed → an encrypted winning ticket `target = r·total / 2^64`. The contract walks an encrypted prefix sum and
flags the one account whose range contains it — all on ciphertext, odds _time-weighted_ to stop snipes. Anyone
re-derives the randomness and audits the draw; nobody sees the amounts.

---

**3/** Built on OpenZeppelin's ERC-7984 confidential token (cUSDT) + Zama FHEVM.

True no-loss: principal is withdrawable any time, only the round's yield is at stake, and only the winner can decrypt
their prize. Over-withdraw _clamps_ instead of reverting — so even failure leaks nothing.

---

**4/** esusu was never just a pot — it was a _trust circle_ too.

Àjọ restores it, confidentially: a shared fraud oracle rates every circle (reveals only "flagged / trusted", never a
single report), and a confidential _mandate_ even lets a safe autonomous agent save in under an encrypted spend cap.
Browse it all as a 3D galaxy — or launch your own circle in one tx.

---

**5/** No mocked data — the full deposit → yield → draw → claim → withdraw lifecycle _and_ the agent bridge are live on
Sepolia, 29 tests green.

Verify it yourself, no login → https://ajo-confidential.vercel.app/#evidence Code →
https://github.com/KaJota-inc/kajota-zama Demo → [YouTube link]
