import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { AgentMandate, FraudOracle, ConfidentialPool, ConfidentialUSDT } from "../../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// The bridge: an autonomous agent SAVES into the confidential PoolTogether (Àjọ) for its principal,
// under a Shield mandate — clamped to the encrypted cap, the pool screened by the shared fraud
// oracle. The saver's position belongs to the principal. This is the merged, agent-native pool.
const MAX_DEADLINE = 281474976710655n;
const idOf = (a: string) => ethers.solidityPackedKeccak256(["address"], [a]);

describe("Àjọ × Shield — agent-native confidential PoolTogether", function () {
  let bank: HardhatEthersSigner, principal: HardhatEthersSigner, agent: HardhatEthersSigner;
  let cusdt: ConfidentialUSDT,
    oracle: FraudOracle,
    pool: ConfidentialPool,
    pool2: ConfidentialPool,
    mandate: AgentMandate;
  let _cusdtAddr: string, oracleAddr: string, poolAddr: string, pool2Addr: string, mandateAddr: string;

  async function setup() {
    cusdt = (await (await ethers.getContractFactory("ConfidentialUSDT")).deploy()) as ConfidentialUSDT;
    oracle = (await (await ethers.getContractFactory("FraudOracle")).deploy()) as FraudOracle;
    pool = (await (
      await ethers.getContractFactory("ConfidentialPool")
    ).deploy(await cusdt.getAddress())) as ConfidentialPool;
    pool2 = (await (
      await ethers.getContractFactory("ConfidentialPool")
    ).deploy(await cusdt.getAddress())) as ConfidentialPool;
    mandate = (await (
      await ethers.getContractFactory("AgentMandate")
    ).deploy(await oracle.getAddress(), await cusdt.getAddress(), 50)) as AgentMandate;
    _cusdtAddr = await cusdt.getAddress();
    oracleAddr = await oracle.getAddress();
    poolAddr = await pool.getAddress();
    pool2Addr = await pool2.getAddress();
    mandateAddr = await mandate.getAddress();

    await (await oracle.connect(bank).setMember(bank.address, true)).wait();
    await (await oracle.connect(bank).setMember(mandateAddr, true)).wait();
    await (await pool.connect(bank).setDepositor(mandateAddr, true)).wait();
    await (await pool2.connect(bank).setDepositor(mandateAddr, true)).wait();

    await (await cusdt.connect(principal).faucet(100_000)).wait();
    await (await cusdt.connect(principal).setOperator(mandateAddr, MAX_DEADLINE)).wait();

    const cap = await fhevm.createEncryptedInput(mandateAddr, principal.address).add64(1000).encrypt();
    await (
      await mandate
        .connect(principal)
        .registerAgent(agent.address, cap.handles[0], cap.inputProof, 2_000_000_000, 3600, 50)
    ).wait();
    await (await mandate.connect(principal).setMerchant(agent.address, poolAddr, true)).wait();
    await (await mandate.connect(principal).setMerchant(agent.address, pool2Addr, true)).wait();

    // the fraud circle flags pool2 (a malicious pool) with an encrypted risk of 90
    const score = await fhevm.createEncryptedInput(oracleAddr, bank.address).add64(90).encrypt();
    await (await oracle.connect(bank).report(idOf(pool2Addr), score.handles[0], score.inputProof)).wait();
  }

  async function agentDeposit(target: string, amount: number) {
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(amount).encrypt();
    await (await mandate.connect(agent).depositToPool(target, enc.handles[0], enc.inputProof)).wait();
  }
  async function poolBalance(p: ConfidentialPool, who: HardhatEthersSigner, addr: string): Promise<bigint> {
    const h = await p.balanceOf(who.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, addr, who);
  }

  before(async function () {
    const s = await ethers.getSigners();
    [bank, principal, agent] = [s[0], s[1], s[2]];
  });
  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    await setup();
  });

  it("an agent saves into the pool for its principal — the position is the principal's", async function () {
    await agentDeposit(poolAddr, 500);
    expect(await poolBalance(pool, principal, poolAddr)).to.eq(500n); // principal, not the agent/mandate
    expect(await pool.participantsCount()).to.eq(1n);
  });

  it("clamps an over-mandate deposit to zero", async function () {
    await agentDeposit(poolAddr, 700); // spent 700
    await agentDeposit(poolAddr, 500); // 700 + 500 > 1000 cap → deposits 0
    expect(await poolBalance(pool, principal, poolAddr)).to.eq(700n);
  });

  it("the fraud circle screens the POOL — an agent can't be tricked into a flagged pool", async function () {
    await agentDeposit(pool2Addr, 300); // pool2 flagged (90 ≥ 50) → deposits 0
    expect(await poolBalance(pool2, principal, pool2Addr)).to.eq(0n);
  });

  it("end-to-end: agent-saved funds win the confidential draw for the principal", async function () {
    await agentDeposit(poolAddr, 800); // within the 1000 mandate cap
    // the pool runs its normal confidential PoolTogether draw
    await (await pool.connect(bank).harvestYield(1000)).wait();
    await ethers.provider.send("evm_increaseTime", [1000]);
    await ethers.provider.send("evm_mine", []);
    await (await pool.connect(bank).commitRound(ethers.keccak256(ethers.id("s")), 3600)).wait();
    await (await pool.connect(bank).revealSeed(ethers.id("s"))).wait();
    await (await pool.connect(bank).tallyDraw(1)).wait();
    await (await pool.connect(bank).runDraw(1)).wait();
    await (await pool.connect(principal).claim()).wait();
    // sole participant wins the jackpot on top of the agent-saved principal (800 + 1000)
    expect(await poolBalance(pool, principal, poolAddr)).to.eq(1800n);
  });
});
