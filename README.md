# Àjọ — Confidential PoolTogether on FHEVM

**Prize-linked savings, encrypted end-to-end. Deposit confidential cUSDT, keep your money, and each round one depositor wins the yield — where the winner is chosen *weighted by an encrypted deposit that never leaves ciphertext*, yet anyone on earth can re-derive the randomness and audit the draw.**

**Àjọ is digital *esusu* — and esusu was never just a savings pool.** In Yoruba, *àjọ* (also *esusu*, *ajo*) is the rotating-savings circle millions across West Africa run every week. It was always **two things bound together**: a pot that rotates fairly, *and* a **trust circle** — the group collectively remembers who's reliable and polices who isn't. Modern prize-savings (PoolTogether) kept the pot and threw away the circle; "trustless" code was meant to replace it, but the trust problem came back — as fraud, and in 2026 as *hijacked autonomous agents*. **Àjọ restores both halves — confidentially — because fully-homomorphic encryption finally lets the circle remember without anyone exposing their books.**

- 🔒 **Confidential by construction** — deposits, balances, and winnings are `euint64` ciphertext on-chain. Not a privacy overlay; the state itself is encrypted.
- 🎲 **Publicly verifiable winner selection over ciphertext** — a public commit-revealed seed drives a draw that runs entirely over encrypted, *time-weighted* balances. No on-chain decryption, no trusted operator scoring, no `ct×ct` multiply.
- 💸 **True no-loss** — principal is withdrawable any time; only the round's yield is at stake, and only the winner can decrypt their prize.
- 🛡️ **The trust circle, restored — agent-native** — a **confidential mandate** governs who may put money in and how much. A human saver or an autonomous agent both act through the same primitive; a shared *encrypted* fraud memory screens bad counterparties; an anomaly monitor freezes a hijacked agent. No-loss is precisely why it's the safest DeFi action to delegate to an agent — so Àjọ is the pool agents can save into. (See *The trust circle* below.)
- ✅ **No mocked data** — full lifecycle + the agent bridge verified on Sepolia (tx table below), **all tests passing**.

> **Event:** Zama Developer Program — Mainnet Season 4, *Confidential PoolTogether* bounty (5,000 cUSDT, up to 3 winners; grand prize = **OpenZeppelin audit + production launch**). Built for production from line one.

---

## The crux: a fair draw that stays encrypted

PoolTogether V5 decides each user's win with a per-user check (`GenerationSoftware/pt-v5-prize-pool`):

```
PRN % totalSupply  <  winningZone     // bigger balance ⇒ bigger winningZone ⇒ higher odds
```

We keep that cumulative model but **evaluate it over encrypted balances with public randomness and zero decryption**, and it selects **exactly one winner**:

```
 public seed r ─► target = (r · drawTotal) / 2^64        # encrypted winning ticket, uniform in [0, drawTotal)
 walk participants, carrying an encrypted running prefix:
        won_i  =  (prefix_i ≤ target)  ∧  (target < prefix_i + balance_i)
```

- `r = uint64(keccak256(roundId, seed))` is **PUBLIC** — any observer re-derives it from the revealed seed and audits the draw.
- `target`, `prefix_i` and `balance_i` are **encrypted** (`euint128`/`euint64`). `target` is built with **public-scalar × ciphertext** multiply + scalar divide — *no* ciphertext × ciphertext multiply, *no* decryption.
- Because the intervals `[prefix_i, prefix_i + balance_i)` tile `[0, drawTotal)`, **exactly one** contains `target` → exactly one winner, weighted by deposit size. `FHE.select` routes the public jackpot into that winner's encrypted balance.
- Operands are promoted `euint64 → euint128` before the multiply so the `≤ 2^128` products can't silently wrap (see hard-parts table).
- `runDraw(count)` is **paginated** — the encrypted prefix walk resumes across transactions, so a large pool draws in bounded-gas steps. Claims are then O(1).

**Randomness is commit-reveal, not `FHE.randEuint64`.** The operator commits `keccak256(seed)` *before* the seed is known and reveals later. This is the whole point: `FHE.randEuint64` returns a *ciphertext*, which would make the draw unauditable and defeat "publicly verifiable winner selection." Deposits **freeze at commit**, so no one can grind their balance against a seed they can already see. **Liveness escape hatch:** if the operator never reveals, anyone can void the round and unfreeze funds.

