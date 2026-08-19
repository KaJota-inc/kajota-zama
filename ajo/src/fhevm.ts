import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import { ethers } from "ethers";

export type FhevmInstance = Awaited<ReturnType<typeof createInstance>>;

let instancePromise: Promise<FhevmInstance> | null = null;

/// Lazily initialize the WASM SDK and build a single relayer instance bound to
/// the injected wallet provider. Safe to call repeatedly — it memoizes.
export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      await initSDK(); // loads the TFHE / KMS WASM modules
      const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (!eth) throw new Error("No injected wallet (window.ethereum) found");
      return createInstance({ ...SepoliaConfig, network: eth });
    })();
  }
  return instancePromise;
}

/// Encrypt a clear uint64 amount into an external ciphertext handle + input proof,
/// bound to (contract, user) so the coprocessor accepts it only for this call.
export async function encryptAmount(
  instance: FhevmInstance,
  contractAddress: string,
  userAddress: string,
  amount: bigint,
): Promise<{ handle: string; proof: string }> {
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(amount);
  const enc = await input.encrypt();
  return {
    handle: ethers.hexlify(enc.handles[0]),
    proof: ethers.hexlify(enc.inputProof),
  };
}

/// Encrypt several amounts for one disperse call, all bound to (contract, user).
export async function encryptAmounts(
  instance: FhevmInstance,
  contractAddress: string,
  userAddress: string,
  amounts: bigint[],
): Promise<{ handles: string[]; proofs: string[] }> {
  const handles: string[] = [];
  const proofs: string[] = [];
  for (const amount of amounts) {
    const { handle, proof } = await encryptAmount(instance, contractAddress, userAddress, amount);
    handles.push(handle);
    proofs.push(proof);
  }
  return { handles, proofs };
}

/// User-decrypt a ciphertext balance handle. Runs the EIP-712 keypair/signature
/// handshake so the KMS returns the clear value only to the authorized account.
export async function userDecryptBalance(
  instance: FhevmInstance,
  signer: ethers.Signer,
  contractAddress: string,
  handle: string,
): Promise<bigint> {
  if (/^0x0+$/.test(handle)) return 0n; // uninitialized balance == encrypted zero

  const userAddress = await signer.getAddress();
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const contractAddresses = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);

  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: [...eip712.types.UserDecryptRequestVerification] },
    eip712.message,
  );

  const result = await instance.userDecrypt(
    [{ handle, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    contractAddresses,
    userAddress,
    startTimestamp,
    durationDays,
  );

  const results = result as Record<string, string | number | bigint>;
  const clear = results[handle] ?? results[handle.toLowerCase()];
  return BigInt(clear);
}

/// Public-decrypt an aggregate handle that the contract has marked publicly
/// decryptable (e.g. the pool total after `disclosePublicTotal`). No signature
/// needed — anyone can read it. Returns null if the handle is not yet disclosed.
export async function publicDecrypt(instance: FhevmInstance, handle: string): Promise<bigint | null> {
  if (/^0x0+$/.test(handle)) return 0n;
  try {
    const res = (await instance.publicDecrypt([handle])) as unknown as {
      clearValues?: Record<string, string | number | bigint>;
    };
    const map = res.clearValues ?? (res as unknown as Record<string, string | number | bigint>);
    const clear = map[handle] ?? map[handle.toLowerCase()];
    return clear === undefined || clear === null ? null : BigInt(clear);
  } catch {
    return null; // not yet made publicly decryptable
  }
}
