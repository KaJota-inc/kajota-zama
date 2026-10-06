# Payflow Mandate Beacon — Sepolia deployment

Live `MandateAnchor` on Sepolia for the BLI Legal Tech Hackathon 2 submission. Each row below is
one real on-chain anchor. Updated by `scripts/beacon/anchor-mandate.mjs`, which is driven by a
cron so this file still refreshes during judging — the single most-decisive playbook move for
this hackathon.

## Deployment

| | |
|---|---|
| Contract | [`0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504`](https://sepolia.etherscan.io/address/0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504) |
| Network | Sepolia (chainId 11155111) |
| Deployer | [`0xC58A7717fdf1Bc40dFb63b02ab54D6CF6c8F7093`](https://sepolia.etherscan.io/address/0xC58A7717fdf1Bc40dFb63b02ab54D6CF6c8F7093) |
| CBN SLA window | 86 400 s (CBN Consumer Protection Regulation 2019 — 24 hours) |
| Deploy tx | [`0x5827375b…9056bd7105`](https://sepolia.etherscan.io/tx/0x5827375bc9fb699bd284d965162661afef4be6f2c8a21f474cdaee9056bd7105) |
| Allowlist bank tx | [`0x54df67ae…6642a304a`](https://sepolia.etherscan.io/tx/0x54df67ae298bcdf0847bb24097dd1a0cedff42d9e8e38a42f213fe92642a304a) |
| First anchored at | 2026-10-06T21:45 UTC |
| Branch | [`hackathon/bli-mandate-beacon`](https://github.com/KaJota-inc/kajota-zama/tree/hackathon/bli-mandate-beacon) |

The deployer is temporarily allowlisted as the posting bank for the Sepolia seed runner. In
production the posting account is a switch (Remita, Interswitch, NIBSS), per
[`pilot/switch_tier_pitch.md`](https://github.com/KaJota-inc/payflow/blob/main/pilot/switch_tier_pitch.md)
in the Payflow repo.

## Anchors

Each row is one `postMandate` call. The `commitment` is the on-chain
`MandateAnchor.mandateCommitment(mandateId)` output and reproduces byte-for-byte off-chain via
`payflow.mandate.mandate_commitment()` (Payflow commit
[`52f23e0`](https://github.com/KaJota-inc/payflow/commit/52f23e0f),
3 fixtures round-trip-verified).

| # | Tick | Block | Mandate id | Commitment | Etherscan |
|---|---|---|---|---|---|
| 1 | 5971077 | 11858585 | `0x45ef3ea0…cfc9da58` | `0xac0efc0c…43c6450b` | [tx](https://sepolia.etherscan.io/tx/0xe1829bba1f3d1ca41722415325082f579dcacc462b7d4ca8f23e9562f7bf628b) |
| 2 | 5971080 | 11858660 | `0xed878ab7…070a4758` | `0x3fd6be26…82be3a2a` | [tx](https://sepolia.etherscan.io/tx/0x83bda60c83479a2f9eb3d22285d1465777253ab85b1ec1a120d8d1c5616142e3) |
