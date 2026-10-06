import { useEffect, useState } from "react";
import type { BeaconManifest } from "./types";
import { MandateAnchorSection } from "./sections/MandateAnchorSection";
import { SakkMandateSection } from "./sections/SakkMandateSection";
import { EsusuMandateSection } from "./sections/EsusuMandateSection";

type Tab = "anchor" | "sakk" | "esusu";

export default function App() {
  const [manifest, setManifest] = useState<BeaconManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("anchor");

  useEffect(() => {
    fetch("/beacon-sepolia.json")
      .then((r) => {
        if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
        return r.json();
      })
      .then((m: BeaconManifest) => setManifest(m))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <main className="shell">
        <h1>Mandate Beacon</h1>
        <p className="error">
          Manifest not found. Run <code>pnpm sync-manifest</code> from the
          repo root to copy <code>deployments/beacon-sepolia.json</code> into
          <code> public/</code>, then reload. ({error})
        </p>
      </main>
    );
  }

  if (!manifest) {
    return (
      <main className="shell">
        <h1>Mandate Beacon</h1>
        <p>Loading manifest…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero">
        <h1>Mandate Beacon</h1>
        <p className="tagline">
          Regulator-replayable payment-dispute SLAs — three historical
          mechanisms, one on-chain rail, no customer PII on-chain.
        </p>
        <p className="chain">
          <strong>{manifest.network}</strong> · chainId{" "}
          <code>{manifest.chainId}</code> · deployer{" "}
          <a
            href={`https://sepolia.etherscan.io/address/${manifest.deployer}`}
            target="_blank"
            rel="noreferrer"
          >
            <code>
              {manifest.deployer.slice(0, 6)}…{manifest.deployer.slice(-4)}
            </code>
          </a>
        </p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "anchor"}
          onClick={() => setTab("anchor")}
        >
          MandateAnchor <span className="count">{manifest.anchors?.length ?? 0}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "sakk"}
          onClick={() => setTab("sakk")}
          disabled={!manifest.SakkMandate}
        >
          SakkMandate <span className="count">{manifest.SakkMandate?.seedSealTx ? 1 : 0}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "esusu"}
          onClick={() => setTab("esusu")}
          disabled={!manifest.EsusuMandate}
        >
          EsusuMandate <span className="count">{manifest.EsusuMandate?.seedSealTx ? 1 : 0}</span>
        </button>
      </nav>

      <section className="panel">
        {tab === "anchor" && <MandateAnchorSection manifest={manifest} />}
        {tab === "sakk" && <SakkMandateSection manifest={manifest} />}
        {tab === "esusu" && <EsusuMandateSection manifest={manifest} />}
      </section>

      <footer className="footer">
        <p>
          <strong>Mandate Beacon</strong> — Payflow's Chainlink-CRE-anchored
          direct-debit mandate registry. The on-chain audit lineage is public;
          customer PII is kept off-chain and the envelope hash is the only
          customer identifier the chain sees. BLI Legal Tech Hackathon 2 · one
          rail, three mechanisms, byte-identical cross-rail commitment.
        </p>
        <p className="meta">
          Deployed <time dateTime={manifest.deployedAt}>{manifest.deployedAt}</time>{" "}
          on branch <code>{manifest.branch}</code>.
        </p>
      </footer>
    </main>
  );
}
