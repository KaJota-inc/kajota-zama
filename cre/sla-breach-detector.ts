// Payflow Mandate Beacon — SLA-breach detector workflow.
//
// Runs on a Chainlink CRE (Chainlink Runtime Environment) cron. Every 15 minutes it reads the
// deployed `MandateAnchor` contract on Sepolia, scans the `MandatePosted` event logs over a
// configurable lookback window, and for each mandate still in `Status.Posted` whose deadline has
// lapsed, emits a breach candidate log line. The on-chain write (`emitSLABreach(mandateId)`) is
// gated out of this v1 and lives in a thin OCR-callback wrapper planned for v2 — the
// `MandateAnchor` surface accepts the breach from any caller, so a scheduled EOA runner remains
// a valid fallback until the CRE WriteReport pipeline is wired against an OCR-aware receiver.
//
// Validate locally with:
//
//   cre workflow simulate
//
// The config matches Sepolia's chain selector; swap for a mainnet selector when the switch-tier
// pilot (Remita, Interswitch, NIBSS — see Payflow docs/mandate-beacon.md) lands on production.

import { CronCapability, EVMClient, handler, Runner, type Runtime } from "@chainlink/cre-sdk";
import { decodeEventLog, parseAbi } from "viem";

// ── config shape, as per cre/config.staging.json ─────────────────────────────────────────────
type Config = {
  /** cron expression — "0 */15 * * * *" ticks every 15 minutes */
  schedule: string;
  /** CCIP chain selector; Sepolia = "16015286601757825753" */
  chainSelector: string;
  /** deployed MandateAnchor address (currently 0x7A4C3c92c...bfacdbdecfdf6a2504 on Sepolia) */
  mandateAnchor: `0x${string}`;
  /** CBN CPR 2019 window — 24h = 86400s */
  slaWindowSeconds: number;
  /** how many blocks back to scan on each tick; ~2880 ≈ 12h at Sepolia 15s/block */
  lookbackBlocks: number;
};

// Minimal ABI slice — only what the detector reads.
const MANDATE_ANCHOR_ABI = parseAbi([
  "event MandatePosted(bytes32 indexed mandateId, address indexed bank, bytes32 idempotencyKey, uint64 amount, uint64 deadline, uint8 occurrence, bytes32 sanctionsListVersion)",
  "event MandateSettled(bytes32 indexed mandateId, bytes32 reversalRef, uint64 settledAt)",
  "event SLABreached(bytes32 indexed mandateId, uint64 deadline, uint64 observedAt)",
  "function mandateOf(bytes32) view returns ((address,bytes32,uint64,uint64,uint64,bytes32,bytes32,uint8,uint8))",
]);

type MandateView = readonly [
  bank: `0x${string}`,
  idempotencyKey: `0x${string}`,
  amount: bigint,
  postedAt: bigint,
  deadline: bigint,
  envelopeHash: `0x${string}`,
  sanctionsListVersion: `0x${string}`,
  status: number,
  occurrence: number,
];

const STATUS_POSTED = 1;

const onCronTick = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const evm = new EVMClient(BigInt(cfg.chainSelector));

  // Head-of-chain + lookback window.
  const head = evm.getBlockNumber(runtime).result();
  const fromBlock = head > BigInt(cfg.lookbackBlocks) ? head - BigInt(cfg.lookbackBlocks) : 0n;
  runtime.log(`beacon: scanning MandatePosted in blocks [${fromBlock}, ${head}]`);

  // Pull every MandatePosted in the window.
  const posted = evm
    .getLogs(runtime, {
      address: cfg.mandateAnchor,
      fromBlock,
      toBlock: head,
      event: MANDATE_ANCHOR_ABI[0], // MandatePosted
    })
    .result();

  // Index settlements over the same window so we can skip anything already settled.
  const settled = new Set<string>();
  const settlementLogs = evm
    .getLogs(runtime, {
      address: cfg.mandateAnchor,
      fromBlock,
      toBlock: head,
      event: MANDATE_ANCHOR_ABI[1], // MandateSettled
    })
    .result();
  for (const log of settlementLogs) {
    const decoded = decodeEventLog({ abi: MANDATE_ANCHOR_ABI, data: log.data, topics: log.topics });
    if (decoded.eventName === "MandateSettled") {
      settled.add(decoded.args.mandateId as unknown as string);
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const candidates: string[] = [];
  for (const log of posted) {
    const decoded = decodeEventLog({ abi: MANDATE_ANCHOR_ABI, data: log.data, topics: log.topics });
    if (decoded.eventName !== "MandatePosted") continue;
    const mandateId = decoded.args.mandateId as unknown as string;
    if (settled.has(mandateId)) continue;
    const deadline = decoded.args.deadline as unknown as bigint;
    if (deadline > now) continue;

    // Confirm state on-chain — a race could already have settled this between log scrape and tick.
    const m = evm
      .readContract(runtime, {
        address: cfg.mandateAnchor,
        abi: MANDATE_ANCHOR_ABI,
        functionName: "mandateOf",
        args: [mandateId as `0x${string}`],
      })
      .result() as MandateView;
    if (m[7] !== STATUS_POSTED) continue;

    candidates.push(mandateId);
  }

  if (candidates.length === 0) {
    runtime.log("beacon: no breach candidates this tick");
    return "ok:0";
  }
  for (const id of candidates) {
    runtime.log(`beacon: breach candidate mandateId=${id}`);
  }
  // v2 — gate off until the OCR-callback receiver lands; see cre/README.md.
  runtime.log(
    `beacon: ${candidates.length} candidate(s) ready for emitSLABreach — write path deferred`,
  );
  return `ok:${candidates.length}`;
};

export default (): unknown => {
  const cron = new CronCapability();
  return new Runner().run((config: Config) => [
    handler(cron.trigger({ schedule: config.schedule }), onCronTick),
  ]);
};
