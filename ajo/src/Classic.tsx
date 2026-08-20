import { useState } from "react";
import { PoolState, fromUnits } from "./usePool";
import { POOL_ADDRESS, EXPLORER } from "./config";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

// Plain-language status for the current round, so a first-timer isn't reading "Committed / Revealed".
const STATUS = ["Open for savings", "Picking a winner…", "Winner picked — collect"];

/// The main view — written for someone who has never used a crypto app.
export function Classic({ p }: { p: PoolState }) {
  const [depositAmt, setDepositAmt] = useState("1000");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  return (
    <>
      {/* One glance: what is this? */}
      <section className="intro">
        <div className="intro-points">
          <div>
            <span className="ip-ico">💰</span>
            <b>Never lose it</b>
            <span>Only the prize is at stake — your savings are always yours to withdraw.</span>
          </div>
          <div>
            <span className="ip-ico">🎁</span>
            <b>Someone wins</b>
            <span>Each round a public, checkable draw picks one winner. Bigger savings, better odds.</span>
          </div>
          <div>
            <span className="ip-ico">🔒</span>
            <b>Stays private</b>
            <span>Nobody can see your balance — not other savers, not us. Only you can reveal it.</span>
          </div>
        </div>
      </section>

      <section className="status">
        <div className="stat">
          <span className="k">Prize pot</span>
          <span className="v">{fromUnits(p.jackpot)} coins</span>
        </div>
        <div className="stat">
          <span className="k">This round</span>
          <span className={`v phase-${p.phase}`}>{STATUS[p.phase] ?? `#${p.roundId}`}</span>
        </div>
        <div className="stat">
          <span className="k">Savers</span>
          <span className="v">{p.count.toString()}</span>
        </div>
        <div className="stat">
          <span className="k">Total saved</span>
          <span className="v">{p.publicTotal === null ? "🔒 private" : `${fromUnits(p.publicTotal)} coins`}</span>
        </div>
      </section>

      {!p.connected ? (
        <section className="card connect-card">
          <h2>Ready to try it?</h2>
          <p className="hint">
            Connect a crypto wallet to start. It’s all <b>free test money</b> on a test network — nothing here is real,
            so you can’t lose anything.
          </p>
          <button className="primary big" onClick={p.connect}>
            Connect wallet
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>
              <span className="step">1</span> Get some coins to play with
            </h2>
            <p className="hint">Free practice coins (test money — not real). Grab 1,000 to get started.</p>
            <button className="primary" disabled={!!p.busy} onClick={p.faucet}>
              {p.busy === "faucet" ? "Getting coins…" : "Get 1,000 free coins"}
            </button>
          </section>

          <section className="card">
            <h2>
              <span className="step">2</span> Add coins to the pool
            </h2>
            <p className="hint">This is your savings. The amount you add is hidden — nobody can see it but you.</p>
            <div className="row">
              <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} inputMode="decimal" />
              <span className="unit">coins</span>
              <button className="primary" disabled={!!p.busy || p.phase !== 0} onClick={() => p.deposit(Number(depositAmt))}>
                {p.busy === "deposit" ? "Adding privately…" : "Add to the pool"}
              </button>
            </div>
            {p.phase !== 0 && <p className="muted">Adding is paused while this round’s winner is being picked.</p>}
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> Your balance & winnings
            </h2>
            <p className="hint">Your balance is hidden by default. Reveal it privately — you’ll approve a quick “it’s me” signature.</p>
            <div className="row">
              <button className="ghost" disabled={!!p.busy} onClick={p.revealBalance}>
                {p.busy === "reveal" ? "Checking…" : "🔓 Show my balance"}
              </button>
              <span className="balance">{p.myBalance === null ? "🔒 hidden" : `${fromUnits(p.myBalance)} coins`}</span>
            </div>
            <div className="row">
              <button className="primary" disabled={!!p.busy || p.phase !== 2 || !p.drawComplete} onClick={p.claim}>
                {p.busy === "claim" ? "Collecting…" : "🎁 Collect my winnings"}
              </button>
              {!(p.phase === 2 && p.drawComplete) && (
                <span className="muted">This lights up once the host has drawn a winner (Host controls → “Pick winner”).</span>
              )}
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">4</span> Take your money out — any time
            </h2>
            <p className="hint">Your savings are always yours. Take out any amount, whenever you like.</p>
            <div className="row">
              <input value={withdrawAmt} placeholder="how much?" onChange={(e) => setWithdrawAmt(e.target.value)} inputMode="decimal" />
              <span className="unit">coins</span>
              <button className="primary" disabled={!!p.busy || !withdrawAmt} onClick={() => p.withdraw(Number(withdrawAmt))}>
                {p.busy === "withdraw" ? "Sending…" : "Take out"}
              </button>
            </div>
            <p className="muted">Ask for more than you have and it just gives you your balance — it never errors, never leaks the number.</p>
          </section>

          {!p.isOwner && (
            <section className="card">
              <h2>
                <span className="step">🎲</span> Run the draw (the spin)
              </h2>
              <p className="hint">
                Only a circle’s <b>host</b> runs the draw — and you’re a saver here, not the host of this pool. To spin
                one yourself, open <b>Circles</b> (top) → <b>＋ Create a circle</b>. You become the host, and the draw
                controls appear right here.
              </p>
            </section>
          )}

          {p.isOwner && (
            <details className="card host" open>
              <summary>
                <span className="host-title">🎲 Run the draw (the spin)</span>
                <span className="host-sub">you’re the host of this circle</span>
              </summary>
              <p className="hint">
                Normally a keeper does this automatically each round. For a live demo you can step a full draw by hand:
                add a prize from yield, lock in a secret, reveal it, then pick the winner.
              </p>
              <div className="row">
                <button className="ghost" disabled={!!p.busy || p.phase !== 0} onClick={p.harvest}>
                  {p.busy === "harvest" ? "…" : "1 · Add prize (+250)"}
                </button>
                <button className="ghost" disabled={!!p.busy || p.phase !== 0} onClick={p.commit}>
                  {p.busy === "commit" ? "…" : "2 · Lock in secret"}
                </button>
                <button className="ghost" disabled={!!p.busy || p.phase !== 1} onClick={p.reveal}>
                  {p.busy === "reveal-seed" ? "…" : "3 · Reveal secret"}
                </button>
                <button className="ghost" disabled={!!p.busy || p.phase !== 2} onClick={p.draw}>
                  {p.busy === "draw" ? "…" : "4 · Pick winner (the spin)"}
                </button>
                <button className="ghost" disabled={!!p.busy} onClick={p.close}>
                  {p.busy === "close" ? "…" : "Start next round"}
                </button>
              </div>
              <div className="row">
                <button className="ghost" disabled={!!p.busy} onClick={p.discloseTotal}>
                  Publish the total saved
                </button>
              </div>
            </details>
          )}
        </>
      )}

      <section className="logbox">
        <h3>Activity</h3>
        {p.log.length === 0 ? (
          <p className="muted">Your actions will show up here.</p>
        ) : (
          p.log.map((l, i) => (
            <div key={i} className="line">
              {l}
            </div>
          ))
        )}
      </section>

      <footer>
        Runs on <b>Zama</b> confidential blockchain tech · test network ·{" "}
        <a className="link" href={`${EXPLORER}/address/${POOL_ADDRESS}`} target="_blank" rel="noreferrer">
          see the contract ↗
        </a>{" "}
        · <code>{short(POOL_ADDRESS)}</code>
      </footer>
    </>
  );
}
