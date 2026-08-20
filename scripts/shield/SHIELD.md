# Kajota Shield — a confidential trust layer for agent payments

Autonomous agents are spending money in 2026 — and the safety rails were built for humans. **Kajota Shield** gives every
agent a **private mandate it can't exceed** and a **shared fraud brain it can query without any institution exposing its
data**, then **executes the payment confidentially** — all over ciphertext, on the Zama FHEVM. A hijacked or
prompt-injected agent simply cannot move money outside its mandate.

## The system

| Pillar                | What it does                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AgentMandate** (A)  | Encrypted per-agent spend cap + merchant allow-list + velocity + expiry + kill switch. `checkAndSpend` clamps an over-budget or flagged payment to **exactly 0** over ciphertext — no revert, no leak. |
| **FraudOracle** (B)   | Vetted members contribute **encrypted** risk signals; a query reveals only _"aggregate ≥ your threshold"_ — never the score, never who reported. Removes the data-sharing gap that keeps fraud siloed. |
| **Confidential rail** | The authorised amount is moved as an ERC-7984 `confidentialTransferFrom` (principal → merchant).                                                                                                       |
| **Anomaly monitor**   | Off-chain, deterministic (velocity + new-merchant burst) → trips the on-chain kill switch, with a plain-English explanation. `scripts/shield/monitor.mjs --simulate`.                                  |

One `checkAndSpend` enforces the private mandate **and** screens the shared oracle **and** executes the transfer, all
confidential.

## Live on Sepolia (chainId 11155111) — verified

| Contract                 | Address                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| ConfidentialUSDT (cUSDT) | [`0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8`](https://sepolia.etherscan.io/address/0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8#code) |
| FraudOracle              | [`0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc`](https://sepolia.etherscan.io/address/0x14C93328e19e602Fd6d63bcC90053eB8b7537BAc#code) |
| AgentMandate             | [`0x3FF6A6cBF7429Da3572Ff858b2d677Bd8EdCCE6E`](https://sepolia.etherscan.io/address/0x3FF6A6cBF7429Da3572Ff858b2d677Bd8EdCCE6E#code) |

### Live proof — an approved payment and a blocked one, real encrypted txs

| Step                                  | Tx                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| registerAgent (encrypted 1,000 cap)   | [`0x80b1b5c2…`](https://sepolia.etherscan.io/tx/0x80b1b5c20d7aaa0d75427f4dabb7dc809f8c9a270822c7a90468e6fd218c91eb) |
| oracle.report (encrypted risk 80)     | [`0x1a958927…`](https://sepolia.etherscan.io/tx/0x1a9589277f18ac848aa5610cf9d283ea4488f13f1ec71560f25330d7fb5f763f) |
| **checkAndSpend → APPROVED**          | [`0x10a066f1…`](https://sepolia.etherscan.io/tx/0x10a066f1a34472416d8e4797ad0a91046692b3fadee25bd2eb9d403aac270627) |
| **checkAndSpend → BLOCKED (flagged)** | [`0x09b5c60c…`](https://sepolia.etherscan.io/tx/0x09b5c60c498ac297da7dd8f5ab5b651952a364a5d54eab2ef6aac73d158331c2) |

## Run it

```bash
npx hardhat test test/shield/Shield.ts     # 8/8 — mandate × oracle × rail × kill switch
npx hardhat test test/shield/DemoRun.ts    # writes scripts/shield/run.json (real FHE decisions)
node scripts/shield/monitor.mjs --simulate # anomaly monitor demo
open scripts/shield/console.html           # premium operator console
```

Built on Zama FHEVM · ERC-7984 · OpenZeppelin Confidential Contracts. Incubated in the kajota-zama repo; extract to a
standalone `kajota-shield` repo when it graduates.