---

## Architecture

```mermaid
flowchart LR
    U[User / Depositor] -->|confidentialTransferAndCall| T[cUSDT · ERC-7984<br/>OZ @openzeppelin/confidential-contracts]
    T -->|onConfidentialTransferReceived| P[ConfidentialPool · Àjọ]
    P -->|euint64 balances| FHE{{FHEVM ops<br/>select · min · lt · fromExternal}}
    P -->|public commit-reveal seed| R[[Public randomness<br/>keccak256 roundId,seed,user]]
    FHE -->|encrypted win flag ebool| P
    P -->|makePubliclyDecryptable · aggregate TVL| PUB[(Public pool total)]
    P -->|userDecrypt / publicDecrypt| SDK[@zama-fhe/relayer-sdk]
    SDK -->|only winner decrypts prize| U
```

```
 deposit (cUSDT) ──► [ ConfidentialPool ]  encrypted euint64 book
                          │
      commit(seedHash) ──►│ freeze  ──► reveal(seed) ──► claim: p·total < 2^64·balance ? (ebool)
                          │                                         │ FHE.select ──► winner balance += prize
      withdraw any time ◄─┘ FHE.min(requested, balance)  ── no-loss, never reverts
```

---

## How it works

1. **Deposit** — user calls `confidentialTransferAndCall` on cUSDT; the pool's `onConfidentialTransferReceived` credits an encrypted `euint64` balance. Principal is theirs, always.
2. **Yield → jackpot** — `harvestYield(amount)` accrues yield on the pooled principal into a **public rollover jackpot** (a testnet stand-in for an ERC-4626 adapter; the jackpot grows the longer between draws).
3. **Commit** — operator publishes `commitRound(keccak256(seed))`; `drawTotal` freezes and deposits lock for the round.
4. **Reveal + draw** — `revealSeed(seed)` (hash must match) derives the encrypted `target`; `runDraw(count)` walks the encrypted prefix sum and flags the single winner — all over ciphertext.
5. **Claim** — each depositor pulls a claim; `FHE.select` credits the jackpot to the winner's encrypted balance, everyone else an encrypted 0. Reveal your balance to see if you won.
6. **Withdraw** — any time, `FHE.min(requested, balance)` clamps to available funds and moves cUSDT back out. Principal + any winnings, encrypted throughout.

---

## The trust circle, restored — agent-native

The pot is only half of esusu. The other half — the circle that decides *who may put money in, how much, and whether a counterparty can be trusted* — is a set of contracts we call **Shield**, and the unifying primitive is a **confidential mandate**: a bounded, private authority over pooled money. A human saver's position and an autonomous agent's spend authority are the *same* primitive with different bounds.

Why this belongs on a prize pool, and why now: **no-loss is the safest DeFi action to delegate to an agent** — you cannot lose principal. So as agents begin managing treasuries in 2026, a confidential no-loss pool is the ideal thing for an agent to save idle funds into — *if* it acts under guardrails. Àjọ provides them:

- **`AgentMandate`** — a principal gives its agent an **encrypted spend cap**, a pool allow-list, a velocity limit, an expiry, and a **kill switch**. `depositToPool` clamps a save to the mandate over ciphertext — over-budget deposits exactly **0**, never reverting, never revealing the cap.
- **`FraudOracle`** — the modern trust circle: vetted members contribute **encrypted** risk signals about counterparties (including *pools*). A query reveals only *"aggregate ≥ your threshold"* — never the score, never who reported. An agent **can't be tricked into saving to a malicious pool**.
- **Anomaly monitor** — deterministic detection (velocity / new-counterparty burst) trips the on-chain kill switch when an agent is hijacked; only a human resumes.

**The bridge** is one call — `agent.depositToPool(pool, amount)`: clamp to the encrypted mandate, screen the pool against the shared circle, then deposit the clamped amount into the confidential PoolTogether *for the principal*, all in one confidential transaction. The saver's position is the principal's; the agent merely acts, within bounds it cannot exceed.

