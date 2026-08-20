// Deploy the two new confidential-pool mechanisms on the canonical cUSDT and seed each with live,
// verifiable state: a settled sealed-bid chit round, and a tontine paying a survivor dividend.
//   node scripts/deploy-mechanisms.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, ContractFactory, Mnemonic, HDNodeWallet, hexlify } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CUSDT = "0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8";
const U = 1_000000n; // 1 cUSDT in 6dp units

const art = (n) => JSON.parse(readFileSync(new URL(`../artifacts/contracts/${n}.sol/${n}.json`, import.meta.url), "utf8"));
const CUSDT_ABI = [
  "function faucet(uint64 amount) returns (bytes32)",
  "function confidentialTransferAndCall(address to, bytes32 encryptedAmount, bytes inputProof, bytes data) returns (bytes32)",
];

function wallet() {
  const p = new JsonRpcProvider(RPC);
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0");
  return new Wallet(hd.privateKey, p);
}

let GP;
const out = {};
async function tx(label, promise) {
  process.stdout.write(`  ${label} … `);
  const t = await promise;
  const r = await t.wait();
  console.log(`${r.status === 1 ? "✅" : "❌"} ${t.hash} (gas ${r.gasUsed})`);
  if (r.status !== 1) throw new Error(`${label} reverted`);
  return t.hash;
}

async function main() {
  const w = wallet();
  GP = ((await w.provider.getFeeData()).gasPrice ?? 1_500_000_000n) * 2n;
  console.log("Deployer:", w.address, "· gp", GP.toString(), "\n");
  const fhe = await createInstance({ ...SepoliaConfig, network: RPC });
  const cusdt = new Contract(CUSDT, CUSDT_ABI, w);
  const encFor = async (addr, amt) => {
    const e = await fhe.createEncryptedInput(addr, w.address).add64(amt).encrypt();
    return [hexlify(e.handles[0]), hexlify(e.inputProof)];
  };

  // ── 1. Sealed-bid chit fund ────────────────────────────────────────────────────────────
  console.log("▶ ConfidentialChit (sealed-bid chit fund)");
  const A = art("ConfidentialChit");
  const chit = await new ContractFactory(A.abi, A.bytecode, w).deploy(CUSDT, { gasPrice: GP });
  await chit.waitForDeployment();
  const chitAddr = await chit.getAddress();
  console.log("  deployed", chitAddr);
  const c = new Contract(chitAddr, A.abi, w);

  await tx("faucet cUSDT", cusdt.faucet(2000n * U, { gasPrice: GP, gasLimit: 2_000_000n }));
  {
    const [h, p] = await encFor(CUSDT, 2000n * U);
    await tx("deposit 2000", cusdt["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](chitAddr, h, p, "0x", { gasPrice: GP, gasLimit: 6_000_000n }));
  }
  await tx("fundPot 1000", c.fundPot(1000n * U, { gasPrice: GP, gasLimit: 2_500_000n }));
  await tx("openBidding", c.openBidding({ gasPrice: GP, gasLimit: 500_000n }));
  {
    const [h, p] = await encFor(chitAddr, 300n * U);
    await tx("submitBid 300", c.submitBid(h, p, { gasPrice: GP, gasLimit: 2_000_000n }));
  }
  await tx("tallyBids", c.tallyBids(1, { gasPrice: GP, gasLimit: 3_000_000n }));
  await tx("settle", c.settle(1, { gasPrice: GP, gasLimit: 3_000_000n }));
  await tx("claim", c.claim(0, { gasPrice: GP, gasLimit: 3_000_000n }));
  out.chit = chitAddr;

  // ── 2. Confidential tontine ────────────────────────────────────────────────────────────
  console.log("\n▶ ConfidentialTontine (survivorship pool)");
  const T = art("ConfidentialTontine");
  const ton = await new ContractFactory(T.abi, T.bytecode, w).deploy(CUSDT, { gasPrice: GP });
  await ton.waitForDeployment();
  const tonAddr = await ton.getAddress();
  console.log("  deployed", tonAddr);
  const t = new Contract(tonAddr, T.abi, w);

  await tx("faucet cUSDT", cusdt.faucet(1000n * U, { gasPrice: GP, gasLimit: 2_000_000n }));
  {
    const [h, p] = await encFor(CUSDT, 1000n * U);
    await tx("deposit 1000 (join)", cusdt["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](tonAddr, h, p, "0x", { gasPrice: GP, gasLimit: 6_000_000n }));
  }
  await tx("payDividend 300", t.payDividend(300n * U, { gasPrice: GP, gasLimit: 2_500_000n }));
  await tx("payDividend 300 (again)", t.payDividend(300n * U, { gasPrice: GP, gasLimit: 2_500_000n }));
  await tx("syncDividend", t.syncDividend({ gasPrice: GP, gasLimit: 1_000_000n }));
  out.tontine = tonAddr;

  writeFileSync(new URL("../deployments/mechanisms-sepolia.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log("\n✅ deployed:", out);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
