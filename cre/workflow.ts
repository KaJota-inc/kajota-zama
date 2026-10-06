// Payflow Mandate Beacon — SLA-breach detector workflow (Chainlink CRE).
//
// Every tick (cron), the handler scans `MandateAnchor` on Sepolia for the configured lookback
// window, cross-indexes any settlement events in the same window, and logs breach candidates for
// every mandate still in `Status.Posted` whose CBN CPR 2019 deadline has lapsed.
//
// v1 is detection-only. The on-chain write (`emitSLABreach(mandateId)`) is deferred to v2 — see
// cre/README.md. `MandateAnchor` lets any caller invoke `emitSLABreach` once the deadline passes,
// so the GitHub Action EOA cron remains a valid interim operator.

import {
  cre,
  getNetwork,
  type CronPayload,
  type Runtime,
} from "@chainlink/cre-sdk";
import { formatUnits, decodeEventLog, parseAbi, type Address, type Hex } from "viem";
import { z } from "zod";

// ---------- Config ----------

export const configSchema = z.object({
  /** cron expression — "0 */15 * * * *" ticks every 15 minutes */
  schedule: z.string(),
  /** chain selector name recognised by @chainlink/cre-sdk's getNetwork; Sepolia is a testnet. */
  chainName: z.string(),
  isTestnet: z.boolean().default(true),
  /** deployed MandateAnchor address (currently 0x7A4C3c92c... on Sepolia). */
  mandateAnchor: z.string(),
  /** CBN CPR 2019 window — 24h = 86 400 s. Not used in detection v1 but preserved for v2 writes. */
  slaWindowSeconds: z.number().int().positive(),
  /** how many blocks back to scan each tick; ~2 880 ≈ 12 h at Sepolia 15 s / block. */
  lookbackBlocks: z.number().int().positive(),
});

type Config = z.infer<typeof configSchema>;

// Mandate status enum — mirrors contracts/beacon/MandateAnchor.sol
const STATUS_POSTED = 1;

// Minimal ABI slice — only what the detector reads. The project's full ABI lives under
// `contracts/beacon/` in Solidity; we keep only the three events + one view here.
const MANDATE_ANCHOR_ABI = parseAbi([
  "event MandatePosted(bytes32 indexed mandateId, address indexed bank, bytes32 idempotencyKey, uint64 amount, uint64 deadline, uint8 occurrence, bytes32 sanctionsListVersion)",
  "event MandateSettled(bytes32 indexed mandateId, bytes32 reversalRef, uint64 settledAt)",
  "function mandateOf(bytes32) view returns (address,bytes32,uint64,uint64,uint64,bytes32,bytes32,uint8,uint8)",
]);

const safeJsonStringify = (obj: unknown) =>
  JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);

// ---------- Handler ----------

export function onCron(runtime: Runtime<Config>, _payload: CronPayload): string {
  const cfg = runtime.config;
  const net = getNetwork({
    chainFamily: "evm",
    chainSelectorName: cfg.chainName,
    isTestnet: cfg.isTestnet,
  });
  if (!net) {
    throw new Error(`Network not found for chain name: ${cfg.chainName}`);
  }
  const evm = new cre.capabilities.EVMClient(net.chainSelector.selector);
  const addr = cfg.mandateAnchor as Address;

  // Head-of-chain + lookback window.
  const head = evm.getBlockNumber(runtime).result();
  const fromBlock =
    head > BigInt(cfg.lookbackBlocks) ? head - BigInt(cfg.lookbackBlocks) : 0n;
  runtime.log(
    `beacon: scanning MandatePosted on ${cfg.chainName} in blocks [${fromBlock}, ${head}]`,
  );

  // Pull every MandatePosted in the window.
  const postedLogs = evm
    .getLogs(runtime, {
      address: addr,
      fromBlock,
      toBlock: head,
      event: MANDATE_ANCHOR_ABI[0],
    })
    .result();

  // Index settlements over the same window so we can skip anything already settled.
  const settled = new Set<string>();
  const settledLogs = evm
    .getLogs(runtime, {
      address: addr,
      fromBlock,
      toBlock: head,
      event: MANDATE_ANCHOR_ABI[1],
    })
    .result();
  for (const log of settledLogs) {
    const decoded = decodeEventLog({
      abi: MANDATE_ANCHOR_ABI,
      data: log.data as Hex,
      topics: log.topics as [Hex, ...Hex[]],
    });
    if (decoded.eventName === "MandateSettled") {
      settled.add(String(decoded.args.mandateId));
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const candidates: string[] = [];

  for (const log of postedLogs) {
    const decoded = decodeEventLog({
      abi: MANDATE_ANCHOR_ABI,
      data: log.data as Hex,
      topics: log.topics as [Hex, ...Hex[]],
    });
    if (decoded.eventName !== "MandatePosted") continue;
    const mandateId = String(decoded.args.mandateId);
    if (settled.has(mandateId)) continue;
    const deadline = BigInt(decoded.args.deadline as unknown as string);
    if (deadline > now) continue;

    // Confirm state on-chain — a race could have already settled this between log scrape and tick.
    const stateTuple = evm
      .readContract(runtime, {
        address: addr,
        abi: MANDATE_ANCHOR_ABI,
        functionName: "mandateOf",
        args: [mandateId as Hex],
      })
      .result() as readonly [string, Hex, bigint, bigint, bigint, Hex, Hex, number, number];
    const status = stateTuple[7];
    if (status !== STATUS_POSTED) continue;

    candidates.push(mandateId);
  }

  if (candidates.length === 0) {
    runtime.log("beacon: no breach candidates this tick");
    return safeJsonStringify({ scanned: postedLogs.length, candidates: 0 });
  }
  for (const id of candidates) {
    runtime.log(`beacon: breach candidate mandateId=${id}`);
  }
  runtime.log(
    `beacon: ${candidates.length} candidate(s) ready for emitSLABreach — write path deferred to v2`,
  );
  return safeJsonStringify({
    scanned: postedLogs.length,
    settled: settledLogs.length,
    candidates: candidates.length,
    candidateIds: candidates,
  });
}

// ---------- Init ----------

export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCron)];
}

// Silence an unused-import lint while leaving the hook in place for v2.
void formatUnits;
