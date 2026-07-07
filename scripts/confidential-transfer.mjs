// Fires a REAL confidential transfer on Sepolia: encrypts the amount with the
// Zama relayer SDK (node build), then calls confidentialTransfer so the amount
// travels as ciphertext + input proof and is computed on-chain without ever
// being revealed.
//
//   node scripts/confidential-transfer.mjs [recipient] [amount]
//
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, Mnemonic, HDNodeWallet, hexlify, Transaction } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CONTRACT = process.env.CONTRACT_ADDRESS || "0xe4292f6aF1FA9668713269bE1643354a557BF342";
const RECIPIENT = process.argv[2] || "0xE45E6b01742CDB4e3aECFEb364b2967415C551c1"; // account #1
const AMOUNT = BigInt(process.argv[3] || "2500");
const RPCS = [
  process.env.SEPOLIA_RPC_URL,
  "https://sepolia.drpc.org",
  "https://eth-sepolia.public.blastapi.io",
  "https://ethereum-sepolia-rpc.publicnode.com",
].filter(Boolean);

const ABI = ["function confidentialTransfer(address to, bytes32 encryptedAmount, bytes inputProof)"];

function loadWallet(provider) {
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0");
  return new Wallet(hd.privateKey, provider);
}

async function liveProvider() {
  for (const url of RPCS) {
    try {
      const p = new JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch {
      /* next */
    }
  }
  throw new Error("no live RPC");
}

async function broadcastRaw(signed) {
  for (let a = 0; a < 3; a++) {
    for (const url of RPCS) {
      try {
        return (await new JsonRpcProvider(url).broadcastTransaction(signed)).hash;
      } catch (e) {
        const m = (e.message || "").toLowerCase();
        if (m.includes("already known") || m.includes("known transaction")) return Transaction.from(signed).hash;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("broadcast failed on all RPCs");
}

async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) {
    for (const url of RPCS) {
      try {
        const r = await new JsonRpcProvider(url).getTransactionReceipt(hash);
        if (r) return r;
      } catch {
        /* next */
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("receipt not found");
}

async function main() {
  const provider = await liveProvider();
  const wallet = loadWallet(provider);
  console.log("Sender:    ", wallet.address);
  console.log("Recipient: ", RECIPIENT);
  console.log("Amount:    ", AMOUNT.toString(), "(will be encrypted before it leaves this process)");

  console.log("\nInitializing relayer instance + encrypting amount ...");
  const instance = await createInstance({ ...SepoliaConfig, network: RPCS[RPCS.length - 1] });
  const enc = await instance.createEncryptedInput(CONTRACT, wallet.address).add64(AMOUNT).encrypt();
  const encHandle = hexlify(enc.handles[0]);
  const inputProof = hexlify(enc.inputProof);
  console.log("Ciphertext handle:", encHandle);
  console.log("Input proof bytes:", inputProof.length / 2 - 1);

  const contract = new Contract(CONTRACT, ABI, wallet);
  const data = (await contract.confidentialTransfer.populateTransaction(RECIPIENT, encHandle, inputProof)).data;

  let gasLimit = 3_000_000n;
  try {
    gasLimit = ((await provider.estimateGas({ from: wallet.address, to: CONTRACT, data })) * 12n) / 10n;
  } catch {
    console.log("(gas estimate failed — using 3,000,000 fallback)");
  }
  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  const fee = await provider.getFeeData();
  const signed = await wallet.signTransaction({
    to: CONTRACT,
    data,
    nonce,
    chainId: 11155111,
    type: 2,
    gasLimit,
    maxFeePerGas: fee.maxFeePerGas ?? 3_000_000_000n,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 1_500_000_000n,
  });

  console.log("\nBroadcasting confidentialTransfer ...");
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
