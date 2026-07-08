# 3-Minute Demo Script — KaJota Confidential Pay

Target: **≤ 3:00**. Record at 1080p. Have MetaMask on **Sepolia** with two accounts (Alice, Bob), both with a little
test ETH. Frontend running (`cd frontend && npm run dev`). Etherscan open on the contract in a second tab.

---

### 0:00 – 0:25 · The problem (talking head or slide)

> "This is KaJota Confidential Pay. On a normal ERC-20, every balance and every payment amount is public — anyone can
> see exactly what a merchant holds and what they send. For real payments — payroll, remittances, supplier invoices —
> that's a dealbreaker. We fixed it with Zama's FHEVM: the amounts are encrypted on-chain, end to end, while the chain
> stays publicly verifiable."

### 0:25 – 0:45 · Show the ciphertext on-chain

- Switch to the Etherscan tab on `0xe4292f6a…F342`.
  > "Here's the live contract on Sepolia. Balances are stored as encrypted `euint64` handles — this blob is an account's
  > balance. It's ciphertext. No amount is readable here, by anyone."

### 0:45 – 1:15 · Faucet → encrypted balance

- In the app, **Connect Wallet** (Alice). Point at the balance card.
  > "I connect as Alice. Her on-chain balance is this ciphertext handle. I click **Claim faucet** — that's a real
  > Sepolia transaction that runs FHE operations _inside_ the contract to seed an encrypted balance."
- Click **Claim faucet**, wait for confirmation (activity log shows the tx).

### 1:15 – 1:40 · User-decryption (only you can read it)

- Click **Decrypt my balance**. MetaMask pops an EIP-712 signature.
  > "To read her _own_ balance, Alice signs an EIP-712 request. That authorizes Zama's KMS to return the clear value —
  > to her, and only her. There it is: 10,000. Nobody else can do this for her account."
- Show `🔒 hidden` flipping to `10000`.

### 1:40 – 2:20 · Confidential transfer (the amount never leaks)

> "Now a private payment. I send Bob some amount — it's encrypted in my browser before it ever leaves, producing a
> ciphertext plus a zero-knowledge input proof."

- Enter Bob's address + an amount, click **Send privately**. Show the tx in the log.
- Flip to Etherscan on that tx.
  > "On-chain, the transfer input is ciphertext — the amount is nowhere in the transaction. And a subtle but important
  > property: if I try to overspend, the contract moves _zero_ instead of reverting — so even _whether_ a transfer
  > succeeded tells an observer nothing about my balance."

### 2:20 – 2:50 · TokenOps: confidential disperse

> "Same primitive, scaled up: a confidential disperse. I split a private balance across several recipients in one
> transaction — each amount individually encrypted. This is our TokenOps track entry: a confidential airdrop / payout
> flow."

- Add two recipients + amounts, click **Disperse privately**. Show confirmation.

### 2:50 – 3:00 · Close

> "Confidential balances, confidential transfers, confidential disperse — live on Sepolia, powered by FHEVM. That's
> KaJota Confidential Pay."

---

## Shot list / checklist

- [ ] Etherscan tab pre-opened on the contract address
- [ ] Two Sepolia accounts funded with test ETH
- [ ] `frontend/.env` has `VITE_CONTRACT_ADDRESS=0xe4292f6aF1FA9668713269bE1643354a557BF342`
- [ ] Do a dry-run claim on a throwaway account first (faucet is one-time per account)
- [ ] Keep MetaMask popups on-screen when signing (shows the EIP-712 / tx clearly)
- [ ] Mention "Sepolia" and "FHEVM" out loud (judging cue)
