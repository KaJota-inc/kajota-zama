import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { getFhevmInstance, encryptAmount, userDecryptBalance, publicDecrypt } from "./fhevm";
import { CUSDT_ABI, POOL_ABI } from "./abi";
import { POOL_ADDRESS, CUSDT_ADDRESS, SEPOLIA_CHAIN_ID, CUSDT_DECIMALS, EXPLORER, PHASES, PUBLIC_RPC } from "./config";
import { Evidence } from "./Evidence";

const UNIT = 10 ** CUSDT_DECIMALS;
const toUnits = (v: number) => BigInt(Math.round(v * UNIT));
const fromUnits = (v: bigint) => Number(v) / UNIT;
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const FHE_GAS = 6_000_000n;

type Eip1193 = ethers.Eip1193Provider & { on?: (e: string, cb: (...a: unknown[]) => void) => void };

export default function App() {
  // simple hash routing: #evidence → public evidence page
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  if (route === "#evidence") return <Evidence />;

  return <Pool />;
}

function Pool() {
  const [address, setAddress] = useState<string>();
  const [chainOk, setChainOk] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer>();
  const [busy, setBusy] = useState<string>();
  const [log, setLog] = useState<string[]>([]);

  const [phase, setPhase] = useState<number>(0);
  const [roundId, setRoundId] = useState<bigint>(0n);
  const [prize, setPrize] = useState<bigint>(0n);
  const [count, setCount] = useState<bigint>(0n);
  const [owner, setOwner] = useState<string>();
  const [publicTotal, setPublicTotal] = useState<bigint | null>(null);
  const [myBalance, setMyBalance] = useState<bigint | null>(null);

  const [depositAmt, setDepositAmt] = useState("1000");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const say = (m: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 40));

  const provider = useMemo(() => {
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    return eth ? new ethers.BrowserProvider(eth) : null;
  }, []);

  // Always-available read provider (falls back to a public RPC) so the status bar
  // shows live pool state even before a wallet connects.
  const readProvider = useMemo(
    () => provider ?? new ethers.JsonRpcProvider(PUBLIC_RPC),
    [provider],
  );

  const readContracts = useCallback(async () => {
    const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, readProvider);
    try {
      const [ph, rid, pz, ct, ow] = await Promise.all([
        pool.phase(),
        pool.roundId(),
        pool.jackpot(),
        pool.participantsCount(),
        pool.owner(),
      ]);
      setPhase(Number(ph));
      setRoundId(rid);
      setPrize(pz);
      setCount(ct);
      setOwner(ow);
    } catch (e) {
      console.error(e);
    }
  }, [readProvider]);

  useEffect(() => {
    void readContracts();
    const t = setInterval(readContracts, 12_000);
    return () => clearInterval(t);
  }, [readContracts]);

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
        return say("Please switch MetaMask to Sepolia.");
      }
    }
    setChainOk(true);
    const s = await provider.getSigner();
    setSigner(s);
    setAddress(await s.getAddress());
    say("Wallet connected.");
    void readContracts();
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      setBusy(label);
      await fn();
    } catch (e) {
      say(`✗ ${label}: ${(e as Error).message.slice(0, 140)}`);
    } finally {
      setBusy(undefined);
      void readContracts();
    }
  };

  const faucet = () =>
    run("Minting cUSDT", async () => {
      const c = new ethers.Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await c.faucet(toUnits(1000), { gasLimit: 2_000_000n });
      say(`Faucet tx ${short(tx.hash)} …`);
      await tx.wait();
      say("✓ Minted 1,000 cUSDT.");
    });

  const deposit = () =>
    run("Depositing", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, CUSDT_ADDRESS, address!, toUnits(Number(depositAmt)));
      const c = new ethers.Contract(CUSDT_ADDRESS, CUSDT_ABI, signer);
      const tx = await c["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        POOL_ADDRESS,
        handle,
        proof,
        "0x",
        { gasLimit: FHE_GAS },
      );
      say(`Deposit tx ${short(tx.hash)} …`);
      await tx.wait();
      say(`✓ Deposited ${depositAmt} cUSDT (encrypted).`);
    });

  const revealBalance = () =>
    run("Decrypting balance", async () => {
      const inst = await getFhevmInstance();
      const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
      const handle = await pool.balanceOf(address);
      const clear = await userDecryptBalance(inst, signer!, POOL_ADDRESS, handle);
      setMyBalance(clear);
      say(`✓ Your balance: ${fromUnits(clear)} cUSDT (decrypted just for you).`);
    });

  const claim = () =>
    run("Claiming", async () => {
      const c = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
      const tx = await c.claim({ gasLimit: FHE_GAS });
      say(`Claim tx ${short(tx.hash)} … (encrypted winner check)`);
      await tx.wait();
      say("✓ Claim settled. Reveal your balance to see if you won.");
    });

  const withdraw = () =>
    run("Withdrawing", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, POOL_ADDRESS, address!, toUnits(Number(withdrawAmt || "0")));
      const c = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
      const tx = await c.withdraw(handle, proof, { gasLimit: FHE_GAS });
      say(`Withdraw tx ${short(tx.hash)} …`);
      await tx.wait();
      say(`✓ Withdrew up to ${withdrawAmt} cUSDT (clamped to your balance).`);
    });

  const discloseTotal = () =>
    run("Disclosing total", async () => {
      const c = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
      const tx = await c.disclosePublicTotal({ gasLimit: 500_000n });
      await tx.wait();
      const inst = await getFhevmInstance();
      const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
      const t = await publicDecrypt(inst, await pool.totalPooled());
      setPublicTotal(t);
      say(`✓ Public pool total: ${t === null ? "—" : fromUnits(t)} cUSDT.`);
    });

  const isOwner = owner && address && owner.toLowerCase() === address.toLowerCase();

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1>
            À<span className="accent">jọ</span>
          </h1>
          <span className="pill">Confidential PoolTogether</span>
        </div>
        <p className="sub">
          A no-loss prize-savings pool on <b>Zama FHEVM</b>. Deposit confidential <b>cUSDT</b>; balances and winnings stay
          encrypted on-chain. Each round a public seed picks a winner <i>weighted by your encrypted deposit</i> — provably
          fair, yet nobody sees your balance. Digital <i>esusu</i>.
        </p>
        <nav>
          {address ? (
            <span className="acct">
              <span className="dot" /> {short(address)} · Sepolia
            </span>
          ) : (
            <button className="primary" onClick={connect}>
              Connect Wallet
            </button>
          )}
          <a className="link" href="#evidence">
            Evidence ↗
          </a>
        </nav>
        {!chainOk && <div className="warn">Wrong network — switch MetaMask to Sepolia.</div>}
      </header>

      <section className="status">
        <div className="stat">
          <span className="k">Round</span>
          <span className="v">#{roundId.toString()}</span>
        </div>
        <div className="stat">
          <span className="k">Phase</span>
          <span className={`v phase-${phase}`}>{PHASES[phase] ?? phase}</span>
        </div>
        <div className="stat">
          <span className="k">Jackpot</span>
          <span className="v">{fromUnits(prize)} cUSDT</span>
        </div>
        <div className="stat">
          <span className="k">Depositors</span>
          <span className="v">{count.toString()}</span>
        </div>
        <div className="stat">
          <span className="k">Pool total</span>
          <span className="v">{publicTotal === null ? "🔒 encrypted" : `${fromUnits(publicTotal)} cUSDT`}</span>
        </div>
      </section>

      {address && (
        <>
          <section className="card">
            <h2>
              <span className="step">1</span> Get test cUSDT
            </h2>
            <p className="hint">Mint 1,000 cUSDT (ERC-7984 confidential token) to your wallet — public faucet.</p>
            <button className="primary" disabled={!!busy} onClick={faucet}>
              {busy === "Minting cUSDT" ? "Minting…" : "Mint 1,000 cUSDT"}
            </button>
          </section>

          <section className="card">
            <h2>
              <span className="step">2</span> Deposit into the pool
            </h2>
            <p className="hint">Your amount is encrypted in-browser before it ever leaves this page.</p>
            <div className="row">
              <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} inputMode="decimal" />
              <span className="unit">cUSDT</span>
              <button className="primary" disabled={!!busy || phase !== 0} onClick={deposit}>
                {busy === "Depositing" ? "Encrypting…" : "Deposit privately"}
              </button>
            </div>
            {phase !== 0 && <p className="muted">Deposits are frozen while a draw is in progress.</p>}
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> Your balance & the draw
            </h2>
            <div className="row">
              <button className="ghost" disabled={!!busy} onClick={revealBalance}>
                {busy === "Decrypting balance" ? "Decrypting…" : "🔓 Reveal my balance"}
              </button>
              <span className="balance">
                {myBalance === null ? "🔒 encrypted" : `${fromUnits(myBalance)} cUSDT`}
              </span>
            </div>
            <div className="row">
              <button className="primary" disabled={!!busy || phase !== 2} onClick={claim}>
                {busy === "Claiming" ? "Claiming…" : "🎲 Claim this round"}
              </button>
              {phase !== 2 && <span className="muted">Claim opens once the round seed is revealed.</span>}
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">4</span> Withdraw (no-loss, any time)
            </h2>
            <div className="row">
              <input
                value={withdrawAmt}
                placeholder="amount"
                onChange={(e) => setWithdrawAmt(e.target.value)}
                inputMode="decimal"
              />
              <span className="unit">cUSDT</span>
              <button className="primary" disabled={!!busy || !withdrawAmt} onClick={withdraw}>
                {busy === "Withdrawing" ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
            <p className="muted">Over-withdraw is clamped to your balance — never reverts, never leaks.</p>
          </section>

          {isOwner && (
            <section className="card owner">
              <h2>Operator controls</h2>
              <p className="hint">You are the pool operator — run a draw for the demo.</p>
              <button className="ghost" disabled={!!busy} onClick={discloseTotal}>
                Disclose public pool total
              </button>
              <p className="muted">Commit / reveal a round via the CLI script for a full draw.</p>
            </section>
          )}
        </>
      )}

      <section className="logbox">
        <h3>Activity</h3>
        {log.length === 0 ? <p className="muted">Connect and deposit to begin.</p> : log.map((l, i) => <div key={i} className="line">{l}</div>)}
      </section>

      <footer>
        ERC-7984 · cUSDT · <code>{short(POOL_ADDRESS)}</code> ·{" "}
        <a className="link" href={`${EXPLORER}/address/${POOL_ADDRESS}`} target="_blank" rel="noreferrer">
          contract ↗
        </a>{" "}
        · Zama Developer Program — Season 4
      </footer>
    </div>
  );
}
