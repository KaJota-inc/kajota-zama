# Demo Video Script — KaJota Confidential Pay (≤ 3:00)

Goal: prove a real confidential payment on FHEVM, on-chain, with the amount never
revealed — and show the TokenOps disperse. Record screen + voiceover. Have MetaMask
on Sepolia with two accounts (Alice, Bob) and a little Sepolia ETH.

**Pre-roll setup (not recorded):** deploy to Sepolia, set `VITE_CONTRACT_ADDRESS`,
`cd frontend && npm run dev`. Open the app + a Sepolia Etherscan tab for the contract.

---

### 0:00–0:20 — Hook
> "On a public blockchain, every payment shows the amount. For real commerce that's a
> dealbreaker. This is KaJota Confidential Pay — payments on Ethereum where the amount
> is encrypted the whole way through, using Zama's FHEVM."

Show the app header. One line on KaJota: payment rails for African commerce.

### 0:20–0:50 — Encrypted balance
- Connect wallet (Alice). Click **Claim faucet**. Show the tx confirm.
- Point to the **ciphertext handle** on-chain vs the **🔒 hidden** value.
- Click **Decrypt my balance** → sign the EIP-712 request → value shows `10000`.
> "The chain only ever stored this ciphertext. I just user-decrypted my own balance
> locally — nobody else can."

### 0:50–1:40 — Confidential transfer (the core)
- Enter Bob's address + amount `2500`. Click **Send privately**.
- While it's pending, switch to the Etherscan tab, open the transaction input data.
> "Look at the transaction — the amount is a ciphertext blob and an input proof. There
> is no `2500` anywhere on chain."
- Back to the app: refresh, decrypt Alice → `7500`. Switch MetaMask to Bob, decrypt → `2500`.
> "Balances updated correctly — computed entirely on encrypted values."

### 1:40–2:10 — Overspend leaks nothing
- As Alice, try to send `999999` to Bob. It confirms without reverting.
- Decrypt Alice (unchanged) and Bob (unchanged).
> "An over-budget transfer doesn't revert — it moves an encrypted zero. On-chain it's
> identical to a real transfer, so you can't even infer whether someone had the funds."

### 2:10–2:45 — TokenOps: confidential disperse
- Open the **Confidential disperse** card. Add 2–3 recipients with different amounts.
- Click **Disperse privately** → one transaction.
> "For payouts — payroll, airdrops, supplier batches — this disperses to many accounts
> in a single tx, and every individual amount stays encrypted. That's the TokenOps
> confidential-disperse flow."

### 2:45–3:00 — Close
> "One encrypted-balance primitive powers private 1-to-1 payments and 1-to-many
> disperse — composable privacy at the settlement layer. Contract, frontend, and tests
> are open source. Thanks."

Show: repo URL + deployed contract address on screen.
