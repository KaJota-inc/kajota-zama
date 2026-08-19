// Àjọ — Confidential PoolTogether · canonical merged Sepolia deployment (v3 time-weighted + the
// Shield agent bridge). One cUSDT + one oracle + one mandate + one pool. Public addresses.
export const POOL_ADDRESS: string =
  (import.meta.env.VITE_POOL_ADDRESS as string | undefined) ?? "0x885843C8110aEe5eFe3c69810ef89790AB74767A";

export const CUSDT_ADDRESS: string =
  (import.meta.env.VITE_CUSDT_ADDRESS as string | undefined) ?? "0x6Be1122CE0e08DBD847f0C02cfc6188246F790B8";

export const SEPOLIA_CHAIN_ID = 11155111;
export const CUSDT_DECIMALS = 6;

// Public read-only RPC — lets the UI show live pool state before a wallet connects.
export const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

export const EXPLORER = "https://sepolia.etherscan.io";

// Phase enum mirrors ConfidentialPool.Phase.
export const PHASES = ["Open", "Committed", "Revealed"] as const;

// Real on-chain proof set on the canonical pool (the "no mocked data" evidence trail).
export const PROOFS: { step: string; txHash: string }[] = [
  { step: "faucet cUSDT (mint)", txHash: "0x3ec52a52e3af1703ca24dfa188a03f99b334d157109622d580ec86209e2da6c9" },
  { step: "deposit (confidentialTransferAndCall)", txHash: "0xefcd6431460e548bc68f969339af1ab305c41976dce8202a6876c220c6869d5c" },
  { step: "harvestYield (fund jackpot from yield)", txHash: "0xe269f4dd9d945035c0633eb0c42e3f2279bcdae68200e07efb9cf9117c8604ec" },
  { step: "commitRound (freeze total, hide seed)", txHash: "0x9ced5f58028be9e7383e6c56031a829da9057669cd3d509ea3c58bac601886b1" },
  { step: "revealSeed (public randomness)", txHash: "0xb852e6d4ed39a46c2ac66073ef27ed6bd8facdc9f087a75443e795d279ade31d" },
  { step: "tallyDraw (time-weighted odds)", txHash: "0x2e8d566129e317ebd61e7bd8ef3a205cd671b6ae9b831c68380a085e3e2fe20c" },
  { step: "runDraw (encrypted single-winner)", txHash: "0xd4d7ea604878136301228ad6a25299d6e4dc28dfd4565bcb205bfd18b19adf40" },
  { step: "claim (winner payout)", txHash: "0x42505e287af995a9534fc4a2dc451a99b2bde0a7e14e86e67f75044b867c9b8d" },
  { step: "disclosePublicTotal (aggregate reveal)", txHash: "0x2f35aec4f68935d35ff918086c97b6d983359af1bc779ea27e108b4c0df1bda3" },
  { step: "withdraw (principal + jackpot)", txHash: "0x6b5240775f662818df35a188479b7aa69eb619298223f949f024bce55f11092a" },
  { step: "🛡️ agent saves into the pool (Shield bridge)", txHash: "0xa8482b7c458b276645dfd5fded8be505970ce1cc957bb1d5f63490f0434738bc" },
];
