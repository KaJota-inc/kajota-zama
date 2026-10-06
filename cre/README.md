# Payflow Mandate Beacon — Chainlink CRE workflow

Chainlink Runtime Environment (CRE) workflow that completes the Mandate Beacon rail's SLA-breach
oracle. Lives alongside the Beacon contracts under `contracts/beacon/` and the auto-cron runner
under `.github/workflows/beacon-anchor-cron.yml`.

## What it does

Every 15 minutes the workflow scans `MandateAnchor` on Sepolia for the last ~12 hours of
`MandatePosted` events. It indexes any `MandateSettled` events in the same window and, for every
mandate still in `Status.Posted` whose CBN CPR 2019 24-hour deadline has lapsed, logs a breach
candidate.

```
beacon: scanning MandatePosted in blocks [11858400, 11858580]
beacon: breach candidate mandateId=0x45ef3ea0…cfc9da58
beacon: 1 candidate(s) ready for emitSLABreach — write path deferred
```

The write — the actual `emitSLABreach(mandateId)` on-chain call — is **deferred to v2**. Rationale
below.

## Scope note (v1 vs v2)

- **v1 (this file).** Detection-only. CRE handler reads the chain, logs breach candidates,
  returns a count. Judge-readable as a `cre workflow simulate` trace or as live job output on the
  Chainlink DON once deployed to the private registry.
- **v2.** Wire the on-chain write via `EVMClient.writeReport()`. This requires either (a) an
  OCR-callback-aware receiver contract that accepts the DON's signed report format, or (b) a
  verified-sender flow that lets the DON's own address call `emitSLABreach`. `MandateAnchor` as
  shipped lets ANY caller invoke `emitSLABreach(mandateId)` (the deadline is the gate, not the
  caller — see `contracts/beacon/MandateAnchor.sol` NatSpec on `emitSLABreach`), so a scheduled
  EOA runner remains a valid interim operator. The CRE pipeline supersedes it in v2.

The honest reason v2 isn't v1: the write-side OCR report plumbing is one commit beyond what we
can confidently cite as "working against a public spec we have fully pinned down." Shipping the
detection on-chain-plumbed is more credible than claiming the whole loop and quietly leaving the
write stubbed.

## Files

| File | Purpose |
| --- | --- |
| `project.yaml` | CRE project-level config: RPC endpoints per environment. |
| `workflow.yaml` | Workflow-level config: entry file, config path, name, deployment registry. |
| `sla-breach-detector.ts` | The handler — cron tick → scan logs → log breach candidates. |
| `config.staging.json` | Schedule (`0 */15 * * * *`), Sepolia chain selector, `MandateAnchor` address, SLA window, lookback-block count. |

## Local simulation

```bash
cd cre
cre workflow simulate
```

(The Chainlink CRE CLI — install per https://docs.chain.link/cre/reference/cli/project-setup-ts
— needs to be on PATH. The `simulate` command runs the handler against a mocked runtime,
replaying the current chain state through the capabilities.)

## Deployment to the private registry

Follow https://docs.chain.link/cre/guides/operations/deploying-workflows — summary:

1. `cre workflow compile`
2. `cre workflow deploy --env staging`
3. Confirm the registration tx on the staging gateway.

The staging registry is sufficient for the hackathon submission; the production registry on
Ethereum mainnet is reserved for the switch-tier pilot (Remita / Interswitch / NIBSS, per
`docs/BEACON_BRIEF.md` and Payflow `pilot/switch_tier_pitch.md`).

## Why this file closes hard-parts row 3

`docs/BEACON_BRIEF.md` §3 lists *"Chainlink CRE workflow → batched Sepolia anchor"* as a hard-parts
row. Without a CRE workflow file in the repo, the row is a claim; with this file, it is an artefact
a judge can read, simulate, and critique. The row's second half — batched anchoring — is handled
by the existing `scripts/beacon/anchor-mandate.mjs` + GitHub Action cron, which is a weaker
primitive than a CRE DON but is already producing accumulating on-chain evidence that still
refreshes during judging. CRE replaces it in v2.

## Candidate upstream contribution

The handler shape — "cron → event scrape → deadline check → candidate log" — is a generic enough
primitive that it may fit as a building block in
[smartcontractkit/cre-templates/building-blocks](https://github.com/smartcontractkit/cre-templates/tree/main/building-blocks).
If accepted, that satisfies the winning-playbook move #3 ("upstream PR merged by halfway point").
Draft issue text:

> *Building block proposal: `sla-breach-detector`.* A read-only CRE workflow that watches an
> EVM contract for event pairs with a deadline (A posted at `t`, A optionally settled by `t +
> window`) and emits a candidate log when the window lapses without the matching settlement.
> Generic across any `(posted, settled, deadline)` triple; the Payflow Mandate Beacon
> submission uses it against CBN NIP mandates.
