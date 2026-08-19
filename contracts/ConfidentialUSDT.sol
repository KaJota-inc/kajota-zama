// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title Confidential USD Test token (cUSDT)
/// @notice Minimal ERC-7984 confidential token used as the deposit rail for Àjọ —
///         the Confidential PoolTogether entry to the Zama Developer Program Mainnet
///         Season 4. Balances and transfers are encrypted `euint64`; the chain only
///         ever sees ciphertext. A public faucet mints test units so any judge can
///         try the pool end-to-end on Sepolia.
/// @dev Extends OpenZeppelin's audited `ERC7984` and wires the Zama coprocessor via
///      `ZamaEthereumConfig` (covers Sepolia). This is a self-contained test rail; in
///      production the pool would point at the canonical `cUSDT` ERC-7984 deployment.
contract ConfidentialUSDT is ERC7984, ZamaEthereumConfig {
    constructor() ERC7984("Confidential USD Test", "cUSDT", "") {}

    /// @inheritdoc ERC7984
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Public faucet — mint `amount` (6-dp units) of cUSDT to the caller.
    /// @dev `amount` is a trivially-encrypted plaintext; the *balances* it feeds into
    ///      stay confidential. Returns the encrypted amount actually minted.
    function faucet(uint64 amount) external returns (euint64) {
        return _mint(msg.sender, FHE.asEuint64(amount));
    }
}
