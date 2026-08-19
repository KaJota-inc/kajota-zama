import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { POOL_ABI } from "./abi";
import { POOL_ADDRESS, CUSDT_ADDRESS, EXPLORER, PHASES, PROOFS } from "./config";

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
          <span className="pill">Evidence</span>
        </div>
        <p className="sub">
          Everything here is live on <b>Sepolia</b> and verifiable without trusting us — no login, no wallet. Click any
          hash to open Etherscan.
        </p>
        <nav>
          <a className="link" href="#">
            ← Back to app
          </a>
        </nav>
      </header>

      <section className="status">
        <div className="stat">
          <span className="k">Live round</span>
          <span className="v">#{state?.round ?? "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Phase</span>
          <span className="v">{state ? (PHASES[state.phase] ?? state.phase) : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Jackpot</span>
          <span className="v">{state?.prize ?? "…"} cUSDT</span>
        </div>
        <div className="stat">
          <span className="k">Depositors</span>
          <span className="v">{state?.count ?? "…"}</span>
        </div>
      </section>

      <section className="card">
        <h2>Verified contracts</h2>
        <div className="evrow">
          <span>ConfidentialPool (Àjọ)</span>
          <a className="link" href={`${EXPLORER}/address/${POOL_ADDRESS}`} target="_blank" rel="noreferrer">
            {short(POOL_ADDRESS)} ↗
          </a>
        </div>
        <div className="evrow">
          <span>ConfidentialUSDT (cUSDT · ERC-7984)</span>
          <a className="link" href={`${EXPLORER}/address/${CUSDT_ADDRESS}`} target="_blank" rel="noreferrer">
            {short(CUSDT_ADDRESS)} ↗
          </a>
        </div>
      </section>

      <section className="card">
        <h2>On-chain proof trail — no mocked data</h2>
        <p className="hint">The full deposit → commit → reveal → claim → withdraw lifecycle, executed on Sepolia.</p>
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
          ...mk(dep, (e) => `Deposit by ${short(String(arg(e, 0)))}`),
          ...mk(yld, (e) => `Yield harvested +${Number(arg(e, 0)) / 1e6} cUSDT → jackpot ${Number(arg(e, 1)) / 1e6}`),
          ...mk(rev, (e) => `Round #${arg(e, 0)} drawn — seed revealed (public randomness)`),
          ...mk(clm, (e) => `Claim by ${short(String(arg(e, 1)))} (round #${arg(e, 0)})`),
          ...mk(wd, (e) => `Withdraw by ${short(String(arg(e, 0)))}`),
          ...mk(cls, (e) => `Round #${arg(e, 0)} closed`),
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
      <h2>Live on-chain activity</h2>
      {stats && (
        <div className="status" style={{ margin: "6px 0 14px" }}>
          <div className="stat">
            <span className="k">Rounds drawn</span>
            <span className="v">{stats.rounds}</span>
          </div>
          <div className="stat">
            <span className="k">Deposits</span>
            <span className="v">{stats.deposits}</span>
          </div>
          <div className="stat">
            <span className="k">Yield harvested</span>
            <span className="v">{stats.yield} cUSDT</span>
          </div>
        </div>
      )}
      {events === null ? (
        <p className="muted">Reading events…</p>
      ) : events.length === 0 ? (
        <p className="muted">No recent events.</p>
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
    <section className="card">
      <h2>Verify a draw yourself</h2>
      <p className="hint">
        The draw's randomness is public. Paste a round and its revealed seed; recompute the commitment and the winning
        ticket's random `r` — the same values the contract used. No trust required.
      </p>
      <div className="row">
        <input style={{ width: 80 }} value={round} onChange={(e) => setRound(e.target.value)} placeholder="round" />
        <input
          style={{ width: 320, maxWidth: "100%" }}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="revealed seed 0x…"
        />
        <button className="primary" onClick={compute}>
          Recompute
        </button>
      </div>
      {err && <p className="muted" style={{ color: "var(--warn)" }}>{err}</p>}
      {out && (
        <div style={{ marginTop: 10, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
          <div className="evrow">
            <span>commitment = keccak256(seed)</span>
            <code>{out.commitment.slice(0, 14)}…{out.commitment.slice(-8)}</code>
          </div>
          <div className="evrow">
            <span>public r = uint64(keccak256(roundId, seed))</span>
            <code>{out.r}</code>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            The contract derives the winning ticket <code>target = (r · drawTotal) / 2^64</code> from this exact{" "}
            <code>r</code>, then finds the one encrypted balance interval containing it — over ciphertext, no decryption.
            Check <code>commitment</code> against the pool's <code>seedCommitment</code> to confirm the seed wasn't swapped.
          </p>
        </div>
      )}
    </section>
  );
}
