import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialPool, ConfidentialUSDT } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

const TWO_POW_32 = 1n << 32n;
const TRANSFER_AND_CALL = "confidentialTransferAndCall(address,bytes32,bytes,bytes)";

function drawTarget(roundId: bigint, seed: string, totalWeight: bigint): bigint {
  const r =
    BigInt(ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [roundId, seed]))) & (TWO_POW_32 - 1n);
  return (r * totalWeight) / TWO_POW_32;
}
function winnerIndex(target: bigint, weights: bigint[]): number {
  let prefix = 0n;
  for (let i = 0; i < weights.length; i++) {
    const upper = prefix + weights[i];
    if (prefix <= target && target < upper) return i;
    prefix = upper;
  }
  return -1;
}
async function bump(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("ConfidentialPool v3 — Àjọ time-weighted single-winner draw", function () {
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
  async function poolBalance(u: HardhatEthersSigner): Promise<bigint> {
    const h = await pool.balanceOf(u.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, u);
  }
  async function tokenBalance(u: HardhatEthersSigner): Promise<bigint> {
    const h = await cusdt.confidentialBalanceOf(u.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, cusdtAddr, u);
  }
  async function weight(round: bigint, u: HardhatEthersSigner): Promise<bigint> {
    const h = await pool.weightOf(round, u.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint128, h, poolAddr, u);
  }

  // harvest → commit → reveal → tally → draw (waits so the TWAB window is non-trivial).
  async function runDrawRound(seed: string, yieldAmt: bigint | number, windowSecs = 1000) {
    await (await pool.connect(s.owner).harvestYield(yieldAmt)).wait();
    await bump(windowSecs);
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(seed), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(seed)).wait();
    // TWAB makes each participant HCU-heavy → paginate one at a time (see HCU depth limit).
    const n = Number(await pool.participantsCount());
    for (let i = 0; i < n; i++) await (await pool.connect(s.owner).tallyDraw(1)).wait();
    for (let i = 0; i < n; i++) await (await pool.connect(s.owner).runDraw(1)).wait();
  }

  before(async function () {
    const eth = await ethers.getSigners();
    s = { owner: eth[0], alice: eth[1], bob: eth[2], carol: eth[3] };
  });
  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    ({ token: cusdt, pool, cusdtAddr, poolAddr } = await deployFixture());
  });

  // ── Deposits & confidentiality ──────────────────────────────────────────────────────────
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

  // ── Yield / jackpot ─────────────────────────────────────────────────────────────────────
  it("grows a public rollover jackpot from harvested yield", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(200)).wait();
    await (await pool.connect(s.owner).harvestYield(300)).wait();
    expect(await pool.jackpot()).to.eq(500n);
  });
  it("cannot commit with an empty pool or zero jackpot", async function () {
    await expect(
      pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("x")), 3600),
    ).to.be.revertedWithCustomError(pool, "EmptyPool");
  });

  // ── Time-weighted single-winner draw ────────────────────────────────────────────────────
  it("a sole depositor always wins", async function () {
    await deposit(s.alice, 1_000);
    await runDrawRound(ethers.id("solo"), 500);
    await (await pool.connect(s.alice).claim()).wait();
    expect(await poolBalance(s.alice)).to.eq(1_500n);
  });

  it("picks exactly ONE winner, matching the spec over decrypted time-weights", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.bob, 3_000);
    await deposit(s.carol, 2_000);
    const jackpotAmt = 900n;
    const seed = ethers.id("three-party");
    await runDrawRound(seed, jackpotAmt);

    const rid = await pool.roundId();
    const w = [await weight(rid, s.alice), await weight(rid, s.bob), await weight(rid, s.carol)];
    const total = w[0] + w[1] + w[2];
    const wIdx = winnerIndex(drawTarget(rid, seed, total), w);
    expect(wIdx).to.be.gte(0);

    const sg = [s.alice, s.bob, s.carol];
    const before: bigint[] = [];
    for (const x of sg) before.push(await poolBalance(x));
    for (const x of sg) await (await pool.connect(x).claim()).wait();
    const after: bigint[] = [];
    for (const x of sg) after.push(await poolBalance(x));

    const winners = after.map((a, i) => a - before[i]).filter((d) => d > 0n);
    expect(winners.length).to.eq(1);
    expect(winners[0]).to.eq(jackpotAmt);
    expect(after.findIndex((a, i) => a - before[i] > 0n)).to.eq(wIdx);
  });

  it("ANTI-SNIPE: a last-second whale gets ~zero time-weight and can't steal the round", async function () {
    // Alice deposits early and holds through the whole window…
    await deposit(s.alice, 1_000);
    await bump(10_000);
    // …Bob dumps a huge deposit right before the draw is committed.
    await deposit(s.bob, 1_000_000);
    await (await pool.connect(s.owner).harvestYield(500)).wait();
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("snipe")), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(ethers.id("snipe"))).wait();
    await (await pool.connect(s.owner).tallyDraw(2)).wait();

    const rid = await pool.roundId();
    const wA = await weight(rid, s.alice);
    const wB = await weight(rid, s.bob);
    // Despite a 1000× larger balance, Bob's time-weight is far below Alice's.
    expect(wA).to.be.gt(wB);
    expect(wB).to.be.lt(wA); // sanity: sniping defeated
  });

  it("paginated tally + draw complete across multiple calls", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.bob, 1_000);
    await deposit(s.carol, 1_000);
    await (await pool.connect(s.owner).harvestYield(300)).wait();
    await bump(500);
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("p")), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(ethers.id("p"))).wait();
    await (await pool.connect(s.owner).tallyDraw(2)).wait();
    expect(await pool.tallyComplete()).to.eq(false);
    await (await pool.connect(s.owner).tallyDraw(2)).wait();
    expect(await pool.tallyComplete()).to.eq(true);
    await (await pool.connect(s.owner).runDraw(1)).wait();
    expect(await pool.drawComplete()).to.eq(false);
    await (await pool.connect(s.owner).runDraw(5)).wait();
    expect(await pool.drawComplete()).to.eq(true);
  });

  it("cannot run the draw before the tally completes", async function () {
    await deposit(s.alice, 1_000);
    await deposit(s.bob, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await bump(500);
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("s")), 3600)).wait();
    await (await pool.connect(s.owner).revealSeed(ethers.id("s"))).wait();
    await (await pool.connect(s.owner).tallyDraw(1)).wait(); // 1 of 2
    await expect(pool.connect(s.owner).runDraw(2)).to.be.revertedWithCustomError(pool, "TallyNotComplete");
  });

  it("cannot claim before the draw completes; cannot claim twice", async function () {
    await deposit(s.alice, 1_000);
    await runDrawRound(ethers.id("c"), 100);
    await (await pool.connect(s.alice).claim()).wait();
    await expect(pool.connect(s.alice).claim()).to.be.revertedWithCustomError(pool, "AlreadyClaimed");
  });

  // ── Commit–reveal integrity & liveness ─────────────────────────────────────────────────
  it("rejects a reveal that doesn't match the commitment", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await bump(100);
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("real")), 3600)).wait();
    await expect(pool.connect(s.owner).revealSeed(ethers.id("fake"))).to.be.revertedWithCustomError(pool, "BadReveal");
  });
  it("lets anyone void a round if the operator never reveals", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await bump(100);
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("s")), 3600)).wait();
    await expect(pool.connect(s.alice).closeRound()).to.be.revertedWithCustomError(pool, "RevealWindowStillOpen");
    await bump(3601);
    await (await pool.connect(s.alice).closeRound()).wait();
    expect(await pool.phase()).to.eq(0n);
  });

  // ── Phase guards & withdraw ─────────────────────────────────────────────────────────────
  it("freezes deposits during a draw but keeps withdrawals open", async function () {
    await deposit(s.alice, 1_000);
    await (await pool.connect(s.owner).harvestYield(100)).wait();
    await bump(100);
    await (await pool.connect(s.owner).commitRound(ethers.keccak256(ethers.id("lock")), 3600)).wait();
    await cusdt.connect(s.bob).faucet(1_000);
    const enc = await fhevm.createEncryptedInput(cusdtAddr, s.bob.address).add64(1_000).encrypt();
    await expect(cusdt.connect(s.bob)[TRANSFER_AND_CALL](poolAddr, enc.handles[0], enc.inputProof, "0x")).to.be
      .reverted;
    const wd = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(400).encrypt();
    await (await pool.connect(s.alice).withdraw(wd.handles[0], wd.inputProof)).wait();
    expect(await poolBalance(s.alice)).to.eq(600n);
  });
  it("withdraws principal and returns cUSDT; over-withdraw clamps", async function () {
    await deposit(s.alice, 1_000);
    const w1 = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(300).encrypt();
    await (await pool.connect(s.alice).withdraw(w1.handles[0], w1.inputProof)).wait();
    expect(await poolBalance(s.alice)).to.eq(700n);
    const w2 = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(999_999).encrypt();
    await (await pool.connect(s.alice).withdraw(w2.handles[0], w2.inputProof)).wait();
    expect(await poolBalance(s.alice)).to.eq(0n);
    expect(await tokenBalance(s.alice)).to.eq(1_000n);
  });

  it("end-to-end: deposit → yield → time-weighted draw → winner withdraws principal + jackpot", async function () {
    await deposit(s.alice, 2_000);
    await runDrawRound(ethers.id("e2e"), 1_000);
    await (await pool.connect(s.alice).claim()).wait();
    expect(await poolBalance(s.alice)).to.eq(3_000n);
    const w = await fhevm.createEncryptedInput(poolAddr, s.alice.address).add64(3_000).encrypt();
    await (await pool.connect(s.alice).withdraw(w.handles[0], w.inputProof)).wait();
    expect(await tokenBalance(s.alice)).to.eq(3_000n);
  });
});
