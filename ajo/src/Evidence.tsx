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

      <footer>Àjọ · Confidential PoolTogether · Zama Developer Program — Season 4</footer>
    </div>
  );
}
