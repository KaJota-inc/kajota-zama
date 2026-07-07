import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";
import * as fs from "fs";

import "./tasks/accounts";
import "./tasks/ConfidentialPay";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set

// Resolve the deploy mnemonic in priority order:
//   1. the `MNEMONIC` Hardhat configuration variable (npx hardhat vars set MNEMONIC), else
//   2. a gitignored local `.secret.mnemonic` file (a throwaway dev key), else
//   3. the well-known Hardhat test mnemonic (local/mock only — never funded).
function resolveMnemonic(): string {
  const fromVars = vars.get("MNEMONIC", "");
  if (fromVars) return fromVars;
  try {
    const fromFile = fs.readFileSync(`${__dirname}/.secret.mnemonic`, "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    /* file absent — fall through */
  }
  return "test test test test test test test test test test test junk";
}

const MNEMONIC: string = resolveMnemonic();

// Provider-agnostic Sepolia RPC. Set a full URL via `npx hardhat vars set SEPOLIA_RPC_URL`
// (Alchemy, dRPC, PublicNode, etc.). Falls back to an Infura URL if you set INFURA_API_KEY,
// then to a public endpoint as a last resort.
const INFURA_API_KEY: string = vars.get("INFURA_API_KEY", "");
const SEPOLIA_RPC_URL: string = vars.get(
  "SEPOLIA_RPC_URL",
  INFURA_API_KEY ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}` : "https://sepolia.drpc.org",
);

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    anvil: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
