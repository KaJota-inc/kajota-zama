import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialPool, ConfidentialUSDT } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = { owner: HardhatEthersSigner; alice: HardhatEthersSigner; bob: HardhatEthersSigner; carol: HardhatEthersSigner };

const TWO_POW_64 = 1n << 64n;
const PRIZE_DATA = ethers.hexlify(ethers.toUtf8Bytes("PRIZE"));
const TRANSFER_AND_CALL = "confidentialTransferAndCall(address,bytes32,bytes,bytes)";

// ── Off-chain mirror of the contract's cumulative single-winner draw ──────────────────────
function drawTarget(roundId: bigint, seed: string, drawTotal: bigint): bigint {
  const r = BigInt(ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [roundId, seed]))) & (TWO_POW_64 - 1n);
  return (r * drawTotal) / TWO_POW_64; // integer division, uniform in [0, drawTotal)
}
// balances in participant (deposit) order → index of the single winner, or -1 (slot vacated)
function winnerIndex(target: bigint, balances: bigint[]): number {
  let prefix = 0n;
  for (let i = 0; i < balances.length; i++) {
    const upper = prefix + balances[i];
    if (prefix <= target && target < upper) return i;
    prefix = upper;
  }
  return -1;
}

describe("ConfidentialPool v2 — Àjọ single-winner draw", function () {
  let s: Signers;
  let cusdt: ConfidentialUSDT;
  let pool: ConfidentialPool;
  let cusdtAddr: string;
  let poolAddr: string;

  async function deployFixture() {
    const Token = await ethers.getContractFactory("ConfidentialUSDT");
    const token = (await Token.deploy()) as ConfidentialUSDT;
    const Pool = await ethers.getContractFactory("ConfidentialPool");
    const p = (await Pool.deploy(await token.getAddress())) as ConfidentialPool;
    return { token, pool: p, cusdtAddr: await token.getAddress(), poolAddr: await p.getAddress() };
  }

  async function deposit(user: HardhatEthersSigner, amount: bigint | number) {
    await (await cusdt.connect(user).faucet(amount)).wait();
    const enc = await fhevm.createEncryptedInput(cusdtAddr, user.address).add64(amount).encrypt();
    await (await cusdt.connect(user)[TRANSFER_AND_CALL](poolAddr, enc.handles[0], enc.inputProof, "0x")).wait();
  }

  async function poolBalance(user: HardhatEthersSigner): Promise<bigint> {
    const h = await pool.balanceOf(user.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, user);
  }
  async function tokenBalance(user: HardhatEthersSigner): Promise<bigint> {
    const h = await cusdt.confidentialBalanceOf(user.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, cusdtAddr, user);
  }

  // Harvest yield → commit → reveal → run the full draw.
  async function runDrawRound(seed: string, yieldAmt: bigint | number) {
    await (await pool.connect(s.owner).harvestYield(yieldAmt)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(seed), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(seed)).wait();
    const n = await pool.participantsCount();
    await (await pool.connect(s.owner).runDraw(n)).wait();
  }

  before(async function () {
    const eth = await ethers.getSigners();
    s = { owner: eth[0], alice: eth[1], bob: eth[2], carol: eth[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    ({ token: cusdt, pool, cusdtAddr, poolAddr } = await deployFixture());
  });

  // ── Deposits & confidentiality ────────────────────────────────────────────────────────
  it("credits an encrypted balance on deposit", async function () {
    await deposit(s.alice, 1_000);
    expect(await poolBalance(s.alice)).to.eq(1_000n);
    expect(await tokenBalance(s.alice)).to.eq(0n);
  });

  it("accumulates deposits and tracks participants", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.alice, 500);
    await deposit(s.bob, 2_000);
    expect(await poolBalance(s.alice)).to.eq(1_500n);
    expect(await pool.participantsCount()).to.eq(2n);
  });

  it("keeps balances confidential from strangers", async function () {
    await deposit(s.alice, 1_000);
    const h = await pool.balanceOf(s.alice.address);
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, s.bob)).to.be.rejected;
  });

  it("discloses only the aggregate total when the operator opts in", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.bob, 3_000);
    await (await pool.connect(s.owner).disclosePublicTotal()).wait();
    expect(await fhevm.publicDecryptEuint(FhevmType.euint64, await pool.totalPooled())).to.eq(4_000n);
  });

  // ── Yield → jackpot ─────────────────────────────────────────────────────────────────────
  it("grows a public rollover jackpot from harvested yield", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(200)).wait();
    expect(await pool.jackpot()).to.eq(200n);
    await (await pool.connect(s.owner).harvestYield(300)).wait();
    expect(await pool.jackpot()).to.eq(500n); // rolled over / accumulated
  });

  it("cannot commit a round with an empty pool or zero jackpot", async function () {
    await expect(pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("x")), 3600)).to.be.revertedWithCustomError(pool, "EmptyPool");
    await deposit(s.alice, 1_000);
    await expect(pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("x")), 3600)).to.be.revertedWithCustomError(pool, "EmptyPool");
  });

  // ── Single-winner draw ──────────────────────────────────────────────────────────────────
  it("a sole depositor always wins the jackpot", async function () {
    await deposit(s.alice, 1_000);
    await runDrawRound(ethers.id("solo"), 500);
    await (await pool.connect(s.alice).claim()).wait();
    expect(await poolBalance(s.alice)).to.eq(1_500n);
  });

  it("picks exactly ONE winner, matching the off-chain cumulative spec", async function () {
    const bals = [1_000n, 3_000n, 2_000n];
    await deposit(s.alice, bals[0]);
    await deposit(s.bob, bals[1]);
    await deposit(s.carol, bals[2]);
    const drawTotal = bals[0] + bals[1] + bals[2];
    const jackpotAmt = 900n;

    const seed = ethers.id("three-party");
    await runDrawRound(seed, jackpotAmt);

    const rid = await pool.roundId();
    const wIdx = winnerIndex(drawTarget(rid, seed, drawTotal), bals);
    expect(wIdx).to.be.gte(0); // no withdrawals → a winner exists

    const before = [await poolBalance(s.alice), await poolBalance(s.bob), await poolBalance(s.carol)];
    await (await pool.connect(s.alice).claim()).wait();
    await (await pool.connect(s.bob).claim()).wait();
    await (await pool.connect(s.carol).claim()).wait();
    const after = [await poolBalance(s.alice), await poolBalance(s.bob), await poolBalance(s.carol)];

    let winners = 0;
    for (let i = 0; i < 3; i++) {
      const delta = after[i] - before[i];
      if (delta > 0n) {
        winners++;
        expect(delta).to.eq(jackpotAmt);
        expect(i).to.eq(wIdx); // the on-chain winner is exactly the one the spec predicts
      }
    }
    expect(winners).to.eq(1); // exactly one winner
  });

  it("exactly-one-winner invariant holds across many seeds (fuzz)", async function () {
    const bals = [1_500n, 2_500n, 4_000n];
    await deposit(s.alice, bals[0]);
    await deposit(s.bob, bals[1]);
    await deposit(s.carol, bals[2]);
    const drawTotal = bals[0] + bals[1] + bals[2];

    for (let k = 0; k < 4; k++) {
      const seed = ethers.id(`fuzz-${k}`);
      await runDrawRound(seed, 100);
      const rid = await pool.roundId();
      const wIdx = winnerIndex(drawTarget(rid, seed, drawTotal), bals);

      const signers = [s.alice, s.bob, s.carol];
      // Decrypt sequentially — the mock coprocessor's event cursor races under concurrent userDecrypts.
      const before: bigint[] = [];
      for (const sg of signers) before.push(await poolBalance(sg));
      for (const sg of signers) await (await pool.connect(sg).claim()).wait();
      const after: bigint[] = [];
      for (const sg of signers) after.push(await poolBalance(sg));

      const winners = after.map((a, i) => a - before[i]).filter((d) => d > 0n);
      expect(winners.length).to.eq(1); // one winner every round
      const onchainWinner = after.findIndex((a, i) => a - before[i] > 0n);
      expect(onchainWinner).to.eq(wIdx); // matches the spec every round

      await (await pool.connect(s.owner).closeRound()).wait(); // reset jackpot, next round
    }
  });

  it("cannot claim before the draw is complete", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.bob, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("s")), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(ethers.id("s"))).wait();
    await (await pool.connect(s.owner).runDraw(1)).wait(); // only 1 of 2 processed
    await expect(pool.connect(s.alice).claim()).to.be.revertedWithCustomError(pool, "DrawNotComplete");
  });

  it("paginated runDraw completes across multiple calls", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.bob, 1_000);
    await deposit(s.carol, 1_000);
    await (await pool.connect(s.owner).harvestYield(300)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("p")), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(ethers.id("p"))).wait();
    await (await pool.connect(s.owner).runDraw(2)).wait();
    expect(await pool.drawComplete()).to.eq(false);
    await (await pool.connect(s.owner).runDraw(2)).wait();
    expect(await pool.drawComplete()).to.eq(true);
  });

  it("cannot claim twice", async function () {
    await deposit(s.alice, 1_000);
    await runDrawRound(ethers.id("dbl"), 100);
    await (await pool.connect(s.alice).claim()).wait();
    await expect(pool.connect(s.alice).claim()).to.be.revertedWithCustomError(pool, "AlreadyClaimed");
  });

  // ── Commit–reveal integrity & liveness ─────────────────────────────────────────────────
  it("rejects a reveal that doesn't match the commitment", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("real")), 3600)).wait();
    await expect(pool.connect(s.owner).revealSeed(ethers.id("fake"))).to.be.revertedWithCustomError(pool, "BadReveal");
  });

  it("lets anyone void a round if the operator never reveals", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("s")), 3600)).wait();
    await expect(pool.connect(s.alice).closeRound()).to.be.revertedWithCustomError(pool, "RevealWindowStillOpen");
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);
    await (await pool.connect(s.alice).closeRound()).wait();
    expect(await pool.phase()).to.eq(0n);
  });

  // ── Phase guards & withdraw ─────────────────────────────────────────────────────────────
  it("freezes deposits during a draw but keeps withdrawals open", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("lock")), 3600)).wait();
    await cusdt.connect(s.bob).faucet(1_000);
    const enc = await fhevm.createEncryptedInput(cusdtAddr, s.bob.address).add64(1_000).encrypt();
    await expect(cusdt.connect(s.bob)[TRANSFER_AND_CALL](poolAddr, enc.handles[0], enc.inputProof, "0x")).to.be.reverted;
    const w = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(400).encrypt();
    await (await pool.connect(s.alice).withdraw(w.handles[0], w.inputProof)).wait();
    expect(await poolBalance(s.alice)).to.eq(600n);
  });

  it("withdraws principal and returns cUSDT", async function () {
    await deposit(s.alice, 1_000);
    const w = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(300).encrypt();
    await (await pool.connect(s.alice).withdraw(w.handles[0], w.inputProof)).wait();
    expect(await poolBalance(s.alice)).to.eq(700n);
    expect(await tokenBalance(s.alice)).to.eq(300n);
  });

  it("clamps an over-withdraw to the available balance", async function () {
    await deposit(s.alice, 1_000);
    const w = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(999_999).encrypt();
    await (await pool.connect(s.alice).withdraw(w.handles[0], w.inputProof)).wait();
    expect(await poolBalance(s.alice)).to.eq(0n);
    expect(await tokenBalance(s.alice)).to.eq(1_000n);
  });

  it("end-to-end: deposit → yield → draw → winner withdraws principal + jackpot", async function () {
    await deposit(s.alice, 2_000);
    await runDrawRound(ethers.id("e2e"), 1_000);
    await (await pool.connect(s.alice).claim()).wait();
    expect(await poolBalance(s.alice)).to.eq(3_000n);
    const w = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(3_000).encrypt();
    await (await pool.connect(s.alice).withdraw(w.handles[0], w.inputProof)).wait();
    expect(await tokenBalance(s.alice)).to.eq(3_000n);
  });
});
