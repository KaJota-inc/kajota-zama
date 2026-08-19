import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { AgentMandate, FraudOracle } from "../../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// Kajota Shield — a confidential trust layer for agent payments.
// One checkAndSpend enforces the private mandate (A) AND screens the shared fraud oracle (B),
// entirely over ciphertext: over-budget OR network-flagged → authorises exactly 0, no revert, no leak.
describe("Kajota Shield — AgentMandate × FraudOracle", function () {
  let bank: HardhatEthersSigner; // oracle owner + a reporting member
  let principal: HardhatEthersSigner; // the human who owns the agent
  let agent: HardhatEthersSigner; // the autonomous agent
  let oracle: FraudOracle;
  let mandate: AgentMandate;
  let oracleAddr: string;
  let mandateAddr: string;

  const CLEAN = ethers.id("merchant:coffee-api");
  const RISKY = ethers.id("merchant:shell-co");
  const THRESHOLD = 50n;

  async function deploy() {
    const O = await ethers.getContractFactory("FraudOracle");
    const o = (await O.deploy()) as FraudOracle;
    const M = await ethers.getContractFactory("AgentMandate");
    const m = (await M.deploy(await o.getAddress(), THRESHOLD)) as AgentMandate;
    return { o, m, oracleAddr: await o.getAddress(), mandateAddr: await m.getAddress() };
  }

  async function spend(merchant: string, amount: bigint | number) {
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(amount).encrypt();
    await (await mandate.connect(agent).checkAndSpend(merchant, enc.handles[0], enc.inputProof)).wait();
  }
  async function lastApplied(): Promise<bigint> {
    const h = await mandate.lastAppliedOf(agent.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, mandateAddr, agent);
  }
  async function spent(): Promise<bigint> {
    const h = await mandate.spentOf(agent.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, mandateAddr, principal);
  }

  before(async function () {
    const s = await ethers.getSigners();
    bank = s[0];
    principal = s[1];
    agent = s[2];
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    ({ o: oracle, m: mandate, oracleAddr, mandateAddr } = await deploy());
    // the reporting bank and the mandate contract are vetted members of the oracle
    await (await oracle.connect(bank).setMember(bank.address, true)).wait();
    await (await oracle.connect(bank).setMember(mandateAddr, true)).wait();

    // principal registers the agent with an encrypted 1,000 cap, allow-listed merchants
    const cap = await fhevm.createEncryptedInput(mandateAddr, principal.address).add64(1000).encrypt();
    await (
      await mandate
        .connect(principal)
        .registerAgent(agent.address, cap.handles[0], cap.inputProof, 2_000_000_000, 3600, 20)
    ).wait();
    await (await mandate.connect(principal).setMerchant(agent.address, CLEAN, true)).wait();
    await (await mandate.connect(principal).setMerchant(agent.address, RISKY, true)).wait();

    // a member bank flags the shell-company merchant with an encrypted risk score of 80
    const score = await fhevm.createEncryptedInput(oracleAddr, bank.address).add64(80).encrypt();
    await (await oracle.connect(bank).report(RISKY, score.handles[0], score.inputProof)).wait();
  });

  it("authorises a spend that is within budget and to a clean merchant", async function () {
    await spend(CLEAN, 300);
    expect(await lastApplied()).to.eq(300n);
    expect(await spent()).to.eq(300n);
  });

  it("clamps an over-budget spend to zero without reverting or leaking", async function () {
    await spend(CLEAN, 300); // spent = 300
    await spend(CLEAN, 800); // 300 + 800 > 1000 cap → authorises 0
    expect(await lastApplied()).to.eq(0n);
    expect(await spent()).to.eq(300n); // unchanged
    await spend(CLEAN, 500); // 300 + 500 ≤ 1000 → ok
    expect(await lastApplied()).to.eq(500n);
    expect(await spent()).to.eq(800n);
  });

  it("blocks a payment to a network-flagged merchant — even when it's within budget", async function () {
    await spend(RISKY, 100); // in budget, but oracle risk (80) ≥ threshold (50) → authorises 0
    expect(await lastApplied()).to.eq(0n);
    expect(await spent()).to.eq(0n);
  });

  it("keeps the fraud signal private — only a yes/no vs threshold is ever exposed", async function () {
    // the aggregate is not readable by the agent or principal; report count is public, score is not
    expect(await oracle.reportCount(RISKY)).to.eq(1n);
    const h = await oracle.riskOf(RISKY);
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, h, oracleAddr, agent)).to.be.rejected;
  });

  it("kill switch: a paused agent cannot spend", async function () {
    await (await mandate.connect(principal).setPaused(agent.address, true)).wait();
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(100).encrypt();
    await expect(
      mandate.connect(agent).checkAndSpend(CLEAN, enc.handles[0], enc.inputProof),
    ).to.be.revertedWithCustomError(mandate, "IsPaused");
  });

  it("rejects a merchant that isn't on the allow-list", async function () {
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(100).encrypt();
    await expect(
      mandate.connect(agent).checkAndSpend(ethers.id("merchant:unknown"), enc.handles[0], enc.inputProof),
    ).to.be.revertedWithCustomError(mandate, "MerchantNotAllowed");
  });

  it("only vetted members can contribute or query the oracle", async function () {
    const score = await fhevm.createEncryptedInput(oracleAddr, agent.address).add64(10).encrypt();
    await expect(
      oracle.connect(agent).report(CLEAN, score.handles[0], score.inputProof),
    ).to.be.revertedWithCustomError(oracle, "NotMember");
  });
});
