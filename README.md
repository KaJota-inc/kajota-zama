# KaJota Confidential Pay

**A confidential payments dApp built with Zama's FHEVM — balances and transfer amounts stay Fully-Homomorphically Encrypted, on-chain, end to end.**

Submitted to the **Zama Developer Program — Mainnet Season 3** (Builder Track + Special TokenOps Track).

> On a normal ERC-20, everyone can see exactly how much you hold and how much you send. KaJota Confidential Pay puts payments on-chain **without** that leak: every balance is an encrypted `euint64`, every transferred amount is encrypted client-side, and the contract computes on ciphertext. Even an overspend is indistinguishable from a normal transfer — so no balance information leaks, ever.

---

## Live on Sepolia

| | |
|---|---|
| **ConfidentialPay** | [`0xe4292f6aF1FA9668713269bE1643354a557BF342`](https://sepolia.etherscan.io/address/0xe4292f6aF1FA9668713269bE1643354a557BF342) |
| Deploy tx | [`0xf472bdd5…e45770`](https://sepolia.etherscan.io/tx/0xf472bdd53ab58a964c14fb262e02720af1ed7da225cc7a19aa9da03016e45770) |
| Confidential faucet tx (runs FHE on-chain) | [`0xea75f603…d1504`](https://sepolia.etherscan.io/tx/0xea75f60314ac0bcecd4ffde34d1fc2f5cd9443e88c5da652a2d3254f56ed1504) |
| **Confidential transfer tx** (encrypted amount, computed on ciphertext) | [`0x54a6b4dc…33f8c6`](https://sepolia.etherscan.io/tx/0x54a6b4dc47a7550597ef6639b323e391d4c1841d63476ff071cb5add2933f8c6) |
| **Confidential disperse tx** (TokenOps — 2 recipients, one tx, each amount encrypted) | [`0x38c680f4…e98e541`](https://sepolia.etherscan.io/tx/0x38c680f4b75ac46d423606417671555e235f203349d37053b0588e0fce98e541) |

An account's encrypted balance handle on-chain looks like `0xe44ea324…aa36a70500` — an opaque ciphertext. Only the account owner can decrypt it, client-side, via the relayer's user-decryption flow.

---

## Why FHE (and why payments)

KaJota is an African fintech settling real payments on-chain. Public amounts are a non-starter for merchants, payroll, and remittances — competitors, counterparties, and the whole world would see every figure. FHEVM is the missing primitive: **confidential balances with public verifiability.** This dApp is the smallest honest expression of that thesis.

### How the confidentiality works

- **Encrypted state.** Each balance is a `euint64` — a handle to a ciphertext. The chain never stores a clear amount.
- **Encrypted inputs.** The sender encrypts the amount in the browser with the Zama relayer SDK, producing an `externalEuint64` handle + a zero-knowledge input proof bound to `(contract, sender)`. The contract ingests it with `FHE.fromExternal`.
- **Compute on ciphertext.** The transfer never branches on a clear value. Affordability is an encrypted comparison, and the moved amount is chosen with an encrypted `select`:

  ```solidity
  ebool canSend = FHE.le(amount, fromBalance);                   // encrypted "amount <= balance"
  euint64 sent  = FHE.select(canSend, amount, FHE.asEuint64(0)); // overspend => 0, no revert
  balances[from] = FHE.sub(fromBalance, sent);
  balances[to]   = FHE.add(toBalance, sent);
  ```

  Because an overspend silently moves `0` instead of reverting, an on-chain observer cannot tell a funded transfer from an unfunded one — **the failure path leaks nothing about either balance.**
- **Access control.** After every mutation the contract re-grants decryption rights with `FHE.allowThis` (so it can keep computing) and `FHE.allow(handle, owner)` (so only the owner can user-decrypt). No third party can read someone else's balance.

---

## What's in the box

```
contracts/ConfidentialPay.sol     FHEVM contract: encrypted balances, faucet, transfer, disperse
test/ConfidentialPay.ts           8 mock tests (transfer, overspend-clamp, disperse, ACL negative)
deploy/deploy.ts                  hardhat-deploy script
scripts/onchain-demo.mjs          fire real Sepolia txs (resilient multi-RPC broadcast)
deployments/sepolia.json          deployed address + on-chain proof txs
frontend/                         Vite + React + ethers + @zama-fhe/relayer-sdk dApp
docs/SUBMISSION.md                submission write-up (Builder + TokenOps)
docs/DEMO.md                      3-minute video script
```

### Contract surface

| Function | What it does |
|---|---|
| `claimFaucet()` | One-time demo top-up; seeds an encrypted balance (`FHE.asEuint64`). |
| `confidentialTransfer(to, encAmount, proof)` | Private P2P transfer; overspend clamps to 0. |
| `confidentialDisperse(recipients[], encAmounts[], proofs[])` | Split a private balance across many recipients in one tx — the **TokenOps confidential-disperse flow**. |
| `balanceOf(account) → euint64` | Returns the ciphertext handle (decryptable only by the owner). |

---

## Quickstart

### Contracts

```bash
npm install
npm run compile
npm run test            # 8 passing — runs on the FHEVM mock, no testnet needed
```

Deploy to Sepolia (needs a funded account):

```bash
npx hardhat vars set MNEMONIC          # or drop a seed phrase in .secret.mnemonic (gitignored)
npx hardhat vars set SEPOLIA_RPC_URL   # optional; defaults to a public endpoint
npm run deploy:sepolia
node scripts/onchain-demo.mjs          # claim the faucet on-chain
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_CONTRACT_ADDRESS=0xe4292f6aF1FA9668713269bE1643354a557BF342" > .env
npm run dev
```

Open the app, connect a Sepolia wallet, **Claim faucet**, then **Decrypt** your balance (an EIP-712 signature authorizes the KMS to return the clear value to you only). Send a confidential transfer or run a disperse — the amounts never appear on-chain.

---

## Stack

- **FHEVM** — `@fhevm/solidity` 0.11.x, `@fhevm/hardhat-plugin`, Solidity 0.8.27
- **Frontend** — Vite + React + TypeScript, `ethers` v6, `@zama-fhe/relayer-sdk` 0.4.x
- **Network** — Ethereum Sepolia (chainId 11155111)

## Tracks

- **Builder Track** — the confidential-payments dApp (contract + frontend + this repo + demo video).
- **Special TokenOps Track** — `confidentialDisperse` + the disperse view: a confidential airdrop/disperse flow judged on UX.

## License

MIT
