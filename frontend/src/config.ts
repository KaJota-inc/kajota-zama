// Address of the deployed ConfidentialPay contract on Sepolia.
// Set VITE_CONTRACT_ADDRESS in a .env file (see .env.example) after `npm run deploy:sepolia`,
// or paste it directly below.
// Defaults to the live Sepolia deployment so the app works with zero env config
// (the address is public). Override with VITE_CONTRACT_ADDRESS for a different deploy.
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0xe4292f6aF1FA9668713269bE1643354a557BF342";

export const SEPOLIA_CHAIN_ID = 11155111;
