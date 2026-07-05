# KaJota Confidential Pay

**Private payments on Ethereum, powered by Zama FHEVM.** Balances and transfer
amounts are Fully-Homomorphically Encrypted end-to-end — the chain stores only
ciphertext, and only an account owner can decrypt their own balance.

Built for the **Zama Developer Program — Mainnet Season 3** (_Composable Privacy Is the Key_).
Addresses two tracks with one codebase:

- **Builder Track** — a confidential payment dApp (smart contract + frontend).
- **Special Bounty (TokenOps) Track** — a confidential **disperse** flow that splits a
  private balance across many recipients, every amount encrypted.

---

## Why it matters

KaJota builds payment rails for African commerce. On a public chain, every payroll
run, supplier payment, or remittance leaks amounts and balances to competitors and
onlookers. FHEVM lets the settlement happen **on encrypted values**: the contract can
check "can this account afford it?" and move funds **without ever decrypting** either
side. A failed (over-budget) transfer is cryptographically indistinguishable from a
successful one, so even the _existence_ of sufficient funds stays private.

## How it works

`ConfidentialPay.sol` keeps an `euint64` encrypted balance per account.

| Function | What it does |
| --- | --- |
| `claimFaucet()` | One-time demo grant; seeds an encrypted balance of 10,000. |
| `confidentialTransfer(to, encAmount, proof)` | Encrypted transfer. Overspend is clamped to **encrypted zero** via `FHE.select` — no branch, no leak. |
| `confidentialDisperse(recipients[], encAmounts[], proofs[])` | The TokenOps flow: many private transfers in one tx. |
| `balanceOf(account) → euint64` | Returns the ciphertext handle; only the owner is ACL-granted to decrypt it. |

The core privacy guarantee (from `_transfer`):

```solidity
ebool canSend = FHE.le(amount, fromBalance);            // compare on ciphertext
euint64 sent  = FHE.select(canSend, amount, FHE.asEuint64(0)); // clamp overspend to 0
_balances[from] = FHE.sub(fromBalance, sent);
_balances[to]   = FHE.add(toBalance, sent);
```

The frontend uses `@zama-fhe/relayer-sdk` to encrypt amounts client-side and to
run the EIP-712 user-decryption handshake so a user can read _their own_ clear
balance in the browser.

## Stack

- **Contracts:** `@fhevm/solidity` 0.11.x, Hardhat, Solidity 0.8.27 (cancun).
- **Frontend:** Vite + React + ethers v6 + `@zama-fhe/relayer-sdk` 0.4.x.
- **Network:** Ethereum **Sepolia** (FHEVM coprocessor + relayer).

## Quick start

### 1. Contracts

```bash
npm install
npm run compile
npm test                       # 8/8 mock FHE tests
```

Set your secrets (used for Sepolia):

```bash
npx hardhat vars set MNEMONIC          # a funded Sepolia mnemonic
npx hardhat vars set INFURA_API_KEY    # or any Sepolia RPC key
npx hardhat vars set ETHERSCAN_API_KEY # optional, for verify
```

Deploy + exercise on Sepolia (each of these is a real on-chain tx):

```bash
npm run deploy:sepolia
npx hardhat --network sepolia confidential-pay:faucet
npx hardhat --network sepolia confidential-pay:balance
npx hardhat --network sepolia confidential-pay:transfer --to 0xRecipient --amount 250
npx hardhat --network sepolia verify:sepolia   # optional
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env            # set VITE_CONTRACT_ADDRESS to the deployed address
npm install
npm run dev                     # open the printed localhost URL, connect MetaMask on Sepolia
```

## Repo layout

```
contracts/ConfidentialPay.sol   confidential payment ledger (FHEVM)
test/ConfidentialPay.ts         mock FHE test suite (8 tests)
tasks/ConfidentialPay.ts        faucet / balance / transfer hardhat tasks
deploy/deploy.ts                hardhat-deploy script
frontend/                       Vite + React dApp (relayer SDK)
SUBMISSION.md                   track write-up
DEMO_SCRIPT.md                  3-minute video script
```

## License

MIT.
