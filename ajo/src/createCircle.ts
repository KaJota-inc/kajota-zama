import { ethers } from "ethers";
import { CUSDT_ADDRESS, MANDATE_ADDRESS, CUSDT_DECIMALS } from "./config";
import { POOL_BYTECODE, POOL_DEPLOY_ABI } from "./poolArtifact";

const UNIT = 10 ** CUSDT_DECIMALS;

export type CreateOpts = {
  jackpot: number; // cUSDT to seed as the prize (0 = none)
  authorizeMandate: boolean; // let the Shield agent mandate save into this circle
  onStep?: (msg: string) => void;
};

// Deploy a brand-new ConfidentialPool ("circle") from the connected wallet, on the canonical cUSDT.
// The deployer becomes the circle's owner, so they can run its full lifecycle from the Classic view.
export async function deployCircle(signer: ethers.Signer, opts: CreateOpts): Promise<string> {
  const step = opts.onStep ?? (() => {});

  step("Creating your circle… (approve in your wallet)");
  const factory = new ethers.ContractFactory(POOL_DEPLOY_ABI, POOL_BYTECODE, signer);
  const pool = await factory.deploy(CUSDT_ADDRESS);
  await pool.waitForDeployment();
  const address = await pool.getAddress();
  step("Circle created ✓");

  const c = pool as unknown as {
    harvestYield: (a: bigint, o?: object) => Promise<ethers.ContractTransactionResponse>;
    setDepositor: (g: string, a: boolean, o?: object) => Promise<ethers.ContractTransactionResponse>;
  };

  if (opts.jackpot > 0) {
    step(`Adding the ${opts.jackpot.toLocaleString()}-coin prize…`);
    const amt = BigInt(Math.round(opts.jackpot * UNIT));
    await (await c.harvestYield(amt, { gasLimit: 2_500_000n })).wait();
  }

  if (opts.authorizeMandate) {
    step("Turning on the AI-assistant option…");
    await (await c.setDepositor(MANDATE_ADDRESS, true, { gasLimit: 120_000n })).wait();
  }

  step("Done — your circle is ready.");
  return address;
}
