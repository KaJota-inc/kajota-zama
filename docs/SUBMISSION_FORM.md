# Paste-ready submission fields — Zama Developer Program S3

Copy each block into the matching field on the Zama submission form. Fill the one placeholder: **`<VIDEO_URL>`**.

---

**Project name**

```
KaJota Confidential Pay
```

**Tagline / one-liner** (≤ ~120 chars)

```
Confidential payments on Ethereum: balances and transfer amounts stay Fully-Homomorphically Encrypted on-chain.
```

**Track(s)**

```
Builder Track + Special TokenOps Track
```

**Network**

```
Ethereum Sepolia (chainId 11155111)
```

---

**Short description** (~50 words)

```
A confidential payments dApp built on Zama's FHEVM. Every balance is an encrypted euint64 and every transfer amount is encrypted client-side, so the chain stores and computes on ciphertext only. It also ships a confidential multi-recipient disperse flow for the TokenOps track.
```

---

**Full description**

```
On a normal ERC-20, everyone can see exactly how much you hold and how much you send. For real payments — payroll, remittances, supplier invoices — that public leak is a dealbreaker. KaJota is an African fintech settling payments on-chain, and FHEVM is the missing primitive: confidential balances with public verifiability.

KaJota Confidential Pay puts payments on-chain without the leak:

• Encrypted state — each balance is a euint64 handle to a ciphertext; no clear amount is ever stored.
• Encrypted inputs — the sender encrypts the amount in the browser with the Zama relayer SDK, producing an externalEuint64 handle + a ZK input proof bound to (contract, sender), ingested with FHE.fromExternal.
• Compute on ciphertext — a transfer never branches on a clear value. Affordability is an encrypted comparison (FHE.le) and the moved amount is chosen with FHE.select, so an overspend silently moves 0 instead of reverting. The failure path is on-chain-indistinguishable from a funded transfer, leaking nothing about either balance.
• Access control — after every mutation the contract re-grants decryption rights with FHE.allowThis and FHE.allow(handle, owner), so only the account owner can user-decrypt their balance via the relayer's EIP-712 handshake.

For the TokenOps track, confidentialDisperse splits a private balance across many recipients in one transaction — a confidential airdrop / payout flow where no per-recipient amount is ever public.

Everything is live and verifiable on Sepolia: a deployed contract, a confidential faucet tx that runs FHE operations on-chain, and a real confidential transfer where the amount travels as ciphertext.
```

---

**How it uses Zama / FHE** (if a dedicated field exists)

```
Built on @fhevm/solidity 0.11 with the FHEVM Hardhat plugin, and @zama-fhe/relayer-sdk 0.4 on the frontend for client-side encryption and EIP-712 user-decryption. Core on-chain logic operates entirely on encrypted euint64 values: FHE.fromExternal to ingest client ciphertext, FHE.le + FHE.select for leak-free affordability, FHE.add/FHE.sub for the transfer, and the FHE ACL (allow/allowThis) for owner-only decryption. Deployed and exercised on Ethereum Sepolia.
```

---

**GitHub repository**

```
https://github.com/KaJota-inc/kajota-zama
```

**Live demo (Vercel)**

```
https://kajota-confidential-pay.vercel.app
```

**Live contract (Sepolia)**

```
0xe4292f6aF1FA9668713269bE1643354a557BF342
https://sepolia.etherscan.io/address/0xe4292f6aF1FA9668713269bE1643354a557BF342
```

**On-chain proof transactions**

```
Deploy:                0xf472bdd53ab58a964c14fb262e02720af1ed7da225cc7a19aa9da03016e45770
Confidential faucet:   0xea75f60314ac0bcecd4ffde34d1fc2f5cd9443e88c5da652a2d3254f56ed1504
Confidential transfer: 0x54a6b4dc47a7550597ef6639b323e391d4c1841d63476ff071cb5add2933f8c6
Confidential disperse: 0x38c680f4b75ac46d423606417671555e235f203349d37053b0588e0fce98e541
```

**Demo video**

```
https://youtu.be/csxzqPdgnzQ
```

---

**Tech stack** (if asked)

```
Solidity 0.8.27 · @fhevm/solidity 0.11 · @fhevm/hardhat-plugin · @zama-fhe/relayer-sdk 0.4 · Vite + React + TypeScript · ethers v6 · Ethereum Sepolia
```
