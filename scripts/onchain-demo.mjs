// Fires real on-chain transactions against the deployed ConfidentialPay contract
// to produce verifiable proof for the Zama Season 3 submission.
//
//   node scripts/onchain-demo.mjs            # claim faucet from the deployer account
//
// The faucet call executes FHE operations on-chain (FHE.asEuint64 + FHE.add + ACL
// grants), so it is a genuine confidential-compute transaction, not a plain transfer.
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, Mnemonic, HDNodeWallet, formatEther } from "ethers";

const ADDRESS = process.env.CONTRACT_ADDRESS || "0xe4292f6aF1FA9668713269bE1643354a557BF342";
const RPCS = [
  process.env.SEPOLIA_RPC_URL,
  "https://sepolia.drpc.org",
  "https://eth-sepolia.public.blastapi.io",
  "https://endpoints.omniatech.io/v1/eth/sepolia/public",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
  "https://rpc.sepolia.org",
].filter(Boolean);

const ABI = [
  "function claimFaucet()",
  "function hasClaimed(address) view returns (bool)",
  "function balanceOf(address) view returns (bytes32)",
  "event FaucetClaimed(address indexed account)",
];

function loadWallet(provider) {
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), "m/44'/60'/0'/0/0");
  return new Wallet(hd.privateKey, provider);
}

async function firstLiveProvider() {
  for (const url of RPCS) {
    try {
      const p = new JsonRpcProvider(url);
      await p.getBlockNumber();
      return { p, url };
    } catch {
      /* try next */
    }
  }
  throw new Error("no live Sepolia RPC");
}

// Broadcast a pre-signed raw tx across RPCs until one accepts it (or reports it
// already known). Same signed bytes => same tx hash, so multi-broadcast is safe.
async function broadcastRaw(signed) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of RPCS) {
      try {
        const r = await new JsonRpcProvider(url).broadcastTransaction(signed);
        return r.hash;
      } catch (e) {
        const m = (e.message || "").toLowerCase();
        if (m.includes("already known") || m.includes("nonce") || m.includes("known transaction")) {
          // Already in a mempool — recover the hash from the signed bytes.
          const { Transaction } = await import("ethers");
          return Transaction.from(signed).hash;
        }
        lastErr = e;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("broadcast failed on all RPCs: " + (lastErr?.message || "unknown"));
}

// Wait for a receipt by polling across RPCs (public endpoints drop long-lived sockets).
async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) {
    for (const url of RPCS) {
      try {
        const r = await new JsonRpcProvider(url).getTransactionReceipt(hash);
        if (r) return r;
      } catch {
        /* try next rpc */
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("receipt not found after polling");
}

async function main() {
  const { p, url } = await firstLiveProvider();
  const wallet = loadWallet(p);
  console.log("RPC:        ", url);
  console.log("Signer:     ", wallet.address);
  console.log("Balance:    ", formatEther(await p.getBalance(wallet.address)), "ETH");
  console.log("Contract:   ", ADDRESS);

  const contract = new Contract(ADDRESS, ABI, wallet);

  if (await contract.hasClaimed(wallet.address)) {
    console.log("\nAlready claimed faucet from this account.");
    console.log("Encrypted balance handle:", await contract.balanceOf(wallet.address));
    return;
  }

  console.log("\nBuilding + signing claimFaucet() ...");
  const populated = await contract.claimFaucet.populateTransaction();
  const nonce = await p.getTransactionCount(wallet.address, "latest");
  const fee = await p.getFeeData();
  const signed = await wallet.signTransaction({
    to: ADDRESS,
    data: populated.data,
    nonce,
    chainId: 11155111,
    type: 2,
    gasLimit: 300000n,
    maxFeePerGas: fee.maxFeePerGas ?? 3000000000n,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 1500000000n,
  });
  const hash = await broadcastRaw(signed);
  console.log("tx hash:    ", hash);
  const rc = await waitReceipt(hash);
  console.log("status:     ", rc.status === 1 ? "SUCCESS ✅" : "FAILED", "block", rc.blockNumber);
  console.log("explorer:    https://sepolia.etherscan.io/tx/" + hash);
  console.log("\nEncrypted balance handle (ciphertext):", await contract.balanceOf(wallet.address));
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
