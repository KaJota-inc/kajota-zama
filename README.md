# Àjọ — Confidential PoolTogether on FHEVM

**Prize-linked savings, encrypted end-to-end. Deposit confidential cUSDT, keep your money, and each round one depositor wins the yield — where the winner is chosen *weighted by an encrypted deposit that never leaves ciphertext*, yet anyone on earth can re-derive the randomness and audit the draw.**

**Àjọ is digital *esusu*.** In Yoruba, *àjọ* (also *esusu*, *ajo*) is the rotating-savings pool millions across West Africa run every week — you contribute, the pot rotates, nobody loses their principal. This is that tradition rebuilt as a no-loss prize pool on Zama's FHEVM: private balances, public fairness, no custodian.

- 🔒 **Confidential by construction** — deposits, balances, and winnings are `euint64` ciphertext on-chain. Not a privacy overlay; the state itself is encrypted.
- 🎲 **Publicly verifiable winner selection over ciphertext** — a public commit-revealed seed drives a draw that runs entirely over encrypted balances. No on-chain decryption, no trusted operator scoring, no `ct×ct` multiply.
- 💸 **True no-loss** — principal is withdrawable any time; only the round's yield is at stake, and only the winner can decrypt their prize.
- ✅ **No mocked data** — full deposit → commit → reveal → claim → withdraw lifecycle verified on Sepolia (tx table below), **16/16 tests passing**.

> **Event:** Zama Developer Program — Mainnet Season 4, *Confidential PoolTogether* bounty (5,000 cUSDT, up to 3 winners; grand prize = **OpenZeppelin audit + production launch**). Built for production from line one.

---

## The crux: a fair draw that stays encrypted

PoolTogether V5 decides each user's win with a per-user check (`GenerationSoftware/pt-v5-prize-pool`):

```
PRN % totalSupply  <  winningZone     // bigger balance ⇒ bigger winningZone ⇒ higher odds
```

We keep that exact economic model but **re-express it so it runs over encrypted balances with public randomness and zero decryption.** Multiply both sides through and eliminate the modulo:

```
                win_i   ⇔   p_i · drawTotal   <   2^64 · balance_i
```

- `p_i = uint64(keccak256(roundId, seed, user_i))` is **PUBLIC** — any observer recomputes it from the revealed seed and audits whether the claim was legitimate.
- `drawTotal` and `balance_i` are **encrypted** (`euint64`).
- **Both sides are a PUBLIC-SCALAR × CIPHERTEXT multiply** — cheap, and crucially *not* a ciphertext × ciphertext multiply.
- Products can reach `2^128`, so operands are promoted `euint64 → euint128` first (a naive `euint64` multiply would silently wrap — see hard-parts table).
- A single `FHE.lt` yields the encrypted win flag `ebool`; `FHE.select` routes the public prize into the winner's encrypted balance.
- **O(1) per claim** — PoolTogether-style pull claims, never an O(N) sweep over all depositors.

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
2. **Fund + commit** — prize reserve is funded; operator publishes `commitRound(keccak256(seed))`. Deposits freeze for the round.
3. **Reveal** — operator calls `revealSeed(seed)`; the hash must match. The seed is now public and immutable.
4. **Claim** — each depositor (or a claimer bot) submits a pull claim. The contract computes `p_i·drawTotal < 2^64·balance_i` entirely over ciphertext, derives an `ebool`, and `FHE.select`s the public prize into the winner's encrypted balance. Losers pay gas, lose nothing.
5. **Withdraw** — any time, `FHE.min(requested, balance)` clamps to available funds and moves cUSDT back out. Principal + any prize, encrypted throughout.

---

## Verified contracts (Sepolia · chainId 11155111)

| Contract | Role | Address |
|---|---|---|
| **ConfidentialUSDT** (cUSDT) | ERC-7984 confidential-token rail | [`0x3513B7f708D512b5196035D5Aef610e0910dA97B`](https://sepolia.etherscan.io/address/0x3513B7f708D512b5196035D5Aef610e0910dA97B) |
| **ConfidentialPool** (Àjọ) | No-loss prize pool + single-winner encrypted draw | [`0x760FBfAdAd6576bd93c4bf3cBBc4718B07EA1739`](https://sepolia.etherscan.io/address/0x760FBfAdAd6576bd93c4bf3cBBc4718B07EA1739) |

## On-chain proof set (real Sepolia txs — no mocked data)

| # | Step | Tx |
|---|---|---|
| 1 | faucet cUSDT | [`0xb071c1c8…b041ff34`](https://sepolia.etherscan.io/tx/0xb071c1c8c464e32d12344b3c258ebac812ab8f5692440e44acc1a43ab041ff34) |
| 2 | deposit — `confidentialTransferAndCall` | [`0xb478fab1…110e7eeb`](https://sepolia.etherscan.io/tx/0xb478fab1ae61d42cac78b5028e20d3768493f2f299437d245cff27fa110e7eeb) |
| 3 | harvestYield — fund jackpot from yield | [`0x1f3f4fa4…21bd09f1`](https://sepolia.etherscan.io/tx/0x1f3f4fa4a7f0513e9cb3942327cfa769baefb23a01a6921e08dbe87a21bd09f1) |
| 4 | commitRound | [`0xacb04cef…485300889`](https://sepolia.etherscan.io/tx/0xacb04cef49b167970ff9d71edffb40f2fcfd3c269c959e339e0ebbf485300889) |
| 5 | revealSeed | [`0xb2efcdd0…be69e4ac`](https://sepolia.etherscan.io/tx/0xb2efcdd00b81b9b8fa2f15c4c84da65e96ce79d921a73783e19ffb87be69e4ac) |
| 6 | runDraw — encrypted cumulative single-winner | [`0x6b51d6e4…d4234cf0`](https://sepolia.etherscan.io/tx/0x6b51d6e46140b9a29199a81acf261f2f49ebfa6788e51d512b089801d4234cf0) |
| 7 | claim — winner payout | [`0x64d17390…82f228b63`](https://sepolia.etherscan.io/tx/0x64d173901a8197e229e3081807c8c320c64e5dd6d0724317113022b82f228b63) |
| 8 | disclosePublicTotal | [`0x51534320…39d1d411`](https://sepolia.etherscan.io/tx/0x51534320a8bb7265e3b89148eb3c51b2eb263c24180bdfe724ed4f0939d1d411) |
| 9 | withdraw (principal + jackpot) | [`0x2e84729c…a1d31c37`](https://sepolia.etherscan.io/tx/0x2e84729c28f32af338eaf2bf3b7bb059573a3ed55f2253f4aa2dd09fa1d31c37) |

**Live demo:** https://ajo-confidential.vercel.app · **No-login evidence page:** https://ajo-confidential.vercel.app/#evidence · **Demo video:** _(recording — link added on publish)_

---

## Constraints we hit and how we solved them

| # | Constraint | Solution |
|---|---|---|
| 1 | **Verifiable *yet* encrypted winner selection** | Re-expressed PoolTogether's `PRN % total < zone` as `p·total < 2^64·balance` — runs over ciphertext with *public* randomness (`keccak256(roundId, seed, user)`), so anyone re-derives `p_i` and audits the draw with **no decryption**. |
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
