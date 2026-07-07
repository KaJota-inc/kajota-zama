// Dry-run the user-decryption beat: read an account's ciphertext balance handle,
// then run the EIP-712 keypair/signature handshake so the KMS returns the clear
// value — exactly what the frontend "Decrypt my balance" button does.
//
//   node scripts/decrypt-balance.mjs
//
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, Mnemonic, HDNodeWallet } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

const CONTRACT = process.env.CONTRACT_ADDRESS || "0xe4292f6aF1FA9668713269bE1643354a557BF342";
const RPC = process.env.SEPOLIA_RPC_URL || "https://sepolia.drpc.org";
const ABI = ["function balanceOf(address) view returns (bytes32)"];

function loadWallet(provider, index = 0) {
  const phrase = readFileSync(new URL("../.secret.mnemonic", import.meta.url), "utf8").trim();
  const hd = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), `m/44'/60'/0'/0/${index}`);
  return new Wallet(hd.privateKey, provider);
}

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const wallet = loadWallet(provider, 0);
  const contract = new Contract(CONTRACT, ABI, wallet);

  const handle = await contract.balanceOf(wallet.address);
  console.log("Account:          ", wallet.address);
  console.log("On-chain handle:  ", handle, "(ciphertext)");
  if (/^0x0+$/.test(handle)) {
    console.log("Balance is uninitialized (claim the faucet first).");
    return;
  }

  console.log("\nInitializing relayer + EIP-712 user-decryption handshake ...");
  const instance = await createInstance({ ...SepoliaConfig, network: RPC });
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const contractAddresses = [CONTRACT];

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
  const signature = await wallet.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  const result = await instance.userDecrypt(
    [{ handle, contractAddress: CONTRACT }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    contractAddresses,
    wallet.address,
    startTimestamp,
    durationDays,
  );

  const clear = result[handle] ?? result[handle.toLowerCase()];
  console.log("\nDecrypted balance:", BigInt(clear).toString(), "✅ (visible only to this account)");
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
