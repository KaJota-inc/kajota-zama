// Deploy the Mandate Beacon rail — MandateAnchor + SakkMandate + EsusuMandate — to the
// configured network. Writes a stable JSON manifest the submission form can link to.
//
// Usage:
//   npx hardhat run scripts/beacon/deploy-beacon.ts --network sepolia
//   npx hardhat run scripts/beacon/deploy-beacon.ts --network galileo
//
// Needs a funded signer in the configured mnemonic. Verify afterward with:
//   npx hardhat verify --network sepolia <addr> <constructor-args>
// The MandateAnchor constructor takes `slaWindowSeconds` — defaults to CBN CPR 2019 (24h).

import { writeFileSync, mkdirSync } from "node:fs";
import { ethers, network, run } from "hardhat";

const CBN_CPR_2019_SECONDS = 24 * 60 * 60; // the BLI primitive's SLA window

type DeployedContract = {
  name: string;
  address: string;
  constructorArgs: unknown[];
  txHash: string;
  blockNumber: number | null;
  gasUsed: string | null;
};

async function deployOne(
  name: string,
  constructorArgs: unknown[],
): Promise<DeployedContract> {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...constructorArgs);
  const tx = contract.deploymentTransaction();
  if (!tx) throw new Error(`${name}: no deployment transaction`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = await tx.wait();

  console.log(`  ${name.padEnd(16)} ${address}`);
  console.log(`    txHash:    ${tx.hash}`);
  console.log(`    block:     ${receipt?.blockNumber ?? "pending"}`);
  console.log(`    gasUsed:   ${receipt?.gasUsed?.toString() ?? "unknown"}`);

  return {
    name,
    address,
    constructorArgs,
    txHash: tx.hash,
    blockNumber: receipt?.blockNumber ?? null,
    gasUsed: receipt?.gasUsed?.toString() ?? null,
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Mandate Beacon — deploy");
  console.log("─".repeat(72));
  console.log(`network:   ${network.name} (chainId ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`deployer:  ${deployer.address}`);
  console.log(`balance:   ${ethers.formatEther(balance)} ETH`);
  console.log("─".repeat(72));

  if (balance === 0n && network.name !== "hardhat" && network.name !== "localhost") {
    throw new Error(
      `deployer has 0 balance on ${network.name}; fund ${deployer.address} first`,
    );
  }

  const mandateAnchor = await deployOne("MandateAnchor", [CBN_CPR_2019_SECONDS]);
  const sakkMandate = await deployOne("SakkMandate", []);
  const esusuMandate = await deployOne("EsusuMandate", []);

  const manifest = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MandateAnchor: mandateAnchor,
      SakkMandate: sakkMandate,
      EsusuMandate: esusuMandate,
    },
    primitives: {
      slaWindow: {
        label: "cbn-cpr-24h",
        seconds: CBN_CPR_2019_SECONDS,
        regulatoryAnchor: "CBN Consumer Protection Regulation 2019, Part 6",
      },
    },
  };

  mkdirSync("deployments", { recursive: true });
  const path = `deployments/beacon-${network.name}.json`;
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nmanifest written → ${path}`);

  // Automatic verify on Etherscan-compatible networks; silent-skip on 0G / local chains.
  if (process.env.SKIP_VERIFY === "1" || network.name === "hardhat" || network.name === "localhost") {
    console.log("(skip-verify: hardhat/localhost or SKIP_VERIFY=1)");
    return;
  }

  console.log("\nverifying on explorer…");
  for (const c of [mandateAnchor, sakkMandate, esusuMandate]) {
    try {
      await run("verify:verify", {
        address: c.address,
        constructorArguments: c.constructorArgs,
      });
      console.log(`  ✓ ${c.name} verified`);
    } catch (err) {
      const msg = (err as Error).message;
      if (/already verified/i.test(msg)) {
        console.log(`  ✓ ${c.name} already verified`);
      } else {
        console.log(`  ⚠ ${c.name} verify failed: ${msg.split("\n")[0]}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
