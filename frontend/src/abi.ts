// Minimal ABI for the ConfidentialPay contract. Encrypted types map to their
// underlying ABI representation: euint64 / externalEuint64 => bytes32, input proof => bytes.
export const CONFIDENTIAL_PAY_ABI = [
  "function claimFaucet()",
  "function hasClaimed(address account) view returns (bool)",
  "function FAUCET_AMOUNT() view returns (uint64)",
  "function balanceOf(address account) view returns (bytes32)",
  "function confidentialTransfer(address to, bytes32 encryptedAmount, bytes inputProof)",
  "function confidentialDisperse(address[] recipients, bytes32[] encryptedAmounts, bytes[] inputProofs)",
  "event FaucetClaimed(address indexed account)",
  "event ConfidentialTransfer(address indexed from, address indexed to)",
] as const;
