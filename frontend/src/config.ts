// Address of the deployed ConfidentialPay contract on Sepolia.
// Set VITE_CONTRACT_ADDRESS in a .env file (see .env.example) after `npm run deploy:sepolia`,
// or paste it directly below.
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0x0000000000000000000000000000000000000000";

export const SEPOLIA_CHAIN_ID = 11155111;
