# Paste-ready submission fields — Zama Developer Program S4 (Confidential PoolTogether)

Copy each block into the matching field on the Zama submission form. Demo video link goes in on publish.

> Facts verified 2026-08-20: bare `npx hardhat test` → **32 passing** — the Àjọ pool (17) + Shield (8) + bridge (4) =
> **29**, +2 for the chit fund + tontine mechanisms, +1 demo-run harness. App + evidence page return 200; all contract +
> circle addresses read live on Sepolia. Re-verify before you actually submit (esp. the video link).

---

**Project name**

```
Àjọ — Confidential PoolTogether
```

**Tagline / one-liner** (≤ ~120 chars)

```
A platform of confidential no-loss savings circles: encrypted balances, a publicly-verifiable draw, and a shared trust circle.
```

**Track / bounty**

```
Confidential PoolTogether bounty (Mainnet Season 4)
```

**Network**

```
Ethereum Sepolia (chainId 11155111)
```

---

**Short description** (~50 words)

```
Àjọ is digital esusu on Zama FHEVM: a platform of confidential no-loss prize-savings circles. Deposits, balances and winnings are euint64 ciphertext; each round a public seed drives a single-winner draw computed entirely over encrypted, time-weighted balances — no decryption, no trusted scorer. Anyone can launch a circle; a confidential mandate even lets safe autonomous agents save in.
```

---

**Full description**

```
Àjọ is a confidential PoolTogether: users deposit into a shared pool, the pooled yield is drawn as a prize each round, and principal is withdrawable at any time — with deposits, balances and winnings encrypted end-to-end, and winner selection verifiable on-chain. It rebuilds no-loss prize-savings on Zama's FHEVM so the money stays private while the fairness stays public.

THE CRUX — A FAIR DRAW THAT STAYS ENCRYPTED (this is the property the bounty asks for, and the heart of the project). PoolTogether V5 picks a winner with a cumulative check (PRN % totalSupply < winningZone). Àjọ keeps that model but evaluates it over encrypted balances with public randomness and ZERO decryption, selecting exactly one winner:
 • a public commit-revealed seed r gives target = (r · drawTotal) / 2^64
 • we walk participants carrying an encrypted running prefix; won_i = (prefix_i ≤ target) ∧ (target < prefix_i + balance_i)
Odds are time-weighted (a TWAB accumulator) so nobody can snipe the pool right before a draw. There is no ct×ct multiply and no on-chain decryption — anyone can recompute target from the public seed and audit the draw, yet every balance stays ciphertext.

CONFIDENTIAL BY CONSTRUCTION.
 • Encrypted state — deposits, balances and winnings are euint64 handles; no clear amount is ever stored. The rail is ConfidentialUSDT, an OpenZeppelin ERC-7984 confidential token.
 • Encrypted deposits — confidentialTransferAndCall carries a client-encrypted amount straight into the pool; the receiver's ebool is allowThis'd + allowTransient'd so the transfer settles.
 • True no-loss — principal is withdrawable any time; only the round's yield is at stake, and only the winner can decrypt their prize. Over-withdraw clamps to your balance (FHE.select) instead of reverting, so failure leaks nothing.
 • Owner-only decryption — the FHE ACL (allow/allowThis) means only the position owner can user-decrypt, via the relayer's EIP-712 handshake.

NO MOCKED DATA. The full deposit→commit→reveal→tallyDraw→runDraw→claim→withdraw lifecycle is verified on Sepolia (tx list below). 29 tests pass across the pool and its extensions.

BEYOND THE CORE (real-world, production ambition — secondary to the confidential PoolTogether above). Àjọ is digital esusu, the West-African rotating-savings circle, which was always two things: a pot that rotates fairly AND a trust circle that remembers who to trust. On top of a complete confidential PoolTogether, three exhibits show what the primitive makes possible:
 • A PLATFORM, NOT ONE POOL — a directory of confidential circles browsable as a 3D galaxy; anyone can launch their own in one browser transaction and land inside it as owner.
 • THE TRUST CIRCLE, RESTORED — a confidential spend mandate (encrypted per-agent cap, allow-list, guardian kill-switch) plus a shared, privacy-preserving fraud memory (reveals only "aggregate ≥ threshold", never a single report) let even a safe autonomous agent save into a pool without ever exposing balances. The agent bridge is live on-chain.
 • THREE WAYS HISTORY POOLED MONEY — PoolTogether is only the newest of many pooled-money schemes, and the older ones died for the same reason: you had to trust an operator with the books. FHE removes that trade-off, so the same encrypted rail also runs a sealed-bid CHIT FUND (winner = a homomorphic argmax over encrypted bids; discount split to the rest) and a survivorship TONTINE (dividend grows as members exit; banned in 1905 for the opacity FHE fixes). Both are fully playable pools — deposit, bid or join, and settle in your own wallet — each with a plain-language explainer and an interactive 3D view, live at /#chit and /#tontine (mock-FHE tested, Etherscan-verified on Sepolia). An exhibit of the primitive — the confidential PoolTogether is the submission.
```

