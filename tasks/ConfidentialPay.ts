import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

// Resolve the deployed ConfidentialPay instance, letting --address override the
// last hardhat-deploy record (useful right after a fresh deploy).
async function getContract(hre: any, address?: string) {
  const { ethers, deployments } = hre;
  const addr = address ?? (await deployments.get("ConfidentialPay")).address;
  const contract = await ethers.getContractAt("ConfidentialPay", addr);
  return { contract, addr };
}

task("confidential-pay:address", "Prints the deployed ConfidentialPay address").setAction(async (_a, hre) => {
  const { deployments } = hre;
  const d = await deployments.get("ConfidentialPay");
  console.log("ConfidentialPay:", d.address);
});

task("confidential-pay:faucet", "Claim the one-time encrypted faucet")
  .addOptionalParam("address", "Contract address override")
  .setAction(async (args: TaskArguments, hre) => {
    const { contract } = await getContract(hre, args.address);
    const tx = await contract.claimFaucet();
    console.log("claimFaucet tx:", tx.hash);
    await tx.wait();
    console.log("Faucet claimed — encrypted balance seeded.");
  });

task("confidential-pay:balance", "User-decrypt the caller's encrypted balance")
  .addOptionalParam("address", "Contract address override")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, fhevm } = hre;
    const { contract, addr } = await getContract(hre, args.address);
    const [signer] = await ethers.getSigners();

    const handle = await contract.balanceOf(signer.address);
    if (handle === ethers.ZeroHash) {
      console.log("Balance handle is uninitialized (== encrypted 0).");
      return;
    }
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, handle, addr, signer);
    console.log(`Encrypted handle: ${handle}`);
    console.log(`Decrypted balance (only you can read this): ${clear.toString()}`);
  });

task("confidential-pay:transfer", "Send a confidential transfer")
  .addParam("to", "Recipient address")
  .addParam("amount", "Clear amount to encrypt and send")
  .addOptionalParam("address", "Contract address override")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, fhevm } = hre;
    const { contract, addr } = await getContract(hre, args.address);
    const [signer] = await ethers.getSigners();

    const enc = await fhevm.createEncryptedInput(addr, signer.address).add64(BigInt(args.amount)).encrypt();
    const tx = await contract.confidentialTransfer(args.to, enc.handles[0], enc.inputProof);
    console.log(`confidentialTransfer tx: ${tx.hash} (amount encrypted on-chain)`);
    await tx.wait();
    console.log(`Sent a confidential amount to ${args.to}.`);
  });
