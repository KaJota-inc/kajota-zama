import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";

// Payflow Mandate Beacon — CBN consumer-dispute mandate.
// A regulator-verifiable mandate registry. One Merkle-anchored proof per debit attempt, a
// server-assigned occurrence number, and a human-approval route for replays within the TTL — the
// second-tap problem CBN's NIP mandate specification does not address.
describe("Mandate Beacon — CBN consumer-dispute mandate", function () {
  let owner: HardhatEthersSigner;
  let bank: HardhatEthersSigner;
  let otherBank: HardhatEthersSigner;
  let guardian: HardhatEthersSigner;
  let anyone: HardhatEthersSigner;

  // Reusable factory + ids. The idempotency key would be
  //   sha256(canonicalMandate ‖ amount ‖ creTickBucket) in production;
  //   here we hash deterministic fixtures so the tests stay self-contained.
  const CBN_SLA = 86_400n; // CBN CPR 2019 — 24 hours in seconds
  const idOf = (s: string) => ethers.id(s);

  async function deploy() {
    const F = await ethers.getContractFactory("MandateAnchor");
    const c = await F.connect(owner).deploy(CBN_SLA);
    await c.waitForDeployment();
    return c;
  }

  before(async function () {
    [owner, bank, otherBank, guardian, anyone] = await ethers.getSigners();
  });

  it("posts a fresh mandate at occurrence 1 and records the SLA deadline", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

    const mandateId = idOf("mandate/1");
    const idemKey = idOf("idem/1");
    const envelope = idOf("envelope/redacted/1");

    const tx = await beacon.connect(bank).postMandate(mandateId, idemKey, 50_000n, envelope);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const expectedDeadline = BigInt(block!.timestamp) + CBN_SLA;

    const m = await beacon.mandateOf(mandateId);
    expect(m.bank).to.equal(bank.address);
    expect(m.amount).to.equal(50_000n);
    expect(m.deadline).to.equal(expectedDeadline);
    expect(m.occurrence).to.equal(1);
    expect(m.status).to.equal(1); // Status.Posted
  });

  it("rejects a post from an un-allowlisted bank", async function () {
    const beacon = await deploy();
    await expect(
      beacon
        .connect(otherBank)
        .postMandate(idOf("m/2"), idOf("k/2"), 1n, idOf("e/2")),
    ).to.be.revertedWithCustomError(beacon, "BankNotAllowed");
  });

  it("rejects a zero idempotency key — the server must assign one", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    await expect(
      beacon
        .connect(bank)
        .postMandate(idOf("m/3"), ethers.ZeroHash, 1n, idOf("e/3")),
    ).to.be.revertedWithCustomError(beacon, "ZeroIdempotencyKey");
  });

  it("routes a replay within TTL to DuplicateRouted — never auto-settles", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

    const idemKey = idOf("idem/replay");
    const m1 = idOf("mandate/replay/1");
    const m2 = idOf("mandate/replay/2");
    const envelope = idOf("envelope/replay");

    await (await beacon.connect(bank).postMandate(m1, idemKey, 10_000n, envelope)).wait();
    await expect(
      beacon.connect(bank).postMandate(m2, idemKey, 10_000n, envelope),
    )
      .to.emit(beacon, "DuplicateRouted")
      .withArgs(m2, idemKey, 2, "replay-within-ttl");

    expect(await beacon.occurrenceOf(idemKey)).to.equal(2);
    const posted = await beacon.mandateOf(m1);
    const duplicate = await beacon.mandateOf(m2);
    expect(posted.status).to.equal(1); // Posted
    expect(duplicate.status).to.equal(4); // DuplicateRouted
    expect(duplicate.occurrence).to.equal(2);
  });

  it("settles a mandate against a reversal reference", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    const mandateId = idOf("mandate/settle");
    await (
      await beacon
        .connect(bank)
        .postMandate(mandateId, idOf("idem/settle"), 20_000n, idOf("env/settle"))
    ).wait();

    const reversal = idOf("reversal/ref/1");
    await expect(beacon.connect(bank).reportSettled(mandateId, reversal))
      .to.emit(beacon, "MandateSettled")
      .withArgs(mandateId, reversal, (v: bigint) => v > 0n);

    const m = await beacon.mandateOf(mandateId);
    expect(m.status).to.equal(2); // Status.Settled
    expect(await beacon.settlementOf(mandateId)).to.equal(reversal);
  });

  it("fires SLABreached only after the deadline has passed", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    const mandateId = idOf("mandate/breach");
    await (
      await beacon
        .connect(bank)
        .postMandate(mandateId, idOf("idem/breach"), 30_000n, idOf("env/breach"))
    ).wait();

    // too early — the deadline has not yet elapsed
    await expect(
      beacon.connect(anyone).emitSLABreach(mandateId),
    ).to.be.revertedWithCustomError(beacon, "NotYetBreached");

    // advance past the 24-hour window
    await ethers.provider.send("evm_increaseTime", [Number(CBN_SLA) + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(beacon.connect(anyone).emitSLABreach(mandateId)).to.emit(
      beacon,
      "SLABreached",
    );
    expect(await beacon.isBreached(mandateId)).to.equal(true);
  });

  it("refuses to breach a mandate already settled, and vice versa", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    const settled = idOf("m/dualA");
    const breached = idOf("m/dualB");
    await (
      await beacon.connect(bank).postMandate(settled, idOf("k/A"), 1n, idOf("e/A"))
    ).wait();
    await (
      await beacon.connect(bank).postMandate(breached, idOf("k/B"), 1n, idOf("e/B"))
    ).wait();

    await (
      await beacon.connect(bank).reportSettled(settled, idOf("rev/A"))
    ).wait();
    await ethers.provider.send("evm_increaseTime", [Number(CBN_SLA) + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      beacon.connect(anyone).emitSLABreach(settled),
    ).to.be.revertedWithCustomError(beacon, "AlreadySettled");

    await (await beacon.connect(anyone).emitSLABreach(breached)).wait();
    await expect(
      beacon.connect(bank).reportSettled(breached, idOf("rev/B")),
    ).to.be.revertedWithCustomError(beacon, "AlreadyBreached");
  });

  it("kill switch: a paused bank cannot post, but a guardian can only pause (not resume)", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    await (await beacon.connect(bank).setGuardian(bank.address, guardian.address)).wait();

    // guardian trips the switch on a detected anomaly
    await (
      await beacon.connect(guardian).setPaused(bank.address, true, "velocity anomaly")
    ).wait();

    await expect(
      beacon
        .connect(bank)
        .postMandate(idOf("m/pause"), idOf("k/pause"), 1n, idOf("e/pause")),
    ).to.be.revertedWithCustomError(beacon, "IsPaused");

    // guardian cannot resume
    await expect(
      beacon.connect(guardian).setPaused(bank.address, false, "clear"),
    ).to.be.revertedWithCustomError(beacon, "NotGuardian");

    // bank itself (the human) may resume
    await (await beacon.connect(bank).setPaused(bank.address, false, "reviewed")).wait();
    await (
      await beacon
        .connect(bank)
        .postMandate(idOf("m/resume"), idOf("k/resume"), 1n, idOf("e/resume"))
    ).wait();
  });
});
