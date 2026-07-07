# X thread — KaJota Confidential Pay (for the Zama Builder Track submission)

Post as a thread (5 tweets). Replace **[VIDEO LINK]** with the final real-voice video URL.
Verify the Zama handle before posting (likely `@zama_fhe`). Keep the demo GIF/clip attached to tweet 1 for reach.

---

**1/ 🧵**
Introducing KaJota Confidential Pay — private payments on Ethereum.

On a normal chain, everyone sees your balance and every amount you send. We fixed that: balances *and* transfer amounts stay fully encrypted on-chain, powered by FHEVM.

Try it 👇
https://kajota-confidential-pay.vercel.app
[VIDEO LINK]

---

**2/**
How? Fully Homomorphic Encryption.

Every balance is an encrypted `euint64`. You encrypt the amount in your browser; the contract computes on the *ciphertext* — comparisons, transfers, all without ever decrypting. The chain only ever stores ciphertext. 🔐

---

**3/**
The clever part: if you try to overspend, the contract moves exactly **0** instead of reverting.

So a failed transfer is indistinguishable on-chain from a funded one — no balance information leaks, ever. Privacy *with* public verifiability.

---

**4/**
It also does confidential disperse: split a private balance across many recipients in a single tx, each amount individually encrypted — a confidential payout / private airdrop. 💸

---

**5/**
Live on Sepolia right now:
• Contract `0xe4292f6a…F342`
• Real confidential deploy + transfer + disperse — all verifiable on-chain
• Open source → https://github.com/KaJota-inc/kajota-zama

Built for the Developer Program Mainnet Season 3. @zama_fhe @zama_fheAfrica #FHE #FHEVM