Shield is **deployed + verified on Sepolia** and **live-flow tested** (approved save → over-budget block → flagged-pool block → hijack → kill switch). Contracts: `contracts/shield/`; a premium operator console runs at [kajota-hub.onrender.com/shield](https://kajota-hub.onrender.com/shield).

---

## Verified contracts (Sepolia · chainId 11155111)

| Contract | Role | Address |
|---|---|---|
| **ConfidentialPool** (Àjọ) | No-loss prize pool · time-weighted single-winner draw · agent bridge | [`0x885843C8110aEe5eFe3c69810ef89790AB74767A`](https://sepolia.etherscan.io/address/0x885843C8110aEe5eFe3c69810ef89790AB74767A#code) |
| **ConfidentialUSDT** (cUSDT) | ERC-7984 confidential-token rail | [`0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8`](https://sepolia.etherscan.io/address/0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8#code) |
| **AgentMandate** (Shield) | Confidential per-agent mandate + guarded `depositToPool` | [`0x5BA600798E834E12b48648488C7eb12d92e0a32c`](https://sepolia.etherscan.io/address/0x5BA600798E834E12b48648488C7eb12d92e0a32c#code) |
| **FraudOracle** (Shield) | Privacy-preserving shared fraud memory | [`0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc`](https://sepolia.etherscan.io/address/0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc#code) |

## On-chain proof set (real Sepolia txs — no mocked data)

| # | Step | Tx |
|---|---|---|
| 1 | faucet cUSDT | [`0x3ec52a52…9e2da6c9`](https://sepolia.etherscan.io/tx/0x3ec52a52e3af1703ca24dfa188a03f99b334d157109622d580ec86209e2da6c9) |
| 2 | deposit — `confidentialTransferAndCall` | [`0xefcd6431…c6869d5c`](https://sepolia.etherscan.io/tx/0xefcd6431460e548bc68f969339af1ab305c41976dce8202a6876c220c6869d5c) |
| 3 | harvestYield — fund jackpot from yield | [`0xe269f4dd…7c8604ec`](https://sepolia.etherscan.io/tx/0xe269f4dd9d945035c0633eb0c42e3f2279bcdae68200e07efb9cf9117c8604ec) |
| 4 | commitRound | [`0x9ced5f58…601886b1`](https://sepolia.etherscan.io/tx/0x9ced5f58028be9e7383e6c56031a829da9057669cd3d509ea3c58bac601886b1) |
| 5 | revealSeed | [`0xb852e6d4…279ade31d`](https://sepolia.etherscan.io/tx/0xb852e6d4ed39a46c2ac66073ef27ed6bd8facdc9f087a75443e795d279ade31d) |
| 6 | **tallyDraw — time-weighted odds** | [`0x2e8d5661…3e2fe20c`](https://sepolia.etherscan.io/tx/0x2e8d566129e317ebd61e7bd8ef3a205cd671b6ae9b831c68380a085e3e2fe20c) |
| 7 | runDraw — encrypted single-winner | [`0xd4d7ea60…b19adf40`](https://sepolia.etherscan.io/tx/0xd4d7ea604878136301228ad6a25299d6e4dc28dfd4565bcb205bfd18b19adf40) |
| 8 | claim — winner payout | [`0x42505e28…b867c9b8d`](https://sepolia.etherscan.io/tx/0x42505e287af995a9534fc4a2dc451a99b2bde0a7e14e86e67f75044b867c9b8d) |
| 9 | disclosePublicTotal | [`0x2f35aec4…c0df1bda3`](https://sepolia.etherscan.io/tx/0x2f35aec4f68935d35ff918086c97b6d983359af1bc779ea27e108b4c0df1bda3) |
| 10 | withdraw (principal + jackpot) | [`0x6b524077…55f11092a`](https://sepolia.etherscan.io/tx/0x6b5240775f662818df35a188479b7aa69eb619298223f949f024bce55f11092a) |
| 🛡️ | **agent saves into the pool (Shield bridge)** | [`0xa8482b7c…434738bc`](https://sepolia.etherscan.io/tx/0xa8482b7c458b276645dfd5fded8be505970ce1cc957bb1d5f63490f0434738bc) |

**Live demo:** https://ajo-confidential.vercel.app · **No-login evidence page:** https://ajo-confidential.vercel.app/#evidence · **Demo video:** _(recording — link added on publish)_

---

## Constraints we hit and how we solved them

| # | Constraint | Solution |
|---|---|---|
| 1 | **Verifiable *yet* encrypted, time-weighted single-winner selection** | Odds use each account's **time-weighted average balance (TWAB)** — a whale can't snipe a round by depositing right before it. A public seed → an encrypted `target`; a paginated walk over the encrypted prefix sum of the time-weights flags the one interval containing it. Exactly one winner, entirely over ciphertext with public randomness — anyone audits the draw with **no decryption**. |
| 2 | **Overflow-safe FHE fixed-point** | `p·total` and `2^64·balance` reach `2^128`; a naive `euint64` scalar-multiply silently wraps. Cast `euint64 → euint128` *before* the multiply so both products are exact, then one `FHE.lt`. |
| 3 | **Withdraw-any-time over encrypted principal** | `FHE.min(requested, balance)` clamps an over-withdraw to exactly the balance — never reverts, and never leaks whether you had enough (a revert would be a decryption oracle). |
| 4 | **ERC-7984 deposit callback ACL** | The `onConfidentialTransferReceived` return `ebool` must be **both** `FHE.allowThis`'d (receiver-side check) **and** `FHE.allowTransient`'d to the token (it's consumed in the token's refund `FHE.select`) — miss either and `transferAndCall` reverts. |
| 5 | **Async-free public marketing metric** | `FHE.makePubliclyDecryptable` on the **aggregate** total only — pool TVL becomes a plain public number for the UI while every per-user balance stays encrypted. No per-user decryption, no oracle callback, no async round-trip. |

---

## Primitives touched

`@fhevm/solidity` **0.11.1** · `euint64` / `euint128` / `ebool` · `FHE.select` / `FHE.min` / `FHE.lt` / `FHE.fromExternal` / `FHE.allowTransient` / `FHE.makePubliclyDecryptable` · `ZamaEthereumConfig` · **ERC-7984** confidential-token standard · **OpenZeppelin `@openzeppelin/confidential-contracts` v0.5.3** (`ERC7984`, `IERC7984Receiver`) · **cUSDT** · `@zama-fhe/relayer-sdk` (`userDecrypt` / `publicDecrypt`) · **PoolTogether V5** (`GenerationSoftware/pt-v5-prize-pool`).

**Tech stack:** Solidity + FHEVM (`@fhevm/solidity` 0.11.1) · OpenZeppelin confidential-contracts 0.5.3 · Hardhat + TypeScript · `@zama-fhe/relayer-sdk` · React/Vite frontend on Vercel · Sepolia.

---

## Why Àjọ — inspiration

I'm a Nigerian fintech engineer. Long before "prize-linked savings" was a DeFi primitive, my family ran *esusu*: everyone puts money into a common pot, the pot rotates, and nobody loses their contribution. It's how millions across West Africa actually build savings without a bank. The failure mode was always the same — **trust**: who holds the pot, who saw whose balance, was the draw honest?

PoolTogether is *esusu* with the prize model flipped to no-loss yield. FHEVM is what finally lets me rebuild it the way it should be: **your balance is nobody's business, but the fairness of the draw is everybody's business.** That's the exact split Àjọ delivers — encrypted balances, publicly re-derivable randomness. It's the community savings I grew up with, minus the custodian and minus the leak.

---

## Quickstart

```bash
git clone https://github.com/KaJota-inc/kajota-zama
cd kajota-zama && git checkout hackathon/zama-season4
npm install

npx hardhat compile
npx hardhat test        # 16/16 passing — full deposit→commit→reveal→claim→withdraw lifecycle
```

The frontend lives in `ajo/` (`npm install && npm run dev`). Deploy scripts and the Sepolia address book live under `deploy/`, `scripts/deploy-ajo.mjs`, and `deployments/`.

---

## Provenance

Àjọ reuses the **KaJota FHEVM substrate** (config, relayer wiring, encryption/decryption harness) proven in **Zama Developer Program Season 3**. Everything load-bearing here is **new for Season 4**: the `ConfidentialPool` contract, the encrypted publicly-verifiable **winner-selection algorithm**, the overflow-safe `euint128` fixed-point, and the full **ERC-7984 / OpenZeppelin confidential-contracts** deposit-callback integration.

**Repo:** github.com/KaJota-inc/kajota-zama · branch `hackathon/zama-season4`
