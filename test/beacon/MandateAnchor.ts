import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { MandateAnchor } from "../../types";

// Payflow Mandate Beacon — CBN consumer-dispute mandate.
// A regulator-verifiable mandate registry. One Merkle-anchored proof per debit attempt, a
// server-assigned occurrence number, a sanctions-list snapshot pinned at ingest, and a
// human-approval route for replays within the TTL — the second-tap problem CBN's NIP mandate
// specification does not address.
describe("Mandate Beacon — CBN consumer-dispute mandate", function () {
  let owner: HardhatEthersSigner;
  let bank: HardhatEthersSigner;
  let otherBank: HardhatEthersSigner;
  let guardian: HardhatEthersSigner;
  let anyone: HardhatEthersSigner;

  const CBN_SLA = 86_400n; // CBN CPR 2019 — 24 hours in seconds
  const idOf = (s: string) => ethers.id(s);
  const DEFAULT_LIST = idOf("sanctions/cbn-dnd+ofac+un/snapshot/2026-10-06");

  async function deploy() {
    const F = await ethers.getContractFactory("MandateAnchor");
    const c = (await F.connect(owner).deploy(CBN_SLA)) as unknown as MandateAnchor;
    await c.waitForDeployment();
    return c;
  }

  async function post(
    beacon: MandateAnchor,
    as: HardhatEthersSigner,
    mandateId: string,
    idemKey: string,
    amount: bigint,
    envelope: string,
    listVersion: string = DEFAULT_LIST,
  ) {
    return beacon.connect(as).postMandate(mandateId, idemKey, amount, envelope, listVersion);
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

    const tx = await post(beacon, bank, mandateId, idemKey, 50_000n, envelope);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const expectedDeadline = BigInt(block!.timestamp) + CBN_SLA;

    const m = await beacon.mandateOf(mandateId);
    expect(m.bank).to.equal(bank.address);
    expect(m.amount).to.equal(50_000n);
    expect(m.deadline).to.equal(expectedDeadline);
    expect(m.occurrence).to.equal(1);
    expect(m.sanctionsListVersion).to.equal(DEFAULT_LIST);
    expect(m.status).to.equal(1); // Status.Posted
  });

  it("rejects a post from an un-allowlisted bank", async function () {
    const beacon = await deploy();
    await expect(
      post(beacon, otherBank, idOf("m/2"), idOf("k/2"), 1n, idOf("e/2")),
    ).to.be.revertedWithCustomError(beacon, "BankNotAllowed");
  });

  it("rejects a zero idempotency key — the server must assign one", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    await expect(
      post(beacon, bank, idOf("m/3"), ethers.ZeroHash, 1n, idOf("e/3")),
    ).to.be.revertedWithCustomError(beacon, "ZeroIdempotencyKey");
  });

  it("rejects a zero sanctions-list version — regulator replay must pin a snapshot", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    await expect(
      post(beacon, bank, idOf("m/zlv"), idOf("k/zlv"), 1n, idOf("e/zlv"), ethers.ZeroHash),
    ).to.be.revertedWithCustomError(beacon, "ZeroSanctionsListVersion");
  });

  it("routes a replay within TTL to DuplicateRouted — never auto-settles", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

    const idemKey = idOf("idem/replay");
    const m1 = idOf("mandate/replay/1");
    const m2 = idOf("mandate/replay/2");
    const envelope = idOf("envelope/replay");

    await (await post(beacon, bank, m1, idemKey, 10_000n, envelope)).wait();
    await expect(post(beacon, bank, m2, idemKey, 10_000n, envelope))
      .to.emit(beacon, "DuplicateRouted")
      .withArgs(m2, idemKey, 2, "replay-within-ttl");

    expect(await beacon.occurrenceOf(idemKey)).to.equal(2);
    const posted = await beacon.mandateOf(m1);
    const duplicate = await beacon.mandateOf(m2);
    expect(posted.status).to.equal(1); // Posted
    expect(duplicate.status).to.equal(4); // DuplicateRouted
    expect(duplicate.occurrence).to.equal(2);
  });

  it("preserves the first post when the SAME mandateId is replayed — the collision never overwrites", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();

    const mandateId = idOf("mandate/collision");
    const idemKey1 = idOf("idem/collision/1");
    const idemKey2 = idOf("idem/collision/2");
    const envelope = idOf("envelope/collision");

    await (await post(beacon, bank, mandateId, idemKey1, 7_000n, envelope)).wait();

    // same mandateId, different idempotencyKey (a hash collision or an attacker replay).
    // the chain MUST preserve the earliest record and emit a mandate-id-collision event, not
    // silently overwrite the first post with a DuplicateRouted entry.
    await expect(post(beacon, bank, mandateId, idemKey2, 99_000n, idOf("envelope/attacker")))
      .to.emit(beacon, "DuplicateRouted")
      .withArgs(mandateId, idemKey2, 1, "mandate-id-collision");

    const m = await beacon.mandateOf(mandateId);
    expect(m.status).to.equal(1); // still Posted (the first record)
    expect(m.amount).to.equal(7_000n); // original amount, NOT 99_000
    expect(m.idempotencyKey).to.equal(idemKey1); // original idempotencyKey
    expect(m.envelopeHash).to.equal(envelope); // original envelope
  });

  it("settles a mandate against a reversal reference", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    const mandateId = idOf("mandate/settle");
    await (
      await post(beacon, bank, mandateId, idOf("idem/settle"), 20_000n, idOf("env/settle"))
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
      await post(beacon, bank, mandateId, idOf("idem/breach"), 30_000n, idOf("env/breach"))
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
      await post(beacon, bank, settled, idOf("k/A"), 1n, idOf("e/A"))
    ).wait();
    await (
      await post(beacon, bank, breached, idOf("k/B"), 1n, idOf("e/B"))
    ).wait();

    await (await beacon.connect(bank).reportSettled(settled, idOf("rev/A"))).wait();
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
      post(beacon, bank, idOf("m/pause"), idOf("k/pause"), 1n, idOf("e/pause")),
    ).to.be.revertedWithCustomError(beacon, "IsPaused");

    // guardian cannot resume
    await expect(
      beacon.connect(guardian).setPaused(bank.address, false, "clear"),
    ).to.be.revertedWithCustomError(beacon, "NotGuardian");

    // bank itself (the human) may resume
    await (await beacon.connect(bank).setPaused(bank.address, false, "reviewed")).wait();
    await (
      await post(beacon, bank, idOf("m/resume"), idOf("k/resume"), 1n, idOf("e/resume"))
    ).wait();
  });

  it("exposes a canonical mandate commitment — reproducible, status-independent", async function () {
    const beacon = await deploy();
    await (await beacon.connect(owner).allowBank(bank.address, true)).wait();
    const mandateId = idOf("mandate/commit");

    // unknown mandate reverts the view
    await expect(
      beacon.mandateCommitment(mandateId),
    ).to.be.revertedWithCustomError(beacon, "UnknownMandate");

    await (
      await post(beacon, bank, mandateId, idOf("idem/commit"), 42_000n, idOf("env/commit"))
    ).wait();
    const commitAtPost = await beacon.mandateCommitment(mandateId);

    // the commitment is deterministic — recompute it off-chain using the stored fields and
    // the same abi.encode layout, and expect byte-for-byte equality.
    const m = await beacon.mandateOf(mandateId);
    const expected = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "bytes32", "uint64", "uint64", "uint64", "bytes32", "bytes32", "uint8"],
        [
          mandateId,
          m.bank,
          m.idempotencyKey,
          m.amount,
          m.postedAt,
          m.deadline,
          m.envelopeHash,
          m.sanctionsListVersion,
          m.occurrence,
        ],
      ),
    );
    expect(commitAtPost).to.equal(expected);

    // transitioning to Settled MUST NOT change the commitment — the audit lineage is immutable;
    // the status transition is its own event.
    await (await beacon.connect(bank).reportSettled(mandateId, idOf("rev/commit"))).wait();
    const commitAfterSettle = await beacon.mandateCommitment(mandateId);
    expect(commitAfterSettle).to.equal(commitAtPost);
  });
});
