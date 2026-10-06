// Manifest shape — matches `deployments/beacon-sepolia.json` as emitted by
// `scripts/beacon/deploy-{mandate-anchor,sakk-esusu}.mjs` + the seed scripts.

export type DeployedContract = {
  address: string;
  txHash: string;
  allowBankTx?: string;
  allowPayerTx?: string;
  allowOrganiserTx?: string;
  // Sakk + Esusu seed fields
  seedSakkId?: string;
  seedCommit?: string;
  seedWitnesses?: string[];
  seedBeneficiary?: string;
  seedRotationId?: string;
  seedMembers?: string[];
  seedCollectorOrder?: string[];
  seedContribution?: string;
  seedCycleLength?: string;
  seedSealTx?: string;
  seedSealBlock?: number | null;
};

export type AnchorRecord = {
  sequence: number;
  tickBucket: number;
  mandateId: string;
  idempotencyKey: string;
  amount: string;
  commitment: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
};

export type BeaconManifest = {
  network: string;
  chainId: number;
  deployer: string;
  slaWindowSeconds: number;
  deployedAt: string;
  branch: string;
  lastSequence?: number;
  anchors?: AnchorRecord[];
  MandateAnchor: DeployedContract;
  SakkMandate?: DeployedContract;
  EsusuMandate?: DeployedContract;
  allowBankTx?: string;
  sakkEsusuDeployedAt?: string;
  sakkEsusuSeededAt?: string;
};
