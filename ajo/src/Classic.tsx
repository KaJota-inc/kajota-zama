import { useState } from "react";
import { PoolState, fromUnits } from "./usePool";
import { POOL_ADDRESS, EXPLORER, PHASES } from "./config";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/// The serious, production-credible dApp view.
export function Classic({ p }: { p: PoolState }) {
  const [depositAmt, setDepositAmt] = useState("1000");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  return (
    <>
      <section className="status">
        <div className="stat">
          <span className="k">Round</span>
          <span className="v">#{p.roundId.toString()}</span>
        </div>
        <div className="stat">
          <span className="k">Phase</span>
          <span className={`v phase-${p.phase}`}>{PHASES[p.phase] ?? p.phase}</span>
        </div>
        <div className="stat">
          <span className="k">Jackpot</span>
          <span className="v">{fromUnits(p.jackpot)} cUSDT</span>
        </div>
        <div className="stat">
          <span className="k">Depositors</span>
          <span className="v">{p.count.toString()}</span>
        </div>
        <div className="stat">
          <span className="k">Pool total</span>
          <span className="v">{p.publicTotal === null ? "🔒 encrypted" : `${fromUnits(p.publicTotal)} cUSDT`}</span>
        </div>
      </section>

      {p.connected && (
        <>
          <section className="card">
            <h2>
              <span className="step">1</span> Get test cUSDT
            </h2>
            <p className="hint">Mint 1,000 cUSDT (ERC-7984 confidential token) — public faucet.</p>
            <button className="primary" disabled={!!p.busy} onClick={p.faucet}>
              {p.busy === "faucet" ? "Minting…" : "Mint 1,000 cUSDT"}
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
              <button className="primary" disabled={!!p.busy || p.phase !== 0} onClick={() => p.deposit(Number(depositAmt))}>
                {p.busy === "deposit" ? "Encrypting…" : "Deposit privately"}
              </button>
            </div>
            {p.phase !== 0 && <p className="muted">Deposits are frozen while a draw is in progress.</p>}
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> Your balance & the draw
            </h2>
            <div className="row">
              <button className="ghost" disabled={!!p.busy} onClick={p.revealBalance}>
                {p.busy === "reveal" ? "Decrypting…" : "🔓 Reveal my balance"}
              </button>
              <span className="balance">{p.myBalance === null ? "🔒 encrypted" : `${fromUnits(p.myBalance)} cUSDT`}</span>
            </div>
            <div className="row">
              <button className="primary" disabled={!!p.busy || p.phase !== 2} onClick={p.claim}>
                {p.busy === "claim" ? "Claiming…" : "🎲 Claim this round"}
              </button>
              {p.phase !== 2 && <span className="muted">Claim opens once the round seed is revealed.</span>}
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">4</span> Withdraw (no-loss, any time)
            </h2>
            <div className="row">
              <input value={withdrawAmt} placeholder="amount" onChange={(e) => setWithdrawAmt(e.target.value)} inputMode="decimal" />
              <span className="unit">cUSDT</span>
              <button className="primary" disabled={!!p.busy || !withdrawAmt} onClick={() => p.withdraw(Number(withdrawAmt))}>
                {p.busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
            <p className="muted">Over-withdraw is clamped to your balance — never reverts, never leaks.</p>
          </section>

          {p.isOwner && (
            <section className="card owner">
              <h2>Operator controls</h2>
              <p className="hint">Run a full round in-app — harvest yield → commit → reveal → draw.</p>
              <div className="row">
                <button className="ghost" disabled={!!p.busy || p.phase !== 0} onClick={p.harvest}>
                  {p.busy === "harvest" ? "…" : "1 · Harvest +250"}
                </button>
                <button className="ghost" disabled={!!p.busy || p.phase !== 0} onClick={p.commit}>
                  {p.busy === "commit" ? "…" : "2 · Commit seed"}
                </button>
                <button className="ghost" disabled={!!p.busy || p.phase !== 1} onClick={p.reveal}>
                  {p.busy === "reveal-seed" ? "…" : "3 · Reveal"}
                </button>
                <button className="ghost" disabled={!!p.busy || p.phase !== 2} onClick={p.draw}>
                  {p.busy === "draw" ? "…" : "4 · Run draw"}
                </button>
                <button className="ghost" disabled={!!p.busy} onClick={p.close}>
                  {p.busy === "close" ? "…" : "Close round"}
                </button>
              </div>
              <div className="row">
                <button className="ghost" disabled={!!p.busy} onClick={p.discloseTotal}>
                  Disclose public total
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <section className="logbox">
        <h3>Activity</h3>
        {p.log.length === 0 ? <p className="muted">Connect and deposit to begin.</p> : p.log.map((l, i) => <div key={i} className="line">{l}</div>)}
      </section>

      <footer>
        ERC-7984 · cUSDT · <code>{short(POOL_ADDRESS)}</code> ·{" "}
        <a className="link" href={`${EXPLORER}/address/${POOL_ADDRESS}`} target="_blank" rel="noreferrer">
          contract ↗
        </a>{" "}
        · Zama Developer Program — Season 4
      </footer>
    </>
  );
}
