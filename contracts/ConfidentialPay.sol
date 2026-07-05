// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title KaJota Confidential Pay
/// @author KaJota (Zama Developer Program — Mainnet Season 3)
/// @notice A confidential payment ledger where every balance and every transferred
///         amount is Fully-Homomorphically Encrypted. Amounts are never revealed on
///         chain: transfers compute on ciphertext and overspend is prevented with an
///         encrypted `select`, so a failed transfer is indistinguishable from a
///         successful one and leaks nothing about either party's balance.
/// @dev Built on @fhevm/solidity. Balances are `euint64` handles; only the account
///      owner (and the contract) are granted decryption rights via the FHE ACL.
contract ConfidentialPay is ZamaEthereumConfig {
    /// @notice Encrypted balance of each account.
    mapping(address account => euint64 encryptedBalance) private _balances;

    /// @notice Whether an account has already claimed the demo faucet.
    mapping(address account => bool claimed) public hasClaimed;

    /// @notice Clear amount minted by the demo faucet (encrypted on-chain on claim).
    uint64 public constant FAUCET_AMOUNT = 10_000;

    /// @notice Emitted on a successful faucet claim. Amount is public (it is a constant).
    event FaucetClaimed(address indexed account);

    /// @notice Emitted on a confidential transfer. No amount is emitted — it stays encrypted.
    event ConfidentialTransfer(address indexed from, address indexed to);

    /// @notice Returns the caller's own encrypted balance handle.
    /// @dev The returned handle is only decryptable by accounts the ACL has granted.
    ///      Use the relayer SDK's user-decryption to read the clear value client-side.
    function balanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /// @notice One-time demo faucet: seeds the caller with an encrypted balance.
    /// @dev The amount is a public constant, encrypted trivially on-chain. In a real
    ///      deployment this would be a confidential deposit from an on/off-ramp.
    function claimFaucet() external {
        require(!hasClaimed[msg.sender], "ConfidentialPay: already claimed");
        hasClaimed[msg.sender] = true;

        euint64 current = _initialized(_balances[msg.sender]);
        euint64 newBalance = FHE.add(current, FHE.asEuint64(FAUCET_AMOUNT));
        _balances[msg.sender] = newBalance;

        _grant(newBalance, msg.sender);
        emit FaucetClaimed(msg.sender);
    }

    /// @notice Confidentially transfer an encrypted amount to `to`.
    /// @param to The recipient.
    /// @param encryptedAmount External encrypted amount handle (from the relayer SDK).
    /// @param inputProof Zero-knowledge input proof binding the ciphertext to this contract/caller.
    /// @dev If the caller cannot afford the amount, exactly zero is transferred — and the
    ///      on-chain trace is identical to a funded transfer, so balances stay private.
    function confidentialTransfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        require(to != address(0), "ConfidentialPay: zero recipient");
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transfer(msg.sender, to, amount);
        emit ConfidentialTransfer(msg.sender, to);
    }

    /// @notice Confidentially disperse encrypted amounts to many recipients in one call.
    /// @param recipients The list of recipients.
    /// @param encryptedAmounts One external encrypted amount handle per recipient.
    /// @param inputProofs One input proof per recipient.
    /// @dev Serves the TokenOps confidential-disperse flow: a payer splits a private
    ///      balance across N accounts without any per-recipient amount ever being public.
    function confidentialDisperse(
        address[] calldata recipients,
        externalEuint64[] calldata encryptedAmounts,
        bytes[] calldata inputProofs
    ) external {
        require(recipients.length == encryptedAmounts.length, "ConfidentialPay: length mismatch");
        require(recipients.length == inputProofs.length, "ConfidentialPay: length mismatch");
        require(recipients.length > 0, "ConfidentialPay: empty disperse");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "ConfidentialPay: zero recipient");
            euint64 amount = FHE.fromExternal(encryptedAmounts[i], inputProofs[i]);
            _transfer(msg.sender, recipients[i], amount);
            emit ConfidentialTransfer(msg.sender, recipients[i]);
        }
    }

    /// @dev Core confidential transfer. Overspend is clamped to zero on ciphertext so
    ///      that no branch — and therefore no balance information — is ever revealed.
    function _transfer(address from, address to, euint64 amount) private {
        euint64 fromBalance = _initialized(_balances[from]);
        euint64 toBalance = _initialized(_balances[to]);

        // canSend = amount <= fromBalance, evaluated entirely on ciphertext.
        ebool canSend = FHE.le(amount, fromBalance);
        // If the caller can't afford it, send encrypted zero instead — trace is identical.
        euint64 sent = FHE.select(canSend, amount, FHE.asEuint64(0));

        euint64 newFrom = FHE.sub(fromBalance, sent);
        euint64 newTo = FHE.add(toBalance, sent);

        _balances[from] = newFrom;
        _balances[to] = newTo;

        // Re-grant decryption rights on the freshly-produced handles.
        _grant(newFrom, from);
        _grant(newTo, to);
    }

    /// @dev Returns the handle if initialized, otherwise an encrypted zero, so that
    ///      arithmetic on never-touched accounts is well-defined.
    function _initialized(euint64 balance) private returns (euint64) {
        if (FHE.isInitialized(balance)) {
            return balance;
        }
        return FHE.asEuint64(0);
    }

    /// @dev Grant the contract and the account owner decryption rights on a handle.
    function _grant(euint64 handle, address account) private {
        FHE.allowThis(handle);
        FHE.allow(handle, account);
    }
}
