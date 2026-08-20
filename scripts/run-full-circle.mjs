// Create a brand-new circle (ConfidentialPool) on the canonical cUSDT and run a FULL round on it:
// deploy → faucet → deposit(encrypted) → fund prize → commit → reveal → tally → draw → claim → disclose.
// Leaves the circle at "Winner picked" so it shows a completed round in the app.
//   node scripts/run-full-circle.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, ContractFactory, Mnemonic, HDNodeWallet, hexlify, keccak256, id } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CUSDT = "0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8";
const MANDATE = "0x5BA600798E834E12b48648488C7eb12d92e0a32c";
const DEPOSIT = 800_000000n; // 800 cUSDT (6dp units)
const PRIZE = 1000_000000n; // 1,000 cUSDT prize
const SEED = id("ajo-demo-full-round-2026-v2");

const A = JSON.parse(readFileSync(new URL("../artifacts/contracts/ConfidentialPool.sol/ConfidentialPool.json", import.meta.url), "utf8"));
const CUSDT_ABI = [
  "function faucet(uint64 amount) returns (bytes32)",
  "function confidentialTransferAndCall(address to, bytes32 encryptedAmount, bytes inputProof, bytes data) returns (bytes32)",
];
const POOL_ABI = [
  "function harvestYield(uint64 amount)",
  "function setDepositor(address gateway, bool allowed)",
  "function commitRound(bytes32 commitment, uint256 revealWindow)",
  "function revealSeed(bytes32 seed)",
  "function tallyDraw(uint256 count)",
  "function runDraw(uint256 count)",
  "function claim()",
  "function disclosePublicTotal()",
  "function phase() view returns (uint8)",
  "function drawComplete() view returns (bool)",
  "function jackpot() view returns (uint64)",
];

function wallet() {
  const provider = new JsonRpcProvider(RPC);
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0");
  return new Wallet(hd.privateKey, provider);
}

const proofs = [];
let GP = 2_000_000_000n;
async function send(label, contract, method, args, gas) {
  process.stdout.write(`\n▶ ${label} … `);
  const tx = await contract[method](...args, { gasLimit: gas, gasPrice: GP });
  process.stdout.write(`tx ${tx.hash}\n`);
  const rc = await tx.wait();
  console.log(`  ${rc.status === 1 ? "✅" : "❌"} block ${rc.blockNumber} gas ${rc.gasUsed}`);
  proofs.push({ step: label, txHash: tx.hash });
  if (rc.status !== 1) throw new Error(`${label} reverted`);
  return rc;
}

async function main() {
  const w = wallet();
  const p = w.provider;
  GP = ((await p.getFeeData()).gasPrice ?? 1_500_000_000n) * 2n;
  console.log("Deployer/host/sole-saver:", w.address, "· bal", (await p.getBalance(w.address)).toString(), "wei · gp", GP.toString());

  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });

  // 0) deploy the fresh circle on the canonical cUSDT
  process.stdout.write("\n▶ deploy circle … ");
  const pool = await new ContractFactory(A.abi, A.bytecode, w).deploy(CUSDT, { gasPrice: GP });
  await pool.waitForDeployment();
  const POOL = await pool.getAddress();
  console.log(`tx ${pool.deploymentTransaction().hash}\n  ✅ ${POOL}`);

  const cusdt = new Contract(CUSDT, CUSDT_ABI, w);
  const pc = new Contract(POOL, POOL_ABI, w);

  await send("faucet cUSDT", cusdt, "faucet", [DEPOSIT], 2_000_000n);

  const encDep = await fhe.createEncryptedInput(CUSDT, w.address).add64(DEPOSIT).encrypt();
  await send("deposit (confidentialTransferAndCall)", cusdt, "confidentialTransferAndCall", [POOL, hexlify(encDep.handles[0]), hexlify(encDep.inputProof), "0x"], 6_000_000n);

  await send("harvestYield (fund jackpot)", pc, "harvestYield", [PRIZE], 2_500_000n);
  await send("setDepositor (Shield mandate)", pc, "setDepositor", [MANDATE, true], 150_000n);
  await send("commitRound", pc, "commitRound", [keccak256(SEED), 3600n], 600_000n);
  await send("revealSeed", pc, "revealSeed", [SEED], 500_000n);
  await send("tallyDraw", pc, "tallyDraw", [1n], 6_000_000n);
  await send("runDraw (single winner over ciphertext)", pc, "runDraw", [1n], 6_000_000n);
  await send("claim (winner payout)", pc, "claim", [], 3_000_000n);
  await send("disclosePublicTotal", pc, "disclosePublicTotal", [], 600_000n);

  const [ph, dc, jp] = await Promise.all([pc.phase(), pc.drawComplete(), pc.jackpot()]);
  console.log(`\nFinal state: phase ${["Open", "Committed", "Revealed"][Number(ph)]} · drawComplete ${dc} · jackpot ${Number(jp) / 1e6} cUSDT`);
  console.log("remaining:", (await p.getBalance(w.address)).toString(), "wei");

  writeFileSync(new URL("../deployments/demo-circle.json", import.meta.url), JSON.stringify({ address: POOL, seed: SEED, proofs }, null, 2));
  console.log("\n✅ full round complete →", POOL);
  proofs.forEach((x) => console.log(`  ${x.step.padEnd(38)} https://sepolia.etherscan.io/tx/${x.txHash}`));
}

main().catch((e) => {
  console.error("\n❌ FAILED:", e.message);
  if (proofs.length) console.error("done so far:", proofs.map((p) => p.step).join(" · "));
  process.exit(1);
});
