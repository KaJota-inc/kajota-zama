import { useEffect, useMemo, useState } from "react";
import { usePool } from "./usePool";
import { Classic } from "./Classic";
import { Game } from "./Game";
import { Evidence } from "./Evidence";
import { Shield } from "./Shield";
import { Circles } from "./Circles";
import { POOL_ADDRESS } from "./config";
import { allCircles } from "./circleStore";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  if (route === "#evidence") return <Evidence />;
  if (route === "#shield") return <Shield />;
  return <Shell />;
}

function Shell() {
  const [circle, setCircle] = useState<string>(POOL_ADDRESS);
  const p = usePool(circle);
  const [view, setView] = useState<"classic" | "game" | "circles">("classic");
  const circleName = useMemo(
    () => allCircles().find((c) => c.address.toLowerCase() === circle.toLowerCase())?.name ?? "Weekly Àjọ",
    [circle],
  );
  const enterCircle = (addr: string) => {
    setCircle(addr);
    setView("classic");
  };
  const diveIntoCircle = (addr: string) => {
    setCircle(addr);
    setView("game"); // fly the camera inside this circle's live 3D draw
  };

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
          A savings draw where <b>nobody loses</b>. Add coins, and each round one saver wins the prize pot — your balance
          stays <b>private</b>, and you can take your money out any time. It’s digital <i>esusu</i>, the West-African
          savings circle, rebuilt so no one can see your books. <a className="link" href="#shield">How it stays safe →</a>
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
          {p.connected && (
            <div className="toggle">
              <button className={view === "circles" ? "on" : ""} onClick={() => setView("circles")}>
                Circles
              </button>
              <button className={view === "classic" ? "on" : ""} onClick={() => setView("classic")}>
                Classic
              </button>
              <button className={view === "game" ? "on" : ""} onClick={() => setView("game")}>
                3D Game
              </button>
            </div>
          )}
          {!p.connected && (
            <button className="link linkbtn" onClick={() => setView(view === "circles" ? "classic" : "circles")}>
              {view === "circles" ? "← Back" : "Circles"}
            </button>
          )}
          {view !== "circles" && (
            <span className="circle-chip" title="Active circle">
              ● {circleName}
            </span>
          )}
          <a className="link" href="#shield">
            🛡️ Shield
          </a>
          <a className="link" href="#evidence">
            Evidence ↗
          </a>
        </nav>
        {!p.chainOk && <div className="warn">Wrong network — switch MetaMask to Sepolia.</div>}
      </header>

      {view === "circles" ? (
        <Circles
          current={circle}
          onEnter={enterCircle}
          onDive={diveIntoCircle}
          connected={p.connected}
          connect={p.connect}
          signer={p.signer}
          address={p.address}
        />
      ) : view === "game" ? (
        <Game p={p} circleName={circleName} onExit={() => setView("circles")} />
      ) : (
        <Classic p={p} />
      )}
    </div>
  );
}
