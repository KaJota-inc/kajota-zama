# Submission — Zama Developer Program, Mainnet Season 3

**Project:** KaJota Confidential Pay
**Tracks:** Builder Track + Special Bounty (TokenOps) Track
**Network:** Ethereum Sepolia

> Fill the placeholders (`<...>`) before submitting.

- **GitHub repo:** `<https://github.com/KaJota-inc/kajota-zama>`
- **Deployed `ConfidentialPay` (Sepolia):** `<0x...>`
- **Etherscan:** `<https://sepolia.etherscan.io/address/0x...>`
- **Demo video (≤3 min):** `<https://...>`
- **Live frontend (optional):** `<https://...>`

---

## One-liner

Private payments on Ethereum: balances and amounts are Fully-Homomorphically
Encrypted with Zama FHEVM, so the chain settles on ciphertext and never reveals
who has how much — including a confidential multi-recipient **disperse** flow.

## The problem

KaJota runs payment rails for African commerce. On a transparent chain every
payroll, supplier payment, and remittance leaks amounts and balances — a real
blocker for business adoption. Confidentiality can't be an off-chain afterthought;
it has to hold _during settlement_.

## What we built

A confidential payment ledger (`ConfidentialPay.sol`) where each account holds an
encrypted `euint64` balance:

- **`confidentialTransfer`** — the amount is encrypted client-side via the relayer
  SDK; the contract compares and moves value entirely on ciphertext. Overspend is
  clamped to **encrypted zero** with `FHE.select(FHE.le(amount, balance), amount, 0)`,
  so an under-funded transfer is indistinguishable on-chain from a funded one — no
  balance information leaks, not even implicitly through a revert.
- **`confidentialDisperse`** (TokenOps track) — a payer splits a private balance
  across N recipients in a single transaction, each per-recipient amount encrypted.
  This is the confidential-disperse flow the TokenOps bounty asks for.
- **Access control** — balances are ACL-gated: `FHE.allow` grants decryption only
  to the account owner (and the contract), so `balanceOf` returns a handle that only
  the owner can user-decrypt through the EIP-712 handshake in the frontend.

The **frontend** (Vite + React + ethers + `@zama-fhe/relayer-sdk`) lets a user
connect a wallet, claim the faucet, send confidential transfers, run a confidential
disperse, and decrypt _their own_ balance locally — showing the on-chain ciphertext
handle side-by-side with the value only they can reveal.

## Why it fits "Composable Privacy"

Encrypted balances are a reusable primitive: the same `euint64` ledger backs both a
1-to-1 confidential payment and a 1-to-many confidential disperse, and could compose
into confidential escrow, payroll, or savings groups (esusu/ajo) without changing the
privacy model. Confidentiality lives in the settlement layer, not bolted on top.

## Deliverables checklist

- [x] Confidential smart contract on FHEVM (`ConfidentialPay.sol`)
- [x] Frontend dApp (encrypt inputs + user-decrypt via relayer SDK)
- [x] Test suite — 8/8 passing (mock FHEVM), incl. overspend-clamp + ACL negative test
- [x] Clear documentation (`README.md`, this file)
- [ ] Deployed to Sepolia — address above
- [ ] 3-minute video pitch — link above

## How to run

See `README.md`. TL;DR: `npm install && npm test` for contracts; deploy with
`npm run deploy:sepolia`; run the UI from `frontend/` with `VITE_CONTRACT_ADDRESS` set.

## Team

KaJota — payment infrastructure for African commerce.
