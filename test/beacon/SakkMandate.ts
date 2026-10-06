import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { SakkMandate } from "../../types";

// Payflow Mandate Beacon — Sakk mandate.
// Sealed Islamic banking instruction, modernised: payer commits, witness quorum attests,
// beneficiary opens. Replay/forgery fail by the pre-image hash rule; the primitive is
// regulator-verifiable and does NOT use FHE.
describe("Mandate Beacon — Sakk (sealed Islamic banking mandate)", function () {
  let owner: HardhatEthersSigner;
  let payer: HardhatEthersSigner;
  let otherPayer: HardhatEthersSigner;
  let beneficiary: HardhatEthersSigner;
  let w1: HardhatEthersSigner;
  let w2: HardhatEthersSigner;
  let w3: HardhatEthersSigner;
  let imposter: HardhatEthersSigner;
  let guardian: HardhatEthersSigner;

  const idOf = (s: string) => ethers.id(s);
  const EXPIRY_FAR = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);

  function makeCommit(mandateBody: string, nonce: bigint): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes", "uint256"], [mandateBody, nonce]),
    );
  }

  async function deploy() {
    const F = await ethers.getContractFactory("SakkMandate");
    const c = (await F.connect(owner).deploy()) as unknown as SakkMandate;
    await c.waitForDeployment();
    return c;
  }

  before(async function () {
    [owner, payer, otherPayer, beneficiary, w1, w2, w3, imposter, guardian] = await ethers.getSigners();
  });

  it("seals, attests through quorum, and opens on a valid pre-image", async function () {
    const sakk = await deploy();
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();

    const sakkId = idOf("sakk/alpha");
    const body = ethers.hexlify(ethers.toUtf8Bytes("pay 1000 dinars to the merchant at Basra"));
    const nonce = 0xdeadbeefn;
    const commit = makeCommit(body, nonce);
    const far = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 7n * 24n * 3600n;

    await (
      await sakk
        .connect(payer)
        .seal(sakkId, commit, beneficiary.address, [w1.address, w2.address, w3.address], 2, far)
    ).wait();

    // one witness short of quorum — open reverts
    await (await sakk.connect(w1).attest(sakkId)).wait();
    await expect(sakk.connect(beneficiary).open(sakkId, body, nonce)).to.be.revertedWithCustomError(
      sakk,
      "QuorumNotMet",
    );

    // second attestation meets 2-of-3 quorum
    await (await sakk.connect(w2).attest(sakkId)).wait();

    const bodyHash = ethers.keccak256(body);
    await expect(sakk.connect(beneficiary).open(sakkId, body, nonce))
      .to.emit(sakk, "SakkOpened")
      .withArgs(sakkId, beneficiary.address, bodyHash);

    const s = await sakk.sakkOf(sakkId);
    expect(s.status).to.equal(2); // Status.Opened
    expect(s.attestations).to.equal(2);
  });

  it("rejects attestation by a non-designated witness, and rejects double-attestation", async function () {
    const sakk = await deploy();
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();

    const sakkId = idOf("sakk/beta");
    const body = ethers.hexlify(ethers.toUtf8Bytes("beta body"));
    const nonce = 1n;
    const commit = makeCommit(body, nonce);
    const far = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

    await (
      await sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address, w2.address], 1, far)
    ).wait();

    // imposter is not in the witness set
    await expect(sakk.connect(imposter).attest(sakkId)).to.be.revertedWithCustomError(
      sakk,
      "NotWitness",
    );

    // w1 attests once; a replay by w1 reverts
    await (await sakk.connect(w1).attest(sakkId)).wait();
    await expect(sakk.connect(w1).attest(sakkId)).to.be.revertedWithCustomError(sakk, "AlreadyAttested");
  });

  it("rejects a forged pre-image — commit mismatch", async function () {
    const sakk = await deploy();
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();

    const sakkId = idOf("sakk/gamma");
    const body = ethers.hexlify(ethers.toUtf8Bytes("the real body"));
    const nonce = 42n;
    const commit = makeCommit(body, nonce);
    const far = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

    await (
      await sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, far)
    ).wait();
    await (await sakk.connect(w1).attest(sakkId)).wait();

    // wrong body
    const forgedBody = ethers.hexlify(ethers.toUtf8Bytes("the forged body"));
    await expect(
      sakk.connect(beneficiary).open(sakkId, forgedBody, nonce),
    ).to.be.revertedWithCustomError(sakk, "CommitMismatch");

    // wrong nonce
    await expect(
      sakk.connect(beneficiary).open(sakkId, body, 43n),
    ).to.be.revertedWithCustomError(sakk, "CommitMismatch");

    // correct open still works
    await (await sakk.connect(beneficiary).open(sakkId, body, nonce)).wait();
  });

  it("rejects a replay open — the sakk is Opened and cannot be reopened", async function () {
    const sakk = await deploy();
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();

    const sakkId = idOf("sakk/delta");
    const body = ethers.hexlify(ethers.toUtf8Bytes("delta body"));
    const nonce = 7n;
    const commit = makeCommit(body, nonce);
    const far = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

    await (
      await sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, far)
    ).wait();
    await (await sakk.connect(w1).attest(sakkId)).wait();
    await (await sakk.connect(beneficiary).open(sakkId, body, nonce)).wait();

    await expect(
      sakk.connect(beneficiary).open(sakkId, body, nonce),
    ).to.be.revertedWithCustomError(sakk, "AlreadyOpened");
  });

  it("rejects open after expiry and allows markExpired", async function () {
    const sakk = await deploy();
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();

    const sakkId = idOf("sakk/epsilon");
    const body = ethers.hexlify(ethers.toUtf8Bytes("epsilon body"));
    const nonce = 99n;
    const commit = makeCommit(body, nonce);
    const near = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 60n;

    await (
      await sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, near)
    ).wait();
    await (await sakk.connect(w1).attest(sakkId)).wait();

    // markExpired before deadline reverts
    await expect(sakk.connect(w1).markExpired(sakkId)).to.be.revertedWithCustomError(
      sakk,
      "ExpiryNotReached",
    );

    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    await expect(sakk.connect(beneficiary).open(sakkId, body, nonce)).to.be.revertedWithCustomError(
      sakk,
      "ExpiryPassed",
    );
    await (await sakk.connect(w1).markExpired(sakkId)).wait();
    expect((await sakk.sakkOf(sakkId)).status).to.equal(3); // Status.Expired
  });

  it("rejects seal from un-allowlisted payer, and respects the kill switch (guardian pauses, payer resumes)", async function () {
    const sakk = await deploy();

    const sakkId = idOf("sakk/zeta");
    const body = ethers.hexlify(ethers.toUtf8Bytes("zeta body"));
    const nonce = 11n;
    const commit = makeCommit(body, nonce);
    const far = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

    // un-allowlisted payer is rejected
    await expect(
      sakk.connect(otherPayer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, far),
    ).to.be.revertedWithCustomError(sakk, "PayerNotAllowed");

    // allow + appoint guardian, guardian pauses
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();
    await (await sakk.connect(payer).setGuardian(payer.address, guardian.address)).wait();
    await (await sakk.connect(guardian).setPaused(payer.address, true, "velocity anomaly")).wait();

    await expect(
      sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, far),
    ).to.be.revertedWithCustomError(sakk, "IsPaused");

    // guardian cannot resume
    await expect(
      sakk.connect(guardian).setPaused(payer.address, false, "clear"),
    ).to.be.revertedWithCustomError(sakk, "NotGuardian");

    // payer resumes, then seals cleanly
    await (await sakk.connect(payer).setPaused(payer.address, false, "reviewed")).wait();
    await (
      await sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, far)
    ).wait();
  });

  it("rejects a non-beneficiary opener even with quorum met and correct pre-image", async function () {
    const sakk = await deploy();
    await (await sakk.connect(owner).allowPayer(payer.address, true)).wait();

    const sakkId = idOf("sakk/eta");
    const body = ethers.hexlify(ethers.toUtf8Bytes("eta body"));
    const nonce = 1234n;
    const commit = makeCommit(body, nonce);
    const far = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

    await (
      await sakk.connect(payer).seal(sakkId, commit, beneficiary.address, [w1.address], 1, far)
    ).wait();
    await (await sakk.connect(w1).attest(sakkId)).wait();

    await expect(
      sakk.connect(imposter).open(sakkId, body, nonce),
    ).to.be.revertedWithCustomError(sakk, "NotBeneficiary");
    await (await sakk.connect(beneficiary).open(sakkId, body, nonce)).wait();
  });
});
