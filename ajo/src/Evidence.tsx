import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { POOL_ABI } from "./abi";
import { POOL_ADDRESS, CUSDT_ADDRESS, EXPLORER, STATUS, PROOFS } from "./config";

// Read-only public RPC — no wallet required. This page is the "verify it yourself" surface.
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export function Evidence() {
  const [state, setState] = useState<{ phase: number; round: string; prize: string; count: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = new ethers.JsonRpcProvider(RPC);
        const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, p);
        const [ph, rid, pz, ct] = await Promise.all([
          pool.phase(),
          pool.roundId(),
          pool.jackpot(),
          pool.participantsCount(),
        ]);
        setState({
          phase: Number(ph),
          round: rid.toString(),
          prize: (Number(pz) / 1e6).toString(),
          count: ct.toString(),
        });
      } catch {
        setState(null);
      }
    })();
  }, []);

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1>
            À<span className="accent">jọ</span>
          </h1>
          <span className="pill">Proof</span>
        </div>
        <p className="sub">
          Everything below is <b>really happening</b> on a public blockchain — you don’t need an account, a wallet, or
          to trust us. Tap any code to see it for yourself on the public ledger.
        </p>
        <nav>
          <a className="link" href="#">
            ← Back to app
          </a>
        </nav>
      </header>

      <section className="status">
        <div className="stat">
          <span className="k">This round</span>
          <span className="v">#{state?.round ?? "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Status</span>
          <span className="v">{state ? (STATUS[state.phase] ?? `#${state.phase}`) : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Prize pot</span>
          <span className="v">{state?.prize ?? "…"} coins</span>
        </div>
        <div className="stat">
          <span className="k">Savers</span>
          <span className="v">{state?.count ?? "…"}</span>
        </div>
      </section>

      <section className="card">
        <h2>The programs behind it</h2>
        <p className="hint">The two pieces of software that run Àjọ — public and checkable by anyone.</p>
        <div className="evrow">
          <span>The savings pool</span>
          <a className="link" href={`${EXPLORER}/address/${POOL_ADDRESS}`} target="_blank" rel="noreferrer">
            {short(POOL_ADDRESS)} ↗
          </a>
        </div>
        <div className="evrow">
          <span>The coin (cUSDT)</span>
          <a className="link" href={`${EXPLORER}/address/${CUSDT_ADDRESS}`} target="_blank" rel="noreferrer">
            {short(CUSDT_ADDRESS)} ↗
          </a>
        </div>
      </section>

      <section className="card">
        <h2>Every step really happened</h2>
        <p className="hint">A whole round — from adding coins to picking a winner to cashing out — recorded on the blockchain. Nothing here is faked.</p>
        <ol className="proofs">
          {PROOFS.map((pr) => (
            <li key={pr.txHash}>
              <span>{pr.step}</span>
              <a className="link" href={`${EXPLORER}/tx/${pr.txHash}`} target="_blank" rel="noreferrer">
                {short(pr.txHash)} ↗
              </a>
            </li>
          ))}
        </ol>
      </section>

      <LiveActivity />

      <DrawVerifier />

      <footer>Àjọ · Confidential PoolTogether · Zama Developer Program — Season 4</footer>
    </div>
  );
}

type Ev = { block: number; tx: string; label: string };

