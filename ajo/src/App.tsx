import { useEffect, useState } from "react";
import { usePool } from "./usePool";
import { Classic } from "./Classic";
import { Game } from "./Game";
import { Evidence } from "./Evidence";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  if (route === "#evidence") return <Evidence />;
  return <Shell />;
}

function Shell() {
  const p = usePool();
  const [view, setView] = useState<"classic" | "game">("classic");

  return (
    <div className={view === "game" ? "wrap wide" : "wrap"}>
      <header>
        <div className="brand">
          <h1>
            À<span className="accent">jọ</span>
          </h1>
          <span className="pill">Confidential PoolTogether</span>
        </div>
        <p className="sub">
          A no-loss prize-savings pool on <b>Zama FHEVM</b>. Deposit confidential <b>cUSDT</b>; balances and winnings stay
          encrypted on-chain. Each round a public seed picks <i>one winner, weighted by your encrypted deposit</i> —
          provably fair, yet nobody sees your balance. Digital <i>esusu</i>.
        </p>
        <nav>
          {p.connected ? (
            <span className="acct">
              <span className="dot" /> {short(p.address)} · Sepolia
            </span>
          ) : (
            <button className="primary" onClick={p.connect}>
              Connect Wallet
            </button>
          )}
          <div className="toggle">
            <button className={view === "classic" ? "on" : ""} onClick={() => setView("classic")}>
              Classic
            </button>
            <button className={view === "game" ? "on" : ""} onClick={() => setView("game")}>
              3D Game
            </button>
          </div>
          <a className="link" href="#evidence">
            Evidence ↗
          </a>
        </nav>
        {!p.chainOk && <div className="warn">Wrong network — switch MetaMask to Sepolia.</div>}
      </header>

      {view === "classic" ? <Classic p={p} /> : <Game p={p} />}
    </div>
  );
}
