import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialUSDT, ConfidentialChit, ConfidentialTontine } from "../../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

const TAC = "confidentialTransferAndCall(address,bytes32,bytes,bytes)";

// Two older ways to run a confidential pool, from the history of pooled money — proven over
// ciphertext on the FHEVM mock, alongside the random-draw base pool (the "Premium Bonds" mode).
describe("History's confidential pools", function () {
  let owner: HardhatEthersSigner, alice: HardhatEthersSigner, bob: HardhatEthersSigner, carol: HardhatEthersSigner;
  let cusdt: ConfidentialUSDT, cusdtAddr: string;

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();
    cusdt = (await (await ethers.getContractFactory("ConfidentialUSDT")).deploy()) as ConfidentialUSDT;
    cusdtAddr = await cusdt.getAddress();
  });

  async function deposit(to: string, user: HardhatEthersSigner, amount: number) {
    await (await cusdt.connect(user).faucet(amount)).wait();
    const enc = await fhevm.createEncryptedInput(cusdtAddr, user.address).add64(amount).encrypt();
    await (await cusdt.connect(user)[TAC](to, enc.handles[0], enc.inputProof, "0x")).wait();
  }
  async function bal(c: ConfidentialChit | ConfidentialTontine, addr: string, u: HardhatEthersSigner): Promise<bigint> {
    const h = await c.balanceOf(u.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, addr, u);
  }

  describe("Sealed-bid chit fund", function () {
    it("the highest sealed bid wins the pot minus the bid; the discount is split to the rest", async () => {
      const chit = (await (await ethers.getContractFactory("ConfidentialChit")).deploy(cusdtAddr)) as ConfidentialChit;
      const chitAddr = await chit.getAddress();

      await deposit(chitAddr, alice, 2000);
      await deposit(chitAddr, bob, 2000);
      await (await chit.connect(owner).fundPot(1000)).wait();
      await (await chit.connect(owner).openBidding()).wait();

      // alice bids a bigger discount (300) than bob (100) → alice wins
      const a = await fhevm.createEncryptedInput(chitAddr, alice.address).add64(300).encrypt();
      await (await chit.connect(alice).submitBid(a.handles[0], a.inputProof)).wait();
      const b = await fhevm.createEncryptedInput(chitAddr, bob.address).add64(100).encrypt();
      await (await chit.connect(bob).submitBid(b.handles[0], b.inputProof)).wait();

      await (await chit.connect(owner).tallyBids(2)).wait();
      await (await chit.connect(owner).settle(2)).wait();

      // the clearing price is public; the individual bids are not
      expect(await fhevm.publicDecryptEuint(FhevmType.euint64, await chit.winningBid())).to.eq(300n);

      await (await chit.connect(alice).claim(0)).wait();
      await (await chit.connect(bob).claim(0)).wait();

      // winner alice: 2000 + (pot 1000 − her bid 300) = 2700
      expect(await bal(chit, chitAddr, alice)).to.eq(2700n);
      // loser bob: 2000 + the whole forgone discount (300 / 1 other) = 2300
      expect(await bal(chit, chitAddr, bob)).to.eq(2300n);
    });
  });

  describe("Confidential tontine", function () {
    it("the survivor dividend grows as members exit; late-leavers out-earn early ones", async () => {
      const t = (await (
        await ethers.getContractFactory("ConfidentialTontine")
      ).deploy(cusdtAddr)) as ConfidentialTontine;
      const tAddr = await t.getAddress();

      await deposit(tAddr, alice, 1000);
      await deposit(tAddr, bob, 1000);
      await deposit(tAddr, carol, 1000);
      expect(await t.activeCount()).to.eq(3n);

      // 3 survivors share 300 → 100 each
      await (await t.connect(owner).payDividend(300)).wait();
      expect(await t.accDividend()).to.eq(100n);

      // alice exits early, banking her 100; two survivors remain
      await (await t.connect(alice).exit()).wait();
      expect(await t.activeCount()).to.eq(2n);

      // now 2 survivors share 300 → 150 each (the dividend grew)
      await (await t.connect(owner).payDividend(300)).wait();
      expect(await t.accDividend()).to.eq(250n);

      await (await t.connect(bob).syncDividend()).wait();

      // alice left after one dividend: 1000 + 100 = 1100
      expect(await bal(t, tAddr, alice)).to.eq(1100n);
      // bob stayed for both (100 + 150): 1000 + 250 = 1250 — the survivor out-earns the leaver
      expect(await bal(t, tAddr, bob)).to.eq(1250n);
    });
  });
});
