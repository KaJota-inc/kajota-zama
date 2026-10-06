import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { EsusuMandate } from "../../types";

// Payflow Mandate Beacon — Esusu (Yoruba rotating-savings mandate).
// Pre-colonial West African rotating credit association, modernised: organiser seals a
// rotation of N members and a fixed collector order; each cycle, every member attests the
// contribution and the designated collector sweeps the pot once the attestation set is full.
// Replay fails (double contribution per member per cycle); collector-order forgery fails
// (rotation commit is fixed at seal). Regulator-verifiable, no FHE.
describe("Mandate Beacon — Esusu (rotating-savings mandate)", function () {
  let owner: HardhatEthersSigner;
  let organiser: HardhatEthersSigner;
  let m1: HardhatEthersSigner;
  let m2: HardhatEthersSigner;
  let m3: HardhatEthersSigner;
  let imposter: HardhatEthersSigner;
  let guardian: HardhatEthersSigner;

  const idOf = (s: string) => ethers.id(s);
  const CONTRIBUTION = 100n;         // minor units per member per cycle
  const CYCLE_LENGTH = 7n * 24n * 3600n; // one week

  async function deploy() {
    const F = await ethers.getContractFactory("EsusuMandate");
    const c = (await F.connect(owner).deploy()) as unknown as EsusuMandate;
    await c.waitForDeployment();
    return c;
  }

  before(async function () {
    [owner, organiser, m1, m2, m3, imposter, guardian] = await ethers.getSigners();
  });

  it("seals a rotation; the commit matches keccak(abi.encode(members, order, contrib, cycleLen))", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();

    const rotationId = idOf("esusu/alpha");
    const members = [m1.address, m2.address, m3.address];
    const order = [m1.address, m2.address, m3.address]; // seniority = member order

    await expect(
      esusu
        .connect(organiser)
        .seal(rotationId, members, order, CONTRIBUTION, CYCLE_LENGTH),
    ).to.emit(esusu, "RotationSealed");

    const expectedCommit = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "address[]", "uint64", "uint64"],
        [members, order, CONTRIBUTION, CYCLE_LENGTH],
      ),
    );

    const r = await esusu.rotationOf(rotationId);
    expect(r.memberCount).to.equal(3);
    expect(r.contributionAmount).to.equal(CONTRIBUTION);
    expect(r.cycleLengthSeconds).to.equal(CYCLE_LENGTH);
    expect(r.rotationCommit).to.equal(expectedCommit);
    expect(r.nextCycle).to.equal(0);
    expect(r.status).to.equal(1); // RotationStatus.Open

    expect(await esusu.rotationCommit(rotationId)).to.equal(expectedCommit);

    const cycles = await esusu.cyclesOf(rotationId);
    expect(cycles.length).to.equal(3);
    expect(cycles[0].collector).to.equal(m1.address);
    expect(cycles[1].collector).to.equal(m2.address);
    expect(cycles[2].collector).to.equal(m3.address);
  });

  it("rejects seal by an unallowed organiser; rejects a mismatched collector-order length", async function () {
    const esusu = await deploy();
    await expect(
      esusu
        .connect(imposter)
        .seal(
          idOf("esusu/beta"),
          [m1.address, m2.address],
          [m1.address, m2.address],
          CONTRIBUTION,
          CYCLE_LENGTH,
        ),
    ).to.be.revertedWithCustomError(esusu, "OrganiserNotAllowed");

    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();
    await expect(
      esusu
        .connect(organiser)
        .seal(
          idOf("esusu/beta2"),
          [m1.address, m2.address, m3.address],
          [m1.address, m2.address], // length mismatch
          CONTRIBUTION,
          CYCLE_LENGTH,
        ),
    ).to.be.revertedWithCustomError(esusu, "MemberCountMismatch");
  });

  it("rejects a contribution from a non-member and a double-contribution within one cycle", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();

    const rotationId = idOf("esusu/gamma");
    const members = [m1.address, m2.address, m3.address];
    await (
      await esusu
        .connect(organiser)
        .seal(rotationId, members, members, CONTRIBUTION, CYCLE_LENGTH)
    ).wait();

    await expect(
      esusu.connect(imposter).contribute(rotationId, 0),
    ).to.be.revertedWithCustomError(esusu, "NotMember");

    await (await esusu.connect(m1).contribute(rotationId, 0)).wait();
    await expect(
      esusu.connect(m1).contribute(rotationId, 0),
    ).to.be.revertedWithCustomError(esusu, "AlreadyContributed");
  });

  it("rejects a contribution against the wrong cycle index (out-of-order payment)", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();

    const rotationId = idOf("esusu/delta");
    const members = [m1.address, m2.address, m3.address];
    await (
      await esusu
        .connect(organiser)
        .seal(rotationId, members, members, CONTRIBUTION, CYCLE_LENGTH)
    ).wait();

    // next cycle is 0; a contribution for cycle 1 is rejected
    await expect(
      esusu.connect(m1).contribute(rotationId, 1),
    ).to.be.revertedWithCustomError(esusu, "WrongCycleIndex");
  });

  it("only the designated collector may sweep once the attestation set is complete", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();

    const rotationId = idOf("esusu/epsilon");
    const members = [m1.address, m2.address, m3.address];
    // collector order: m2 wins cycle 0 (lot/auction result)
    const order = [m2.address, m3.address, m1.address];
    await (
      await esusu
        .connect(organiser)
        .seal(rotationId, members, order, CONTRIBUTION, CYCLE_LENGTH)
    ).wait();

    await (await esusu.connect(m1).contribute(rotationId, 0)).wait();
    await (await esusu.connect(m2).contribute(rotationId, 0)).wait();

    // one member short of quorum — collect reverts
    await expect(
      esusu.connect(m2).collect(rotationId, 0),
    ).to.be.revertedWithCustomError(esusu, "QuorumNotMet");

    await (await esusu.connect(m3).contribute(rotationId, 0)).wait();

    // m1 is NOT the cycle-0 collector; m2 is
    await expect(
      esusu.connect(m1).collect(rotationId, 0),
    ).to.be.revertedWithCustomError(esusu, "NotCollector");

    const pot = CONTRIBUTION * 3n;
    await expect(esusu.connect(m2).collect(rotationId, 0))
      .to.emit(esusu, "CyclePaidOut")
      .withArgs(rotationId, 0, m2.address, pot);

    const r = await esusu.rotationOf(rotationId);
    expect(r.nextCycle).to.equal(1);
  });

  it("marks a cycle defaulted when the deadline passes without quorum, and bumps nextCycle", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();

    const rotationId = idOf("esusu/zeta");
    const members = [m1.address, m2.address, m3.address];
    const shortCycle = BigInt(60); // 60 seconds
    await (
      await esusu
        .connect(organiser)
        .seal(rotationId, members, members, CONTRIBUTION, shortCycle)
    ).wait();

    // only m1 attests, deadline passes
    await (await esusu.connect(m1).contribute(rotationId, 0)).wait();

    // too early to default
    await expect(
      esusu.connect(organiser).markDefaulted(rotationId, 0),
    ).to.be.revertedWithCustomError(esusu, "CycleDeadlineNotReached");

    await network.provider.send("evm_increaseTime", [120]);
    await network.provider.send("evm_mine", []);

    await expect(esusu.connect(organiser).markDefaulted(rotationId, 0))
      .to.emit(esusu, "CycleDefaulted");

    const r = await esusu.rotationOf(rotationId);
    expect(r.status).to.equal(3); // Defaulted
    expect(r.nextCycle).to.equal(1);
  });

  it("closes the rotation after the last cycle pays out, and refuses further contributions", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();

    const rotationId = idOf("esusu/eta");
    const members = [m1.address, m2.address];
    const order = [m1.address, m2.address];
    await (
      await esusu
        .connect(organiser)
        .seal(rotationId, members, order, CONTRIBUTION, CYCLE_LENGTH)
    ).wait();

    // cycle 0
    await (await esusu.connect(m1).contribute(rotationId, 0)).wait();
    await (await esusu.connect(m2).contribute(rotationId, 0)).wait();
    await (await esusu.connect(m1).collect(rotationId, 0)).wait();

    // cycle 1 — final
    await (await esusu.connect(m1).contribute(rotationId, 1)).wait();
    await (await esusu.connect(m2).contribute(rotationId, 1)).wait();

    await expect(esusu.connect(m2).collect(rotationId, 1))
      .to.emit(esusu, "RotationClosed")
      .withArgs(rotationId);

    const r = await esusu.rotationOf(rotationId);
    expect(r.status).to.equal(2); // Closed

    // a stray contribute after close is refused
    await expect(
      esusu.connect(m1).contribute(rotationId, 2),
    ).to.be.revertedWithCustomError(esusu, "RotationNotOpen");
  });

  it("kill-switch pauses an organiser; a guardian may trip but not resume", async function () {
    const esusu = await deploy();
    await (await esusu.connect(owner).allowOrganiser(organiser.address, true)).wait();
    await (await esusu.connect(organiser).setGuardian(organiser.address, guardian.address)).wait();

    // guardian pauses
    await expect(
      esusu
        .connect(guardian)
        .setPaused(organiser.address, true, "sudden spike in default rate"),
    ).to.emit(esusu, "Paused");

    // organiser cannot seal while paused
    await expect(
      esusu
        .connect(organiser)
        .seal(
          idOf("esusu/paused"),
          [m1.address, m2.address],
          [m1.address, m2.address],
          CONTRIBUTION,
          CYCLE_LENGTH,
        ),
    ).to.be.revertedWithCustomError(esusu, "IsPaused");

    // guardian cannot resume — only the organiser may
    await expect(
      esusu.connect(guardian).setPaused(organiser.address, false, "all clear"),
    ).to.be.revertedWithCustomError(esusu, "NotGuardian");

    // organiser resumes
    await (
      await esusu.connect(organiser).setPaused(organiser.address, false, "reviewed and resumed")
    ).wait();

    await (
      await esusu
        .connect(organiser)
        .seal(
          idOf("esusu/resumed"),
          [m1.address, m2.address],
          [m1.address, m2.address],
          CONTRIBUTION,
          CYCLE_LENGTH,
        )
    ).wait();
  });
});
