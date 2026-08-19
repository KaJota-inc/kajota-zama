import { EXPLORER } from "./config";

// The agent-native layer, in-app: Àjọ is the pot; Shield is the trust circle esusu always had.
// The operator console (self-contained) is embedded from /shield.html.
const MANDATE = "0x5BA600798E834E12b48648488C7eb12d92e0a32c";
const BRIDGE_TX = "0xa8482b7c458b276645dfd5fded8be505970ce1cc957bb1d5f63490f0434738bc";

export function Shield() {
  return (
    <div className="wrap wide">
      <header>
        <div className="brand">
          <h1>
            À<span className="accent">jọ</span>
          </h1>
          <span className="pill">Shield · agent-native</span>
        </div>
        <p className="sub">
          The pot is only half of <i>esusu</i>. The other half is the <b>trust circle</b> — who may put money in, how
          much, and whether a counterparty can be trusted. <b>Shield</b> restores it, confidentially: an autonomous
          agent saves into this pool under a private <b>mandate</b> (encrypted cap, allow-list, kill switch), screened
          by a shared <b>fraud oracle</b>, watched by an <b>anomaly monitor</b>. A hijacked agent can't move past its
          bounds.
        </p>
        <nav>
          <a className="link" href="#">
            ← Back to the pool
          </a>
          <a className="link" href={`${EXPLORER}/tx/${BRIDGE_TX}`} target="_blank" rel="noreferrer">
            live bridge tx ↗
          </a>
          <a className="link" href={`${EXPLORER}/address/${MANDATE}#code`} target="_blank" rel="noreferrer">
            mandate contract ↗
          </a>
        </nav>
      </header>

      <div
        style={{
          marginTop: 22,
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          background: "var(--bg-2)",
        }}
      >
        <iframe
          src="/shield.html"
          title="Kajota Shield — Operator Console"
          style={{ width: "100%", height: "min(1400px, 180vh)", border: 0, display: "block" }}
        />
      </div>

      <footer>
        One canonical system on Sepolia — the pool, the mandate, the fraud oracle, and the confidential rail. Everything
        the operator console shows is backed by verified contracts and real transactions.
      </footer>
    </div>
  );
}
