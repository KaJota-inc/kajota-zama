// Runs the FULL Àjọ flow on real Sepolia and records every tx hash — "no mocked data".
// deposit → fund prize → commit → reveal → claim (win) → disclose total → withdraw.
// Amounts are encrypted client-side with the Zama relayer SDK before they leave this process.
//
//   node scripts/onchain-proofs.mjs
//
import { readFileSync, writeFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, Mnemonic, HDNodeWallet, hexlify, keccak256, toUtf8Bytes, id } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const dep = JSON.parse(readFileSync(new URL("../deployments/ajo-sepolia.json", import.meta.url), "utf8"));
const CUSDT = dep.ConfidentialUSDT.address;
const POOL = dep.ConfidentialPool.address;
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const DEPOSIT = 1000n;
const PRIZE = 500n;
const SEED = id("ajo-season4-proof-seed");
const PRIZE_DATA = hexlify(toUtf8Bytes("PRIZE"));

const CUSDT_ABI = [
  "function faucet(uint64 amount) returns (bytes32)",
  "function confidentialTransferAndCall(address to, bytes32 encryptedAmount, bytes inputProof, bytes data) returns (bytes32)",
];
const POOL_ABI = [
  "function harvestYield(uint64 amount)",
  "function commitRound(bytes32 commitment, uint256 revealWindow)",
  "function revealSeed(bytes32 seed)",
  "function tallyDraw(uint256 count)",
  "function runDraw(uint256 count)",
  "function claim()",
  "function disclosePublicTotal()",
  "function withdraw(bytes32 encAmount, bytes proof)",
];

function wallet() {
  const provider = new JsonRpcProvider(RPC);
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0");
  return new Wallet(hd.privateKey, provider);
}

const proofs = [];
async function send(label, contract, method, args, gas = 5_000_000n) {
  process.stdout.write(`\n▶ ${label} … `);
  const tx = await contract[method](...args, { gasLimit: gas });
  process.stdout.write(`tx ${tx.hash}\n`);
  const rc = await tx.wait();
  console.log(`  ${rc.status === 1 ? "✅ SUCCESS" : "❌ FAILED"}  block ${rc.blockNumber}  gas ${rc.gasUsed}`);
  proofs.push({ step: label, txHash: tx.hash, block: rc.blockNumber, gasUsed: rc.gasUsed.toString() });
  if (rc.status !== 1) throw new Error(`${label} reverted`);
  return rc;
}

async function main() {
  const w = wallet();
  console.log("Actor (deployer/owner/sole participant):", w.address);

  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });
  const cusdt = new Contract(CUSDT, CUSDT_ABI, w);
  const pool = new Contract(POOL, POOL_ABI, w);

  // 1) faucet cUSDT
  await send("faucet cUSDT (mint 1000)", cusdt, "faucet", [DEPOSIT], 2_000_000n);

  // 2) deposit into the pool (encrypt for the cUSDT contract)
  const encDep = await fhe.createEncryptedInput(CUSDT, w.address).add64(DEPOSIT).encrypt();
  await send("deposit 1000 (confidentialTransferAndCall)", cusdt, "confidentialTransferAndCall", [
    POOL,
    hexlify(encDep.handles[0]),
    hexlify(encDep.inputProof),
    "0x",
  ]);

  // 3) harvest yield → grow the public rollover jackpot (mints reserve)
  await send("harvestYield (fund jackpot from yield)", pool, "harvestYield", [PRIZE], 2_500_000n);

  // 4) commit the draw
  await send("commitRound (freeze total, hide seed)", pool, "commitRound", [keccak256(SEED), 3600n], 500_000n);

  // 5) reveal the seed → public randomness
  await send("revealSeed (public randomness)", pool, "revealSeed", [SEED], 500_000n);

  // 6) tally time-weighted odds (pass 1, paginated for the HCU depth limit)
  await send("tallyDraw (time-weighted odds)", pool, "tallyDraw", [1n], 6_000_000n);

  // 7) run the single-winner draw over ciphertext (pass 2)
  await send("runDraw (encrypted cumulative winner)", pool, "runDraw", [1n], 6_000_000n);

  // 7) claim — winner takes the jackpot (sole participant wins)
  await send("claim (winner payout)", pool, "claim", [], 3_000_000n);

  // 8) disclose the aggregate pool total as a public metric
  await send("disclosePublicTotal (aggregate reveal)", pool, "disclosePublicTotal", [], 500_000n);

  // 8) withdraw principal + winnings (encrypt for the pool contract)
  const encW = await fhe.createEncryptedInput(POOL, w.address).add64(DEPOSIT + PRIZE).encrypt();
  await send("withdraw 1500 (principal + prize)", pool, "withdraw", [
    hexlify(encW.handles[0]),
    hexlify(encW.inputProof),
  ]);

  const out = {
    network: "sepolia",
    contracts: { ConfidentialUSDT: CUSDT, ConfidentialPool: POOL },
    actor: w.address,
    seed: SEED,
    proofs,
    generatedAt: new Date().toISOString(),
  };
  const outPath = new URL("../deployments/ajo-proofs.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ ${proofs.length} on-chain proofs saved → deployments/ajo-proofs.json`);
  proofs.forEach((p) => console.log(`  ${p.step.padEnd(42)} https://sepolia.etherscan.io/tx/${p.txHash}`));
}

main().catch((e) => {
  console.error("\n❌ PROOF RUN FAILED:", e.message);
  if (proofs.length) console.error("completed so far:", proofs.map((p) => p.step).join(" · "));
  process.exit(1);
});
