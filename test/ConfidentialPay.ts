import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialPay, ConfidentialPay__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialPay")) as ConfidentialPay__factory;
  const contract = (await factory.deploy()) as ConfidentialPay;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("ConfidentialPay", function () {
  let signers: Signers;
  let contract: ConfidentialPay;
  let address: string;

  const FAUCET = 10_000n;

  // Helper: user-decrypt an account's balance handle as `who`.
  async function decryptBalance(who: HardhatEthersSigner, account: string): Promise<bigint> {
    const handle = await contract.balanceOf(account);
    if (handle === ethers.ZeroHash) return 0n;
    return await fhevm.userDecryptEuint(FhevmType.euint64, handle, address, who);
  }

  // Helper: build an external encrypted euint64 input bound to (contract, caller).
  async function encAmount(caller: HardhatEthersSigner, value: bigint | number) {
    return await fhevm.createEncryptedInput(address, caller.address).add64(value).encrypt();
  }

  before(async function () {
    const eth: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: eth[0], alice: eth[1], bob: eth[2], carol: eth[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
    ({ contract, address } = await deployFixture());
  });

  it("balance is uninitialized before any faucet claim", async function () {
    const handle = await contract.balanceOf(signers.alice.address);
    expect(handle).to.eq(ethers.ZeroHash);
  });

  it("faucet seeds an encrypted balance of FAUCET_AMOUNT", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();

    expect(await contract.hasClaimed(signers.alice.address)).to.eq(true);
    expect(await decryptBalance(signers.alice, signers.alice.address)).to.eq(FAUCET);
  });

  it("faucet cannot be claimed twice", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();
    await expect(contract.connect(signers.alice).claimFaucet()).to.be.revertedWith("ConfidentialPay: already claimed");
  });

  it("confidentially transfers an encrypted amount", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();

    const enc = await encAmount(signers.alice, 3_000);
    await (
      await contract.connect(signers.alice).confidentialTransfer(signers.bob.address, enc.handles[0], enc.inputProof)
    ).wait();

    expect(await decryptBalance(signers.alice, signers.alice.address)).to.eq(FAUCET - 3_000n);
    expect(await decryptBalance(signers.bob, signers.bob.address)).to.eq(3_000n);
  });

  it("clamps an overspend to zero without reverting (no balance leak)", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();

    // Alice tries to send more than she owns; the transfer must silently move 0.
    const enc = await encAmount(signers.alice, 999_999);
    await (
      await contract.connect(signers.alice).confidentialTransfer(signers.bob.address, enc.handles[0], enc.inputProof)
    ).wait();

    expect(await decryptBalance(signers.alice, signers.alice.address)).to.eq(FAUCET);
    expect(await decryptBalance(signers.bob, signers.bob.address)).to.eq(0n);
  });

  it("emits ConfidentialTransfer without revealing the amount", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();
    const enc = await encAmount(signers.alice, 1_234);
    await expect(
      contract.connect(signers.alice).confidentialTransfer(signers.bob.address, enc.handles[0], enc.inputProof),
    )
      .to.emit(contract, "ConfidentialTransfer")
      .withArgs(signers.alice.address, signers.bob.address);
  });

  it("confidentially disperses to multiple recipients in one call", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();

    const toBob = await encAmount(signers.alice, 2_000);
    const toCarol = await encAmount(signers.alice, 1_500);

    await (
      await contract
        .connect(signers.alice)
        .confidentialDisperse(
          [signers.bob.address, signers.carol.address],
          [toBob.handles[0], toCarol.handles[0]],
          [toBob.inputProof, toCarol.inputProof],
        )
    ).wait();

    expect(await decryptBalance(signers.alice, signers.alice.address)).to.eq(FAUCET - 3_500n);
    expect(await decryptBalance(signers.bob, signers.bob.address)).to.eq(2_000n);
    expect(await decryptBalance(signers.carol, signers.carol.address)).to.eq(1_500n);
  });

  it("does not grant a third party decryption rights over someone else's balance", async function () {
    await (await contract.connect(signers.alice).claimFaucet()).wait();
    const handle = await contract.balanceOf(signers.alice.address);
    // Bob was never granted ACL access to Alice's balance handle.
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, handle, address, signers.bob)).to.be.rejected;
  });
});