// Live on-chain activity + round stats, read straight from contract events over the public RPC.
function LiveActivity() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [stats, setStats] = useState<{ rounds: number; deposits: number; yield: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = new ethers.JsonRpcProvider(RPC);
        const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, p);
        const latest = await p.getBlockNumber();
        const from = Math.max(0, latest - 20000);
        const [dep, yld, rev, clm, wd, cls] = await Promise.all([
          pool.queryFilter("Deposited", from, latest),
          pool.queryFilter("YieldHarvested", from, latest),
          pool.queryFilter("RoundRevealed", from, latest),
          pool.queryFilter("Claimed", from, latest),
          pool.queryFilter("Withdrawn", from, latest),
          pool.queryFilter("RoundClosed", from, latest),
        ]);
        const arg = (e: ethers.Log | ethers.EventLog, i: number) =>
          "args" in e ? (e as ethers.EventLog).args[i] : undefined;
        const mk = (list: (ethers.Log | ethers.EventLog)[], label: (e: ethers.Log | ethers.EventLog) => string): Ev[] =>
          list.map((e) => ({ block: e.blockNumber, tx: e.transactionHash, label: label(e) }));

        const all: Ev[] = [
          ...mk(dep, (e) => `${short(String(arg(e, 0)))} added coins`),
          ...mk(yld, (e) => `Prize money added +${Number(arg(e, 0)) / 1e6} → pot now ${Number(arg(e, 1)) / 1e6}`),
          ...mk(rev, (e) => `Round #${arg(e, 0)} — winner drawn (public randomness)`),
          ...mk(clm, (e) => `${short(String(arg(e, 1)))} collected winnings (round #${arg(e, 0)})`),
          ...mk(wd, (e) => `${short(String(arg(e, 0)))} took money out`),
          ...mk(cls, (e) => `Round #${arg(e, 0)} ended`),
        ].sort((a, b) => b.block - a.block);

        const totalYield = yld.reduce((s, e) => s + Number(("args" in e ? (e as ethers.EventLog).args[0] : 0)) / 1e6, 0);
        setStats({ rounds: rev.length, deposits: dep.length, yield: totalYield });
        setEvents(all.slice(0, 18));
      } catch {
        setEvents([]);
      }
    })();
  }, []);

  return (
    <section className="card">
      <h2>What’s been happening</h2>
      {stats && (
        <div className="status" style={{ margin: "6px 0 14px" }}>
          <div className="stat">
            <span className="k">Winners drawn</span>
            <span className="v">{stats.rounds}</span>
          </div>
          <div className="stat">
            <span className="k">Deposits</span>
            <span className="v">{stats.deposits}</span>
          </div>
          <div className="stat">
            <span className="k">Prize money added</span>
            <span className="v">{stats.yield} coins</span>
          </div>
        </div>
      )}
      {events === null ? (
        <p className="muted">Reading the blockchain…</p>
      ) : events.length === 0 ? (
        <p className="muted">Nothing recent to show.</p>
      ) : (
        events.map((e, i) => (
          <div key={i} className="evrow">
            <span>{e.label}</span>
            <a className="link" href={`${EXPLORER}/tx/${e.tx}`} target="_blank" rel="noreferrer">
              {short(e.tx)} ↗
            </a>
          </div>
        ))
      )}
    </section>
  );
}

// Anyone can recompute the draw's public randomness from (roundId, seed) — the whole point
// of "publicly verifiable". Paste the round and the revealed seed (from the revealSeed tx).
function DrawVerifier() {
  const [round, setRound] = useState("0");
  const [seed, setSeed] = useState("");
  const [out, setOut] = useState<{ commitment: string; r: string } | null>(null);
  const [err, setErr] = useState("");

  const compute = () => {
    setErr("");
    setOut(null);
    try {
      const s = seed.trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(s)) throw new Error("seed must be a 32-byte hex value (0x…64 hex chars)");
      const commitment = ethers.keccak256(s); // must equal the on-chain seedCommitment
      const full = BigInt(ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [BigInt(round), s])));
      const r = full & ((1n << 64n) - 1n); // uint64(uint256(keccak(roundId, seed)))
      setOut({ commitment, r: r.toString() });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <details className="card host">
      <summary>
        <span className="host-title">Check the draw was fair — yourself</span>
        <span className="host-sub">optional · for the curious</span>
      </summary>
      <p className="hint">
        The draw uses a <b>public random number</b>, so anyone can redo the math and confirm nobody rigged it. Paste a
        round number and the secret that was revealed for it — we’ll recompute the exact numbers the program used. If
        they match what’s on the blockchain, the draw was honest.
      </p>
      <div className="row">
        <input style={{ width: 80 }} value={round} onChange={(e) => setRound(e.target.value)} placeholder="round" />
        <input
          style={{ width: 320, maxWidth: "100%" }}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="revealed secret 0x…"
        />
        <button className="primary" onClick={compute}>
          Check
        </button>
      </div>
      {err && <p className="muted" style={{ color: "var(--warn)" }}>{err}</p>}
      {out && (
        <div style={{ marginTop: 10, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
          <div className="evrow">
            <span>Fingerprint of the secret</span>
            <code>{out.commitment.slice(0, 14)}…{out.commitment.slice(-8)}</code>
          </div>
          <div className="evrow">
            <span>The draw’s random number</span>
            <code>{out.r}</code>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            The program turns this exact random number into the winning ticket and finds whose savings it lands on —
            without ever unlocking anyone’s balance. Match the fingerprint above against the one stored on-chain to prove
            the secret wasn’t swapped after the fact.{" "}
            <span className="dim">(For developers: <code>r = uint64(keccak256(roundId, seed))</code>, <code>target = (r · drawTotal) / 2^64</code>.)</span>
          </p>
        </div>
      )}
    </details>
  );
}
