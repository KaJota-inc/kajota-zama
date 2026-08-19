// Minimal ABIs for the Àjọ frontend (only what the UI calls).

export const CUSDT_ABI = [
  "function faucet(uint64 amount) returns (bytes32)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function confidentialTransferAndCall(address to, bytes32 encryptedAmount, bytes inputProof, bytes data) returns (bytes32)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
] as const;

export const POOL_ABI = [
  "function balanceOf(address user) view returns (bytes32)",
  "function totalPooled() view returns (bytes32)",
  "function participantsCount() view returns (uint256)",
  "function isParticipant(address) view returns (bool)",
  "function phase() view returns (uint8)",
  "function roundId() view returns (uint256)",
  "function jackpot() view returns (uint64)",
  "function drawComplete() view returns (bool)",
  "function revealDeadline() view returns (uint256)",
  "function claimed(uint256, address) view returns (bool)",
  "function owner() view returns (address)",
  "function claim()",
  "function withdraw(bytes32 encAmount, bytes proof)",
  "function harvestYield(uint64 amount)",
  "function commitRound(bytes32 commitment, uint256 revealWindow)",
  "function revealSeed(bytes32 seed)",
  "function runDraw(uint256 count)",
  "function disclosePublicTotal()",
  "event Deposited(address indexed user)",
  "event Claimed(uint256 indexed roundId, address indexed user)",
  "event RoundCommitted(uint256 indexed roundId, bytes32 commitment, uint64 prizeAmount, uint256 revealDeadline)",
  "event RoundRevealed(uint256 indexed roundId, bytes32 seed)",
  "event Withdrawn(address indexed user)",
] as const;
