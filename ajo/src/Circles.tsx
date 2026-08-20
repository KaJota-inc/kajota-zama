import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ORACLE_ADDRESS, PUBLIC_RPC, STATUS, CUSDT_DECIMALS, EXPLORER } from "./config";
import { POOL_ABI, ORACLE_ABI } from "./abi";
import { allCircles, addUserCircle, type Circle } from "./circleStore";
import { deployCircle } from "./createCircle";
import { Circles3D } from "./Circles3D";

const idOf = (a: string) => ethers.solidityPackedKeccak256(["address"], [a]);
const fmt = (v: bigint) => (Number(v) / 10 ** CUSDT_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });

type CircleState = {
  phase: number;
  round: bigint;
  jackpot: bigint;
  depositors: bigint;
  flags: number;
  loaded: boolean;
};

type Props = {
  current: string;
  onEnter: (addr: string) => void;
  onDive: (addr: string) => void;
  connected: boolean;
  connect: () => void;
  signer?: ethers.Signer;
  address?: string;
};

// The directory: Àjọ as a platform of confidential esusu circles, each rated by the shared trust
// circle (the FraudOracle). Anyone can browse live; a connected saver can launch their own.
export function Circles({ current, onEnter, onDive, connected, connect, signer, address }: Props) {
  const [circles, setCircles] = useState<Circle[]>(() => allCircles());
  const [state, setState] = useState<Record<string, CircleState>>({});
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"grid" | "galaxy">("grid");

  useEffect(() => {
    let alive = true;
    const rp = new ethers.JsonRpcProvider(PUBLIC_RPC);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, rp);
    const load = async () => {
      for (const c of circles) {
        try {
          const pool = new ethers.Contract(c.address, POOL_ABI, rp);
          const [phase, round, jackpot, depositors, flags] = await Promise.all([
            pool.phase(),
            pool.roundId(),
            pool.jackpot(),
            pool.participantsCount(),
            oracle.reportCount(idOf(c.address)),
          ]);
          if (!alive) return;
          setState((s) => ({
            ...s,
            [c.address]: { phase: Number(phase), round, jackpot, depositors, flags: Number(flags), loaded: true },
          }));
        } catch {
          /* rpc hiccup — leave unloaded */
        }
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [circles]);

  const onCreated = (c: Circle) => {
    addUserCircle(c);
    setCircles(allCircles());
    setShowForm(false);
    onEnter(c.address); // drop the creator straight into their new circle's operator view
  };

  return (
    <section className="circles">
      <div className="circles-head">
        <div className="circles-title">
          <h2>Circles</h2>
          <div className="circles-tools">
            <div className="toggle sm">
              <button className={mode === "grid" ? "on" : ""} onClick={() => setMode("grid")}>
                Grid
              </button>
              <button className={mode === "galaxy" ? "on" : ""} onClick={() => setMode("galaxy")}>
                Galaxy
              </button>
            </div>
            <button className="primary sm" onClick={() => (connected ? setShowForm(true) : connect())}>
              ＋ Create a circle
            </button>
          </div>
        </div>
        <p>
          Àjọ isn’t one pool — it’s many. Each <b>circle</b> is its own savings draw, with its own prize and its own
          members. And every circle carries a <b>trust rating</b> from the community: a red <b>flag</b> means people have
          privately warned about it — without anyone’s report ever being made public.
        </p>
      </div>

      {mode === "galaxy" ? (
        <Circles3D circles={circles} state={state} current={current} onEnter={onDive} />
      ) : (
        <div className="circle-grid">
          {circles.map((c) => {
          const st = state[c.address];
          const flagged = st && st.flags > 0;
          const isCurrent = c.address.toLowerCase() === current.toLowerCase();
          return (
            <article key={c.address} className={`circle-card${flagged ? " flagged" : ""}${isCurrent ? " current" : ""}`}>
              <div className="circle-top">
                <h3>
                  {c.name}
                  {c.mine && <span className="mine-tag">yours</span>}
                </h3>
                {st ? (
                  flagged ? (
                    <span className="badge trust-warn">⚠ flagged by {st.flags}</span>
                  ) : (
                    <span className="badge trust-ok">✓ trusted</span>
                  )
                ) : (
                  <span className="badge dim">…</span>
                )}
              </div>
              <p className="circle-theme">{c.theme}</p>

              <dl className="circle-stats">
                <div>
                  <dt>Prize pot</dt>
                  <dd className="mono">{st ? `${fmt(st.jackpot)}` : "—"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{st ? STATUS[st.phase] : "—"}</dd>
                </div>
                <div>
                  <dt>Savers</dt>
                  <dd className="mono">{st ? `${st.depositors}` : "—"}</dd>
                </div>
                <div>
                  <dt>Draw</dt>
                  <dd className="mono">{st ? `#${st.round}` : "—"}</dd>
                </div>
              </dl>

              <div className="circle-actions">
                <button className="primary" onClick={() => onEnter(c.address)} disabled={isCurrent}>
                  {isCurrent ? "Currently in" : "Enter circle"}
                </button>
                <a className="link" href={`${EXPLORER}/address/${c.address}`} target="_blank" rel="noreferrer">
                  contract ↗
                </a>
              </div>
            </article>
          );
        })}

        <button className="circle-card create-card" onClick={() => (connected ? setShowForm(true) : connect())}>
          <span className="plus">＋</span>
          <span className="create-title">Start your own circle</span>
          <span className="create-sub">
            {connected ? "Make your own savings draw — it’s yours to run, set up in one step." : "Connect a wallet to start your own savings draw."}
          </span>
        </button>
        </div>
      )}

      <p className="circles-foot">
        The trust rating is the part of <i>esusu</i> that keeps everyone honest: members can privately warn about a bad
        circle, and it shows up flagged for everyone — but no single warning is ever made public. The same idea lets a
        trusted{" "}
        <a className="link" href="#shield">
          🛡️ AI assistant
        </a>{" "}
        save on your behalf, safely.
      </p>

      {showForm && (
        <CreateForm signer={signer} address={address} onClose={() => setShowForm(false)} onCreated={onCreated} />
      )}
    </section>
  );
}

function CreateForm({
  signer,
  address,
  onClose,
  onCreated,
}: {
  signer?: ethers.Signer;
  address?: string;
  onClose: () => void;
  onCreated: (c: Circle) => void;
}) {
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [jackpot, setJackpot] = useState("1000");
  const [authorizeMandate, setAuthorizeMandate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const valid = useMemo(() => name.trim().length > 0 && !!signer, [name, signer]);

  const submit = async () => {
    if (!signer || !valid || busy) return;
    setBusy(true);
    setErr("");
    try {
      const addr = await deployCircle(signer, {
        jackpot: Math.max(0, Number(jackpot) || 0),
        authorizeMandate,
        onStep: setStep,
      });
      onCreated({
        name: name.trim(),
        theme: theme.trim() || "A confidential esusu circle",
        address: addr,
        createdBy: address,
      });
    } catch (e) {
      setErr((e as Error).message ?? "Deploy failed");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Start your own circle</h3>
          {!busy && (
            <button className="modal-x" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <p className="modal-sub">
          This creates your own savings draw, right from your wallet. You’re the <b>host</b> — you run each round.
          Everyone’s balance stays private, and the winner is picked by a draw anyone can check.
        </p>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lagos Founders circle" disabled={busy} />
        </label>

        <label className="field">
          <span>One-line description</span>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Monthly savings draw for our group"
            disabled={busy}
          />
        </label>

        <label className="field">
          <span>Starting prize (coins)</span>
          <input
            type="number"
            min={0}
            value={jackpot}
            onChange={(e) => setJackpot(e.target.value)}
            disabled={busy}
          />
          <small>The first prize in the pot. Leave 0 to start empty.</small>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={authorizeMandate}
            onChange={(e) => setAuthorizeMandate(e.target.checked)}
            disabled={busy}
          />
          <span>
            Let a trusted <b>🛡️ AI assistant</b> save into this circle for you, under a spending limit you set. (Advanced
            — fine to leave on.)
          </span>
        </label>

        {err && <div className="modal-err">{err}</div>}
        {busy && (
          <div className="modal-progress">
            <span className="spin" /> {step || "Confirm in your wallet…"}
          </div>
        )}

        <div className="modal-actions">
          {!busy && (
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          <button className="primary" onClick={submit} disabled={!valid || busy}>
            {busy ? "Creating…" : "Create circle"}
          </button>
        </div>
      </div>
    </div>
  );
}
