// Keeper step for the demo: funds a prize, commits, and reveals a round so a
// pending deposit becomes claimable. Run it AFTER you've deposited in the app.
//
//   node scripts/stage-round.mjs [prizeInCusdt]     (default 250)
//
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Contract, Mnemonic, HDNodeWallet, hexlify, keccak256, toUtf8Bytes, id } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const dep = JSON.parse(readFileSync(new URL("../deployments/ajo-sepolia.json", import.meta.url), "utf8"));
const CUSDT = dep.ConfidentialUSDT.address;
const POOL = dep.ConfidentialPool.address;
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const PRIZE = BigInt(Math.round(parseFloat(process.argv[2] || "250") * 1e6)); // 6dp
const SEED = id(`ajo-demo-${process.argv[2] || "250"}-${Math.floor(Date.now() / 1000)}`);
const PRIZE_DATA = hexlify(toUtf8Bytes("PRIZE"));

const POOL_ABI = [
  "function harvestYield(uint64 amount)",
  "function commitRound(bytes32 commitment, uint256 revealWindow)",
  "function revealSeed(bytes32 seed)",
  "function tallyDraw(uint256 count)",
  "function runDraw(uint256 count)",
  "function participantsCount() view returns (uint256)",
  "function phase() view returns (uint8)",
  "function roundId() view returns (uint256)",
];

async function send(label, c, m, args, gas) {
  process.stdout.write(`▶ ${label} … `);
  const tx = await c[m](...args, { gasLimit: gas });
  await tx.wait();
  console.log(`ok  https://sepolia.etherscan.io/tx/${tx.hash}`);
}

async function main() {
  const p = new JsonRpcProvider(RPC);
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const w = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0").connect(p);
  const pool = new Contract(POOL, POOL_ABI, w);

  console.log(`Staging a round · jackpot ${Number(PRIZE) / 1e6} cUSDT · operator ${w.address}\n`);

  await send("harvestYield (fund jackpot)", pool, "harvestYield", [PRIZE], 2_500_000n);
  await send("commitRound", pool, "commitRound", [keccak256(SEED), 3600n], 500_000n);
  await send("revealSeed", pool, "revealSeed", [SEED], 500_000n);
  // TWAB is HCU-heavy → tally + draw one participant per tx.
  const n = Number(await pool.participantsCount());
  for (let i = 0; i < n; i++) await send(`tallyDraw ${i + 1}/${n}`, pool, "tallyDraw", [1n], 6_000_000n);
  for (let i = 0; i < n; i++) await send(`runDraw ${i + 1}/${n}`, pool, "runDraw", [1n], 6_000_000n);

  console.log(`\n✅ Round #${(await pool.roundId()).toString()} drawn — claims are open. Go click "Claim this round".`);
}

main().catch((e) => {
  console.error("stage failed:", e.message);
  process.exit(1);
});
