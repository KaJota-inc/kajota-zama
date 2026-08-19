// Àjọ — Confidential PoolTogether · live Sepolia deployment (public addresses).
// Override via VITE_POOL_ADDRESS / VITE_CUSDT_ADDRESS for a different deploy.
export const POOL_ADDRESS: string =
  (import.meta.env.VITE_POOL_ADDRESS as string | undefined) ?? "0x760FBfAdAd6576bd93c4bf3cBBc4718B07EA1739";

export const CUSDT_ADDRESS: string =
  (import.meta.env.VITE_CUSDT_ADDRESS as string | undefined) ?? "0x3513B7f708D512b5196035D5Aef610e0910dA97B";

export const SEPOLIA_CHAIN_ID = 11155111;
export const CUSDT_DECIMALS = 6;

// Public read-only RPC — lets the UI show live pool state before a wallet connects.
export const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

export const EXPLORER = "https://sepolia.etherscan.io";

// Phase enum mirrors ConfidentialPool.Phase.
export const PHASES = ["Open", "Committed", "Revealed"] as const;

// Real on-chain proof set (the "no mocked data" evidence trail) — v2 single-winner draw.
export const PROOFS: { step: string; txHash: string }[] = [
  { step: "faucet cUSDT (mint)", txHash: "0xb071c1c8c464e32d12344b3c258ebac812ab8f5692440e44acc1a43ab041ff34" },
  { step: "deposit (confidentialTransferAndCall)", txHash: "0xb478fab1ae61d42cac78b5028e20d3768493f2f299437d245cff27fa110e7eeb" },
  { step: "harvestYield (fund jackpot from yield)", txHash: "0x1f3f4fa4a7f0513e9cb3942327cfa769baefb23a01a6921e08dbe87a21bd09f1" },
  { step: "commitRound (freeze total, hide seed)", txHash: "0xacb04cef49b167970ff9d71edffb40f2fcfd3c269c959e339e0ebbf485300889" },
  { step: "revealSeed (public randomness)", txHash: "0xb2efcdd00b81b9b8fa2f15c4c84da65e96ce79d921a73783e19ffb87be69e4ac" },
  { step: "runDraw (encrypted cumulative winner)", txHash: "0x6b51d6e46140b9a29199a81acf261f2f49ebfa6788e51d512b089801d4234cf0" },
  { step: "claim (winner payout)", txHash: "0x64d173901a8197e229e3081807c8c320c64e5dd6d0724317113022b82f228b63" },
  { step: "disclosePublicTotal (aggregate reveal)", txHash: "0x51534320a8bb7265e3b89148eb3c51b2eb263c24180bdfe724ed4f0939d1d411" },
  { step: "withdraw (principal + jackpot)", txHash: "0x2e84729c28f32af338eaf2bf3b7bb059573a3ed55f2253f4aa2dd09fa1d31c37" },
];
