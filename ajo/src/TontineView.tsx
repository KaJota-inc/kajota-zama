import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useMechanism, fromUnits, toUnits } from "./useMechanism";
import { Tontine3D } from "./Tontine3D";
import { TONTINE_ABI } from "./abi";
import { TONTINE_ADDRESS, EXPLORER } from "./config";

// Interactive survivorship tontine (Lorenzo de Tonti, 1653). Yield splits equally among the current
// survivors; as members exit, each remaining share grows. Principal stays encrypted.
export function TontineView() {
  const m = useMechanism(TONTINE_ADDRESS, TONTINE_ABI);
  const [s, setS] = useState<{ active: bigint; acc: bigint; dist: bigint; members: bigint; owner: string } | null>(null);
  const [mine, setMine] = useState<{ active: boolean; pending: bigint } | null>(null);
  const [wd, setWd] = useState("");
  const [mode, setMode] = useState<"overview" | "3d">("overview");

  useEffect(() => {
    (async () => {
      try {
        const [active, acc, dist, members, owner] = await Promise.all([
          m.read.activeCount(),
          m.read.accDividend(),
          m.read.totalDistributed(),
          m.read.membersCount(),
          m.read.owner(),
        ]);
        setS({ active, acc, dist, members, owner: String(owner) });
        if (m.address) {
          const [act, pend] = await Promise.all([m.read.active(m.address), m.read.pendingDividend(m.address)]);
          setMine({ active: Boolean(act), pending: pend });
        }
      } catch {
        /* rpc */
      }
    })();
  }, [m.read, m.tick, m.address]);

  const isOwner = !!(s && m.address && s.owner.toLowerCase() === m.address.toLowerCase());
  const host = (label: string, fn: () => Promise<ethers.ContractTransactionResponse>) =>
    m.run(label, async () => {
      const tx = await fn();
      await tx.wait();
      m.say(`✓ ${label} done.`);
    });
  const bank = () => host("syncDividend", () => m.write!.syncDividend({ gasLimit: 1_000_000n }));
  const leave = () => host("exit", () => m.write!.exit({ gasLimit: 1_000_000n }));

  return (
    <>
      <div className="mech-head">
        <div className="toggle sm">
          <button className={mode === "overview" ? "on" : ""} onClick={() => setMode("overview")}>
            Overview
          </button>
          <button className={mode === "3d" ? "on" : ""} onClick={() => setMode("3d")}>
            3D survivors
          </button>
        </div>
      </div>

      {mode === "3d" ? (
        <div className="mech-3d-wrap">
          <Tontine3D activeCount={Number(s?.active ?? 0n)} members={Number(s?.members ?? 0n)} acc={s?.acc ?? 0n} />
          <div className="mech-3d-hud">
            {!m.connected ? (
              <button className="primary" onClick={m.connect}>
                Connect wallet
              </button>
            ) : (
              <>
                <button className="ghost sm" disabled={!!m.busy} onClick={m.faucet}>
                  {m.busy === "faucet" ? "…" : "Get coins"}
                </button>
                <button className="ghost sm" disabled={!!m.busy} onClick={() => m.deposit(1000)}>
                  {m.busy === "deposit" ? "…" : "Join (1,000)"}
                </button>
                <button className="gold sm" disabled={!!m.busy || !mine?.active} onClick={bank}>
                  {m.busy === "syncDividend" ? "…" : "💰 Bank dividend"}
                </button>
                <button className="ghost sm" disabled={!!m.busy || !mine?.active} onClick={leave}>
                  {m.busy === "exit" ? "…" : "🚪 Leave"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <section className="intro">
          <div className="intro-points">
            <div>
              <span className="ip-ico">👥</span>
              <b>Share the yield</b>
              <span>Everyone active splits the pooled yield equally, round after round.</span>
            </div>
            <div>
              <span className="ip-ico">📈</span>
              <b>Survivors earn more</b>
              <span>Each time a member leaves, the remaining share grows — patience compounds.</span>
            </div>
            <div>
              <span className="ip-ico">🔒</span>
              <b>Private principal</b>
              <span>Your balance stays encrypted; only the fair per-survivor rate is public.</span>
            </div>
          </div>
        </section>
      )}

      <details className="card howto" open>
        <summary>
          <span className="host-title">How the tontine works</span>
          <span className="host-sub">in plain words</span>
        </summary>
        <ol className="howto-steps">
          <li>
            <b>You join a pool.</b> Add coins and you’re a “survivor.” Your balance stays encrypted — private to you.
          </li>
          <li>
            <b>The yield is shared out.</b> Every payout is split equally among the survivors, round after round.
          </li>
          <li>
            <b>Leavers boost the rest.</b> When someone exits, they stop getting paid — so the same yield is split among
            fewer people, and each survivor’s share <i>grows</i>.
          </li>
          <li>
            <b>Patience compounds.</b> The longer you stay, the bigger your slice becomes. Your money is always yours to
            withdraw.
          </li>
        </ol>
        <p className="muted">
          It’s the opposite of a lottery: nobody “wins” a jackpot — the reward is simply staying in while others leave.
        </p>
      </details>

      <section className="status">
        <div className="stat">
          <span className="k">Survivors</span>
          <span className="v">{s ? `${s.active}` : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Dividend / survivor</span>
          <span className="v">{s ? `${fromUnits(s.acc)} coins` : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Total paid out</span>
          <span className="v">{s ? `${fromUnits(s.dist)} coins` : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">You</span>
          <span className="v">{mine ? (mine.active ? "in the pool" : "—") : "…"}</span>
        </div>
      </section>

      {!m.connected ? (
        <section className="card connect-card">
          <h2>Try the tontine</h2>
          <p className="hint">Connect a wallet — free test coins, test network, nothing real at stake.</p>
          <button className="primary big" onClick={m.connect}>
            Connect wallet
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>
              <span className="step">1</span> Get coins & join
            </h2>
            <p className="hint">Add coins to join the tontine — you become a survivor and start earning dividends.</p>
            <div className="row">
              <button className="ghost" disabled={!!m.busy} onClick={m.faucet}>
                {m.busy === "faucet" ? "Getting…" : "Get 1,000 free coins"}
              </button>
              <button className="primary" disabled={!!m.busy} onClick={() => m.deposit(1000)}>
                {m.busy === "deposit" ? "Joining…" : "Join with 1,000"}
              </button>
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">2</span> Your dividend & balance
            </h2>
            <p className="hint">
              Your accrued survivor dividend: <b>{mine ? `${fromUnits(mine.pending)} coins` : "…"}</b>. Fold it into your
              (private) balance, then reveal.
            </p>
            <div className="row">
              <button className="primary" disabled={!!m.busy || !mine?.active} onClick={() => host("syncDividend", () => m.write!.syncDividend({ gasLimit: 1_000_000n }))}>
                {m.busy === "syncDividend" ? "Banking…" : "💰 Bank my dividend"}
              </button>
              <button className="ghost" disabled={!!m.busy} onClick={m.revealBalance}>
                {m.busy === "reveal" ? "Checking…" : "🔓 Show my balance"}
              </button>
              <span className="balance">{m.myBalance === null ? "🔒 hidden" : `${fromUnits(m.myBalance)} coins`}</span>
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> Leave, or take money out
            </h2>
            <p className="hint">Exit stops your future dividends (the survivors’ share grows). Your money is always yours.</p>
            <div className="row">
              <button className="ghost" disabled={!!m.busy || !mine?.active} onClick={() => host("exit", () => m.write!.exit({ gasLimit: 1_000_000n }))}>
                {m.busy === "exit" ? "Leaving…" : "🚪 Leave the tontine"}
              </button>
              <input value={wd} placeholder="how much?" onChange={(e) => setWd(e.target.value)} inputMode="decimal" />
              <span className="unit">coins</span>
              <button className="primary" disabled={!!m.busy || !wd} onClick={() => m.withdraw(Number(wd))}>
                {m.busy === "withdraw" ? "Sending…" : "Take out"}
              </button>
            </div>
          </section>

          {isOwner && (
            <details className="card host" open>
              <summary>
                <span className="host-title">👥 Host controls — pay a dividend</span>
                <span className="host-sub">you’re the host of this pool</span>
              </summary>
              <p className="hint">Pay yield to the survivors. Watch the per-survivor amount grow as members leave.</p>
              <div className="row">
                <button className="ghost" disabled={!!m.busy || !s || s.active === 0n} onClick={() => host("payDividend", () => m.write!.payDividend(toUnits(300), { gasLimit: 2_500_000n }))}>
                  Pay a 300-coin dividend
                </button>
              </div>
            </details>
          )}
        </>
      )}

      <section className="logbox">
        <h3>Activity</h3>
        {m.log.length === 0 ? <p className="muted">Your actions will show up here.</p> : m.log.map((l, i) => <div key={i} className="line">{l}</div>)}
      </section>

      <footer>
        Survivorship tontine · <a className="link" href={`${EXPLORER}/address/${TONTINE_ADDRESS}`} target="_blank" rel="noreferrer">see the contract ↗</a> · <a className="link" href="#mechanisms">← all three mechanisms</a>
      </footer>
    </>
  );
}
