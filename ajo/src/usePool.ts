import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { getFhevmInstance, encryptAmount, userDecryptBalance, publicDecrypt } from "./fhevm";
import { CUSDT_ABI, POOL_ABI } from "./abi";
import { POOL_ADDRESS, CUSDT_ADDRESS, SEPOLIA_CHAIN_ID, CUSDT_DECIMALS, PUBLIC_RPC } from "./config";

const UNIT = 10 ** CUSDT_DECIMALS;
export const toUnits = (v: number) => BigInt(Math.round(v * UNIT));
export const fromUnits = (v: bigint) => Number(v) / UNIT;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const FHE_GAS = 6_000_000n;

type Eip1193 = ethers.Eip1193Provider & { on?: (e: string, cb: (...a: unknown[]) => void) => void };

/// Shared wallet + contract state and actions for Àjọ. Both the classic dApp view and the
/// 3D game view consume this, so they never drift.
export function usePool(POOL: string = POOL_ADDRESS) {
  const [address, setAddress] = useState<string>();
  const [chainOk, setChainOk] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer>();
  const [busy, setBusy] = useState<string>();
  const [log, setLog] = useState<string[]>([]);

  const [phase, setPhase] = useState(0);
  const [roundId, setRoundId] = useState(0n);
  const [jackpot, setJackpot] = useState(0n);
  const [count, setCount] = useState(0n);
  const [drawComplete, setDrawComplete] = useState(false);
  const [owner, setOwner] = useState<string>();
  const [publicTotal, setPublicTotal] = useState<bigint | null>(null);
  const [myBalance, setMyBalance] = useState<bigint | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);

  const say = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 40));

  const provider = useMemo(() => {
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    return eth ? new ethers.BrowserProvider(eth) : null;
  }, []);
  const readProvider = useMemo(() => provider ?? new ethers.JsonRpcProvider(PUBLIC_RPC), [provider]);

  const refresh = useCallback(async () => {
    const pool = new ethers.Contract(POOL, POOL_ABI, readProvider);
    try {
      const [ph, rid, jp, ct, ow, dc] = await Promise.all([
        pool.phase(),
        pool.roundId(),
        pool.jackpot(),
        pool.participantsCount(),
        pool.owner(),
        pool.drawComplete(),
      ]);
      setPhase(Number(ph));
      setRoundId(rid);
      setJackpot(jp);
      setCount(ct);
      setOwner(ow);
      setDrawComplete(Boolean(dc));
    } catch {
      /* rpc hiccup */
    }
  }, [readProvider, POOL]);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 12_000);
    return () => clearInterval(t);
  }, [refresh]);

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
    void refresh();
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      setBusy(label);
      await fn();
    } catch (e) {
      say(`✗ ${label}: ${(e as Error).message.slice(0, 140)}`);
    } finally {
      setBusy(undefined);
      void refresh();
    }
  };

  const faucet = () =>
    run("faucet", async () => {
      const c = new ethers.Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await c.faucet(toUnits(1000), { gasLimit: 2_000_000n });
      say(`Faucet ${short(tx.hash)} …`);
      await tx.wait();
      say("✓ Minted 1,000 cUSDT.");
    });

  const deposit = (amount: number) =>
    run("deposit", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, CUSDT_ADDRESS, address!, toUnits(amount));
      const c = new ethers.Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await c["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](POOL, handle, proof, "0x", {
        gasLimit: FHE_GAS,
      });
      say(`Deposit ${short(tx.hash)} … (encrypted)`);
      await tx.wait();
      say(`✓ Deposited ${amount} cUSDT (encrypted).`);
    });

  const revealBalance = () =>
    run("reveal", async () => {
      const inst = await getFhevmInstance();
      const pool = new ethers.Contract(POOL, POOL_ABI, provider);
      const clear = await userDecryptBalance(inst, signer!, POOL, await pool.balanceOf(address));
      setMyBalance(clear);
      say(`✓ Your balance: ${fromUnits(clear)} cUSDT (decrypted for you only).`);
    });

  const claim = () =>
    run("claim", async () => {
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      let tx: ethers.ContractTransactionResponse;
      try {
        tx = await c.claim({ gasLimit: FHE_GAS });
      } catch {
        throw new Error("Nothing to collect yet — a winner hasn't been drawn, or you've already collected this round.");
      }
      say(`Collecting ${short(tx.hash)} …`);
      try {
        await tx.wait();
      } catch {
        throw new Error("Couldn't collect — the winner hasn't been drawn yet, or you've already collected this round.");
      }
      say("✓ Collected — reveal your balance to see if you won.");
    });

  const withdraw = (amount: number) =>
    run("withdraw", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, POOL, address!, toUnits(amount));
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      const tx = await c.withdraw(handle, proof, { gasLimit: FHE_GAS });
      say(`Withdraw ${short(tx.hash)} …`);
      await tx.wait();
      say(`✓ Withdrew up to ${amount} cUSDT (clamped to your balance).`);
    });

  const discloseTotal = () =>
    run("disclose", async () => {
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      await (await c.disclosePublicTotal({ gasLimit: 500_000n })).wait();
      const inst = await getFhevmInstance();
      const pool = new ethers.Contract(POOL, POOL_ABI, provider);
      const t = await publicDecrypt(inst, await pool.totalPooled());
      setPublicTotal(t);
      say(`✓ Public pool total: ${t === null ? "—" : fromUnits(t)} cUSDT.`);
    });

  // ── Operator controls (owner only) — run a full draw in-app, no CLI ────────────────────
  const seedKey = (rid: bigint) => `ajo-seed-${POOL}-${rid.toString()}`;

  const harvest = () =>
    run("harvest", async () => {
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      await (await c.harvestYield(toUnits(250), { gasLimit: 2_500_000n })).wait();
      say("✓ Harvested 250 cUSDT of yield into the jackpot.");
    });

  const commit = () =>
    run("commit", async () => {
      const seed = ethers.hexlify(ethers.randomBytes(32));
      localStorage.setItem(seedKey(roundId), seed);
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      await (await c.commitRound(ethers.keccak256(seed), 3600n, { gasLimit: 600_000n })).wait();
      say("✓ Committed a hidden seed — deposits frozen, draw armed.");
    });

  const reveal = () =>
    run("reveal-seed", async () => {
      const seed = localStorage.getItem(seedKey(roundId));
      if (!seed) throw new Error("seed for this round not found in this browser");
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      await (await c.revealSeed(seed, { gasLimit: 600_000n })).wait();
      say("✓ Seed revealed — public randomness is now on-chain.");
    });

  const draw = () =>
    run("draw", async () => {
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      // Contract requires tallyDraw (time-weighted odds) to finish before runDraw. Both are
      // paginated one saver per tx to stay under the FHEVM HCU depth limit.
      let guard = 0;
      while (!(await c.tallyComplete()) && guard++ < 60) {
        await (await c.tallyDraw(1n, { gasLimit: FHE_GAS })).wait();
        say("✓ Tallied a saver's time-weighted odds.");
      }
      guard = 0;
      while (!(await c.drawComplete()) && guard++ < 60) {
        await (await c.runDraw(1n, { gasLimit: FHE_GAS })).wait();
      }
      say("✓ Winner drawn (encrypted) — collecting is open.");
    });

  const close = () =>
    run("close", async () => {
      const c = new ethers.Contract(POOL, POOL_ABI, signer);
      await (await c.closeRound({ gasLimit: 400_000n })).wait();
      say("✓ Round closed — deposits reopened.");
    });

  const isOwner = !!owner && !!address && owner.toLowerCase() === address.toLowerCase();

  return {
    address,
    signer,
    chainOk,
    connected: !!address,
    phase,
    roundId,
    jackpot,
    count,
    drawComplete,
    isOwner,
    publicTotal,
    myBalance,
    lastWin,
    setLastWin,
    busy,
    log,
    connect,
    faucet,
    deposit,
    revealBalance,
    claim,
    withdraw,
    discloseTotal,
    harvest,
    commit,
    reveal,
    draw,
    close,
    refresh,
  };
}

export type PoolState = ReturnType<typeof usePool>;
