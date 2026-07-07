# Voiceover script — KaJota Confidential Pay (≈ 3:00)

Read straight through at a calm pace (~140 wpm ≈ 420 words ≈ 3 min). Each block is
timed and cued to a scene — works over the demo GIF (`docs/demo/`) or a live screen
recording. Cues in *(italics)* are what's on screen, not read aloud.

---

**[0:00 – 0:22] — Hook** · *(app hero: "KaJota Confidential Pay")*

> "Every payment you make on a normal blockchain is public. Anyone can see your balance, and the exact amount of every transfer you send. For a real business — payroll, supplier invoices, remittances — that's a dealbreaker. This is KaJota Confidential Pay: real payments on Ethereum, where the amounts stay private. It's built on Zama's FHEVM — fully homomorphic encryption, running on-chain."

**[0:22 – 0:50] — What it is** · *(hero tagline / contract address in footer)*

> "KaJota is an African fintech settling payments on-chain. The problem we're solving is simple: keep the public verifiability of a blockchain, but hide the numbers. With FHEVM, every balance is stored encrypted, and the contract computes directly on that ciphertext. The chain never sees a clear amount — not yours, not anyone's."

**[0:50 – 1:30] — Encrypted balance + decrypt** · *(faucet claim → Decrypt → 7500)*

> "Here's my account. On-chain, my balance is this — just ciphertext. To use the app, I claim a starting balance; that's a real transaction that runs encryption operations inside the smart contract. Now, to read my *own* balance, I sign a request. That authorizes Zama's key management network to decrypt the value for me, and only me. There it is — ten thousand. Nobody else can do that for my account."

**[1:30 – 2:10] — Confidential transfer** · *(send → Etherscan: Value 0 ETH, encrypted input data)*

> "Now a private payment. When I send, the amount is encrypted in my browser before it ever leaves — into a ciphertext plus a zero-knowledge proof. Look at the transaction on Etherscan: the value field is zero, and the amount in the calldata is an encrypted handle. It's not readable by anyone. And there's a subtle guarantee here — if I try to overspend, the contract moves exactly zero instead of failing. So even *whether* a payment succeeded tells an observer nothing about my balance."

**[2:10 – 2:40] — TokenOps disperse** · *(disperse to 2 recipients → Etherscan)*

> "The same primitive scales up. With confidential disperse, I split a private balance across many recipients in a single transaction — each amount individually encrypted. It's a confidential payout, or a private airdrop, with nothing leaked per recipient."

**[2:40 – 3:00] — Proof + close** · *(Etherscan tx list / back to hero)*

> "And this isn't a mock. It's deployed on Sepolia right now, with real confidential transactions you can verify on-chain — a deploy, an encrypted transfer, and a disperse. Confidential balances, confidential payments, confidential disperse — live, and powered by FHEVM. That's KaJota Confidential Pay."

---

### Recording tips
- Warm the WASM (one throwaway encrypt) before filming so the first decrypt is instant.
- If doing a live take, be on **Sepolia** with two funded accounts; use a fresh account to film the faucet claim.
- Keep the MetaMask signature popup on screen during the decrypt line — it sells "only you can read it."
- Aim to land under 3:00 — the Zama Builder Track asks for a 3-minute pitch.
