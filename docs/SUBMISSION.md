# Submission — KaJota Confidential Pay

**Zama Developer Program — Mainnet Season 3** · Tracks: **Builder** + **Special TokenOps**

## One-liner

A confidential payments dApp on FHEVM where balances and transfer amounts stay Fully-Homomorphically Encrypted on-chain — including a confidential multi-recipient *disperse* flow for the TokenOps track.

## The problem

KaJota settles real payments on-chain for African merchants and remitters. A public ERC-20 leaks every balance and every amount to competitors and counterparties — a non-starter for payroll, supplier payments, and remittances. FHEVM lets us keep the public verifiability of a blockchain while making the *amounts* private.

## What we built

- **`ConfidentialPay.sol`** — an FHEVM contract where each account balance is an encrypted `euint64`. Core operations:
  - `claimFaucet()` — seeds an encrypted balance (demo stand-in for a confidential deposit).
  - `confidentialTransfer(to, encAmount, proof)` — a private P2P transfer. Affordability is an *encrypted* comparison and the moved amount is chosen with `FHE.select`, so an overspend silently moves `0` rather than reverting — **the failure path is on-chain-indistinguishable from a funded transfer, leaking nothing about balances.**
  - `confidentialDisperse(recipients[], encAmounts[], proofs[])` — splits a private balance across many recipients in one transaction. This is our **TokenOps confidential-disperse** entry.
  - `balanceOf(account)` — returns the ciphertext handle; the FHE ACL grants decryption only to the owner (`FHE.allow`) and the contract (`FHE.allowThis`).
- **Frontend** (`frontend/`) — Vite + React + ethers + `@zama-fhe/relayer-sdk`. Connect wallet → claim faucet → **user-decrypt your own balance via the EIP-712 handshake** → send confidential transfers → run a confidential disperse. The UI shows the on-chain value as raw ciphertext next to the locally-decrypted clear value, making the privacy tangible.
- **8/8 tests** on the FHEVM mock, including the overspend-clamp and an ACL negative test proving a third party cannot decrypt someone else's balance.

## Live on Sepolia (verifiable now)

| Item | Value |
|---|---|
| ConfidentialPay | `0xe4292f6aF1FA9668713269bE1643354a557BF342` |
| Deploy tx | `0xf472bdd53ab58a964c14fb262e02720af1ed7da225cc7a19aa9da03016e45770` (block 11218847) |
| Confidential faucet tx (FHE compute on-chain) | `0xea75f60314ac0bcecd4ffde34d1fc2f5cd9443e88c5da652a2d3254f56ed1504` (block 11218856) |
| **Confidential transfer tx** (encrypted amount, on-chain FHE.le/select) | `0x54a6b4dc47a7550597ef6639b323e391d4c1841d63476ff071cb5add2933f8c6` (block 11218942) |
| **Confidential disperse tx** (TokenOps — 2 recipients, one tx) | `0x38c680f4b75ac46d423606417671555e235f203349d37053b0588e0fce98e541` (block 11222227) |
| Example encrypted balance handle | `0xe44ea3240fdb65bbd0be29d1762cd0961768b7a707ff0000000000aa36a70500` |

Etherscan: https://sepolia.etherscan.io/address/0xe4292f6aF1FA9668713269bE1643354a557BF342

## How FHEVM is used (technical)

```solidity
euint64 amount = FHE.fromExternal(encryptedAmount, inputProof); // ingest client-encrypted input
ebool  canSend = FHE.le(amount, fromBalance);                   // encrypted comparison
euint64 sent   = FHE.select(canSend, amount, FHE.asEuint64(0)); // branch-free, leak-free
balances[from] = FHE.sub(fromBalance, sent);
balances[to]   = FHE.add(toBalance, sent);
FHE.allowThis(newFrom); FHE.allow(newFrom, from);               // ACL re-grant after each mutation
FHE.allowThis(newTo);   FHE.allow(newTo, to);
```

Client side, the relayer SDK produces the `externalEuint64` handle + input proof (`createEncryptedInput().add64().encrypt()`), and user-decryption runs `generateKeypair` → `createEIP712` → wallet signature → `userDecrypt`, so only the balance owner ever sees a clear value.

## Stack

`@fhevm/solidity` 0.11.x · `@fhevm/hardhat-plugin` · Solidity 0.8.27 · `@zama-fhe/relayer-sdk` 0.4.x · Vite + React + ethers v6 · Ethereum Sepolia.

## Links

- **Repo:** https://github.com/KaJota-inc/kajota-zama
- **Demo video:** _(3-min pitch — see `docs/DEMO.md` for the script)_
- **Contract:** https://sepolia.etherscan.io/address/0xe4292f6aF1FA9668713269bE1643354a557BF342

## Roadmap

Confidential deposits from KaJota's fiat on/off-ramp (encrypted mint on settlement), a confidential ERC-20 wrapper for existing balances, and confidential escrow reusing our live Mesh contracts — bringing amount-privacy to KaJota's production payment rails.