---

**How it uses Zama / FHE** (if a dedicated field exists)

```
Built on @fhevm/solidity 0.11 + the FHEVM Hardhat plugin, OpenZeppelin @openzeppelin/confidential-contracts 0.5 (ERC-7984), and @zama-fhe/relayer-sdk on the frontend for client-side encryption and EIP-712 user-decryption.

On-chain logic runs entirely over encrypted euint64/euint128:
• FHE.fromExternal ingests client ciphertext (externalEuint64 + input proof bound to contract+sender).
• The draw carries an encrypted running prefix and tests (FHE.le / FHE.lt) a public target against it — a single-winner selection over ciphertext with a public, recomputable seed and NO on-chain decryption and no ct×ct multiply.
• Time-weighted odds via a TWAB accumulator (FHE.add/sub/mul-by-scalar/div-by-scalar).
• Leak-free money movement: FHE.select clamps over-withdraw / over-mandate / flagged-counterparty flows to 0 instead of reverting, so the failure path is on-chain-indistinguishable from success.
• FHE ACL (allow / allowThis / allowTransient) gives owner-only decryption and lets ERC-7984 transferAndCall settle.
Draws are paginated one participant per tx to stay under the FHEVM HCU depth limit. Deployed and exercised on Ethereum Sepolia.
```

---

**GitHub repository**

```
https://github.com/KaJota-inc/kajota-zama
```

**Live demo**

```
https://ajo-confidential.vercel.app
```

**No-login evidence page** (live on-chain activity + draw verifier)

```
https://ajo-confidential.vercel.app/#evidence
```

**Live contracts (Sepolia, verified)**

```
ConfidentialPool (Àjọ, "Weekly Àjọ")   0x885843C8110aEe5eFe3c69810ef89790AB74767A
ConfidentialUSDT (cUSDT, ERC-7984)     0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8
AgentMandate (Shield)                  0x5BA600798E834E12b48648488C7eb12d92e0a32c
FraudOracle (Shield trust circle)      0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc

Other live circles in the platform:
Agent Treasury (trusted)               0x2C6F01FcA31578b68fe01dfb299e34114fe6a626
Quick Draw (flagged by the oracle)     0x99A2c50A6Cc6484EA98e70873888d4AC913e6b65
```

**On-chain proof transactions** (canonical Weekly Àjọ lifecycle + agent bridge)

```
1  faucet cUSDT                       0x3ec52a52e3af1703ca24dfa188a03f99b334d157109622d580ec86209e2da6c9
2  deposit (transferAndCall)          0xefcd6431460e548bc68f969339af1ab305c41976dce8202a6876c220c6869d5c
3  harvestYield (fund jackpot)        0xe269f4dd9d945035c0633eb0c42e3f2279bcdae68200e07efb9cf9117c8604ec
4  commitRound                        0x9ced5f58028be9e7383e6c56031a829da9057669cd3d509ea3c58bac601886b1
5  revealSeed (public randomness)     0xb852e6d4ed39a46c2ac66073ef27ed6bd8facdc9f087a75443e795d279ade31d
6  tallyDraw (time-weighted odds)     0x2e8d566129e317ebd61e7bd8ef3a205cd671b6ae9b831c68380a085e3e2fe20c
7  runDraw (encrypted single-winner)  0xd4d7ea604878136301228ad6a25299d6e4dc28dfd4565bcb205bfd18b19adf40
8  claim (winner payout)              0x42505e287af995a9534fc4a2dc451a99b2bde0a7e14e86e67f75044b867c9b8d
9  disclosePublicTotal                0x2f35aec4f68935d35ff918086c97b6d983359af1bc779ea27e108b4c0df1bda3
10 withdraw (principal + jackpot)     0x6b5240775f662818df35a188479b7aa69eb619298223f949f024bce55f11092a
🛡 agent saves into the pool (bridge) 0xa8482b7c458b276645dfd5fded8be505970ce1cc957bb1d5f63490f0434738bc
```

**Demo video**

```
(recording — paste the YouTube link on publish)
```

---

**Tech stack** (if asked)

```
Solidity 0.8.27 · @fhevm/solidity 0.11 · @fhevm/hardhat-plugin · @openzeppelin/confidential-contracts 0.5 (ERC-7984) · @zama-fhe/relayer-sdk · Vite + React + TypeScript + ethers v6 · Three.js / react-three-fiber (3D galaxy) · Ethereum Sepolia
```
