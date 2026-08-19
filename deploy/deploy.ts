import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Àjọ — Confidential PoolTogether (Zama Developer Program Mainnet Season 4).
// Deploys the ERC-7984 cUSDT test rail, then the ConfidentialPool wired to it.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const cusdt = await deploy("ConfidentialUSDT", {
    from: deployer,
    log: true,
  });
  console.log(`ConfidentialUSDT (cUSDT): ${cusdt.address}`);

  const pool = await deploy("ConfidentialPool", {
    from: deployer,
    args: [cusdt.address],
    log: true,
  });
  console.log(`ConfidentialPool (Àjọ):  ${pool.address}`);
};

export default func;
func.id = "deploy_ajo_confidential_pool";
func.tags = ["Ajo", "ConfidentialPool", "ConfidentialUSDT"];
