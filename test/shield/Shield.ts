import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { AgentMandate, FraudOracle, ConfidentialUSDT } from "../../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

// Kajota Shield — a confidential trust layer for agent payments.
// checkAndSpend enforces the private mandate (A), screens the shared fraud oracle (B), and EXECUTES
// the payment as a confidential ERC-7984 transfer — all over ciphertext. Over-budget or
// network-flagged → moves exactly 0, no revert, no leak.
const MAX_DEADLINE = 281474976710655n; // ERC-7984 operator max (uint48)

describe("Kajota Shield — mandate × oracle × confidential rail", function () {
  let bank: HardhatEthersSigner, principal: HardhatEthersSigner, agent: HardhatEthersSigner;
  let cleanM: HardhatEthersSigner, riskyM: HardhatEthersSigner;
  let cusdt: ConfidentialUSDT, oracle: FraudOracle, mandate: AgentMandate;
  let cusdtAddr: string, oracleAddr: string, mandateAddr: string;

  const THRESHOLD = 50n;
  const idOf = (a: string) => ethers.solidityPackedKeccak256(["address"], [a]);

  async function deploy() {
    const T = await ethers.getContractFactory("ConfidentialUSDT");
    const t = (await T.deploy()) as ConfidentialUSDT;
    const O = await ethers.getContractFactory("FraudOracle");
    const o = (await O.deploy()) as FraudOracle;
    const M = await ethers.getContractFactory("AgentMandate");
    const m = (await M.deploy(await o.getAddress(), await t.getAddress(), THRESHOLD)) as AgentMandate;
    return { t, o, m, cusdtAddr: await t.getAddress(), oracleAddr: await o.getAddress(), mandateAddr: await m.getAddress() };
  }

  async function pay(merchant: HardhatEthersSigner, amount: bigint | number) {
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(amount).encrypt();
    await (await mandate.connect(agent).checkAndSpend(merchant.address, enc.handles[0], enc.inputProof)).wait();
  }
  async function received(merchant: HardhatEthersSigner): Promise<bigint> {
    const h = await cusdt.confidentialBalanceOf(merchant.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, cusdtAddr, merchant);
  }
  async function spent(): Promise<bigint> {
    const h = await mandate.spentOf(agent.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, mandateAddr, principal);
  }

  before(async function () {
    const s = await ethers.getSigners();
    [bank, principal, agent, cleanM, riskyM] = [s[0], s[1], s[2], s[3], s[4]];
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    ({ t: cusdt, o: oracle, m: mandate, cusdtAddr, oracleAddr, mandateAddr } = await deploy());

    await (await oracle.connect(bank).setMember(bank.address, true)).wait();
    await (await oracle.connect(bank).setMember(mandateAddr, true)).wait();

    // principal funds themselves and authorises the mandate to move their cUSDT
    await (await cusdt.connect(principal).faucet(5000)).wait();
    await (await cusdt.connect(principal).setOperator(mandateAddr, MAX_DEADLINE)).wait();

    // encrypted 1,000 cap; allow-list two merchants
    const cap = await fhevm.createEncryptedInput(mandateAddr, principal.address).add64(1000).encrypt();
    await (
      await mandate.connect(principal).registerAgent(agent.address, cap.handles[0], cap.inputProof, 2_000_000_000, 3600, 20)
    ).wait();
    await (await mandate.connect(principal).setMerchant(agent.address, cleanM.address, true)).wait();
    await (await mandate.connect(principal).setMerchant(agent.address, riskyM.address, true)).wait();

    // a member bank flags the risky merchant with an encrypted risk score of 80
    const score = await fhevm.createEncryptedInput(oracleAddr, bank.address).add64(80).encrypt();
    await (await oracle.connect(bank).report(idOf(riskyM.address), score.handles[0], score.inputProof)).wait();
  });

  it("executes a payment that is in budget and to a clean merchant", async function () {
    await pay(cleanM, 300);
    expect(await received(cleanM)).to.eq(300n);
    expect(await spent()).to.eq(300n);
  });

  it("clamps an over-budget payment to zero — the merchant receives nothing, no revert", async function () {
    await pay(cleanM, 300); // spent 300
    await pay(cleanM, 800); // 300 + 800 > 1000 → moves 0
    expect(await received(cleanM)).to.eq(300n);
    expect(await spent()).to.eq(300n);
    await pay(cleanM, 500); // 300 + 500 ≤ 1000 → moves 500
    expect(await received(cleanM)).to.eq(800n);
    expect(await spent()).to.eq(800n);
  });

  it("blocks payment to a network-flagged merchant, even in budget — moves 0", async function () {
    await pay(riskyM, 100);
    expect(await received(riskyM)).to.eq(0n);
    expect(await spent()).to.eq(0n);
  });

  it("keeps the fraud signal private — outsiders can't read the aggregate score", async function () {
    expect(await oracle.reportCount(idOf(riskyM.address))).to.eq(1n);
    const h = await oracle.riskOf(idOf(riskyM.address));
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, h, oracleAddr, agent)).to.be.rejected;
  });

  it("kill switch: a paused agent cannot spend", async function () {
    await (await mandate.connect(principal).setPaused(agent.address, true)).wait();
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(100).encrypt();
    await expect(mandate.connect(agent).checkAndSpend(cleanM.address, enc.handles[0], enc.inputProof)).to.be.revertedWithCustomError(mandate, "IsPaused");
  });

  it("rejects a merchant that isn't on the allow-list", async function () {
    const enc = await fhevm.createEncryptedInput(mandateAddr, agent.address).add64(100).encrypt();
    await expect(mandate.connect(agent).checkAndSpend(bank.address, enc.handles[0], enc.inputProof)).to.be.revertedWithCustomError(mandate, "MerchantNotAllowed");
  });

  it("only vetted members can contribute to the oracle", async function () {
    const score = await fhevm.createEncryptedInput(oracleAddr, agent.address).add64(10).encrypt();
    await expect(oracle.connect(agent).report(idOf(cleanM.address), score.handles[0], score.inputProof)).to.be.revertedWithCustomError(oracle, "NotMember");
  });
});
