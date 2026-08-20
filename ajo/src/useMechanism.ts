import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { getFhevmInstance, encryptAmount, userDecryptBalance } from "./fhevm";
import { CUSDT_ABI } from "./abi";
import { CUSDT_ADDRESS, SEPOLIA_CHAIN_ID, CUSDT_DECIMALS, PUBLIC_RPC } from "./config";

const UNIT = 10 ** CUSDT_DECIMALS;
export const toUnits = (v: number) => BigInt(Math.round(v * UNIT));
export const fromUnits = (v: bigint) => Number(v) / UNIT;
export const shortA = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const FHE_GAS = 6_000_000n;
const TAC = "confidentialTransferAndCall(address,bytes32,bytes,bytes)";

type Eip1193 = ethers.Eip1193Provider & { on?: (e: string, cb: (...a: unknown[]) => void) => void };

/// Shared wallet + generic pool actions (connect, get coins, deposit, reveal, withdraw) for the
/// alternative confidential-pool mechanisms. Each view adds its own mechanism-specific writes using
/// the exposed `signer` / `write` contract.
export function useMechanism(poolAddress: string, abi: readonly string[]) {
  const [address, setAddress] = useState<string>();
  const [chainOk, setChainOk] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer>();
  const [busy, setBusy] = useState<string>();
  const [log, setLog] = useState<string[]>([]);
  const [myBalance, setMyBalance] = useState<bigint | null>(null);
  const [tick, setTick] = useState(0);

  const say = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 40));
  const bump = () => setTick((t) => t + 1);

  const provider = useMemo(() => {
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    return eth ? new ethers.BrowserProvider(eth) : null;
  }, []);
  const readProvider = useMemo(() => provider ?? new ethers.JsonRpcProvider(PUBLIC_RPC), [provider]);

  const read = useMemo(() => new ethers.Contract(poolAddress, abi, readProvider), [poolAddress, abi, readProvider]);
  const write = useMemo(
    () => (signer ? new ethers.Contract(poolAddress, abi, signer) : null),
    [poolAddress, abi, signer],
  );

  const connect = async () => {
    if (!provider) return say("No wallet found — install MetaMask.");
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum!;
    await eth.request({ method: "eth_requestAccounts" });
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== SEPOLIA_CHAIN_ID) {
      setChainOk(false);
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
      } catch {
        return say("Switch MetaMask to Sepolia.");
      }
    }
    setChainOk(true);
    const s = await provider.getSigner();
    setSigner(s);
    setAddress(await s.getAddress());
    say("Wallet connected.");
    bump();
  };

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    try {
      setBusy(label);
      await fn();
    } catch (e) {
      say(`✗ ${label}: ${(e as Error).message.slice(0, 130)}`);
    } finally {
      setBusy(undefined);
      bump();
    }
  }, []);

  const faucet = () =>
    run("faucet", async () => {
      const c = new ethers.Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await c.faucet(toUnits(1000), { gasLimit: 2_000_000n });
      say(`Getting coins ${shortA(tx.hash)} …`);
      await tx.wait();
      say("✓ Got 1,000 coins.");
    });

  const deposit = (amount: number) =>
    run("deposit", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, CUSDT_ADDRESS, address!, toUnits(amount));
      const c = new ethers.Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await c[TAC](poolAddress, handle, proof, "0x", { gasLimit: FHE_GAS });
      say(`Adding privately ${shortA(tx.hash)} …`);
      await tx.wait();
      say(`✓ Added ${amount} coins (encrypted).`);
    });

  const revealBalance = () =>
    run("reveal", async () => {
      const inst = await getFhevmInstance();
      const handle = await read.balanceOf(address);
      if (handle === ethers.ZeroHash) {
        setMyBalance(0n);
        return say("✓ Your balance: 0 coins.");
      }
      const clear = await userDecryptBalance(inst, signer!, poolAddress, handle);
      setMyBalance(clear);
      say(`✓ Your balance: ${fromUnits(clear)} coins (only you can see this).`);
    });

  const withdraw = (amount: number) =>
    run("withdraw", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, poolAddress, address!, toUnits(amount));
      const tx = await write!.withdraw(handle, proof, { gasLimit: FHE_GAS });
      say(`Taking out ${shortA(tx.hash)} …`);
      await tx.wait();
      say(`✓ Took out up to ${amount} coins.`);
    });

  useEffect(() => {
    if (!provider) return;
    provider.getSigner().then(
      async (s) => {
        setSigner(s);
        setAddress(await s.getAddress());
      },
      () => {},
    );
  }, [provider]);

  return {
    address,
    signer,
    chainOk,
    connected: !!address,
    busy,
    log,
    myBalance,
    tick,
    read,
    write,
    say,
    run,
    bump,
    connect,
    faucet,
    deposit,
    revealBalance,
    withdraw,
  };
}
