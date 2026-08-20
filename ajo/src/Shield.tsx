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
          <span className="pill">Shield · safe AI money</span>
        </div>
        <p className="sub">
          More and more, people let an <b>AI assistant</b> handle small money tasks. The scary part: what if it gets
          tricked or hijacked? <b>Shield</b> puts it on a leash. You give your assistant a private <b>spending limit</b>{" "}
          it can’t exceed, a short list of <b>who it’s allowed to pay</b>, and a <b>kill switch</b>. Before paying
          anyone, it quietly checks a shared <b>warning list</b> — so it can’t be fooled into paying a known bad actor.
          Even if the assistant is hijacked, it simply can’t move past the limits you set.
        </p>
        <nav>
          <a className="link" href="#">
            ← Back to savings
          </a>
          <a className="link" href={`${EXPLORER}/tx/${BRIDGE_TX}`} target="_blank" rel="noreferrer">
            see it happen on-chain ↗
          </a>
          <a className="link" href={`${EXPLORER}/address/${MANDATE}#code`} target="_blank" rel="noreferrer">
            the rules, in code ↗
          </a>
        </nav>
      </header>

      <p className="shield-caption">
        Below is the operator’s-eye view — the live spending limits, the allow-list, and the shared warning list, all
        working on a test network.
      </p>

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
        It’s all real: the savings pool, the spending rules, and the shared warning list are live contracts on a test
        network, backed by real transactions — nothing here is mocked up.
      </footer>
    </div>
  );
}
