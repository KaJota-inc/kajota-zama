// Dry-run the TokenOps confidential-disperse beat: encrypt several amounts and
// send them to multiple recipients in one confidentialDisperse call — exactly
// what the frontend "Disperse privately" button does.
//
//   node scripts/disperse-dry-run.mjs
//
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, Mnemonic, HDNodeWallet, hexlify, Transaction } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CONTRACT = process.env.CONTRACT_ADDRESS || "0xe4292f6aF1FA9668713269bE1643354a557BF342";
const RPCS = [process.env.SEPOLIA_RPC_URL, "https://sepolia.drpc.org", "https://eth-sepolia.public.blastapi.io"].filter(Boolean);
const ABI = ["function confidentialDisperse(address[] recipients, bytes32[] encryptedAmounts, bytes[] inputProofs)"];

function hd(index) {
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), `m/44'/60'/0'/0/${index}`);
}

async function broadcastRaw(signed) {
  for (let a = 0; a < 3; a++) {
    for (const url of RPCS) {
      try {
        return (await new JsonRpcProvider(url).broadcastTransaction(signed)).hash;
      } catch (e) {
        if ((e.message || "").toLowerCase().includes("known")) return Transaction.from(signed).hash;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("broadcast failed");
}

async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) {
    for (const url of RPCS) {
      try {
        const r = await new JsonRpcProvider(url).getTransactionReceipt(hash);
        if (r) return r;
      } catch { /* next */ }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("receipt not found");
}

async function main() {
  const provider = new JsonRpcProvider(RPCS[0]);
  const wallet = new Wallet(hd(0).privateKey, provider);
  const recipients = [hd(2).address, hd(3).address];
  const amounts = [500n, 750n];
  console.log("Sender:    ", wallet.address);
  recipients.forEach((r, i) => console.log(`Recipient ${i}:`, r, "amount", amounts[i].toString(), "(will be encrypted)"));

  console.log("\nInitializing relayer + encrypting", amounts.length, "amounts ...");
  const instance = await createInstance({ ...SepoliaConfig, network: RPCS[0] });
  const handles = [];
  const proofs = [];
  for (const amt of amounts) {
    const enc = await instance.createEncryptedInput(CONTRACT, wallet.address).add64(amt).encrypt();
    handles.push(hexlify(enc.handles[0]));
    proofs.push(hexlify(enc.inputProof));
  }
  console.log("Encrypted handles:", handles.map((h) => h.slice(0, 14) + "…"));

  const contract = new Contract(CONTRACT, ABI, wallet);
  const data = (await contract.confidentialDisperse.populateTransaction(recipients, handles, proofs)).data;
  let gasLimit = 4_000_000n;
  try {
    gasLimit = ((await provider.estimateGas({ from: wallet.address, to: CONTRACT, data })) * 12n) / 10n;
  } catch {
    console.log("(gas estimate failed — using 4,000,000 fallback)");
  }
  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  const fee = await provider.getFeeData();
  const signed = await wallet.signTransaction({
    to: CONTRACT, data, nonce, chainId: 11155111, type: 2, gasLimit,
    maxFeePerGas: fee.maxFeePerGas ?? 3_000_000_000n,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 1_500_000_000n,
  });

  console.log("\nBroadcasting confidentialDisperse ...");
  const hash = await broadcastRaw(signed);
  console.log("tx hash:   ", hash);
  const rc = await waitReceipt(hash);
  console.log("status:    ", rc.status === 1 ? "SUCCESS ✅" : "FAILED", "block", rc.blockNumber, "gasUsed", rc.gasUsed?.toString());
  console.log("explorer:   https://sepolia.etherscan.io/tx/" + hash);
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
