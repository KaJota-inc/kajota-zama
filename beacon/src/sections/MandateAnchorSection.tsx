import type { BeaconManifest } from "../types";

const SEPOLIA_TX = "https://sepolia.etherscan.io/tx/";
const SEPOLIA_ADDR = "https://sepolia.etherscan.io/address/";

export function MandateAnchorSection({ manifest }: { manifest: BeaconManifest }) {
  const anchors = manifest.anchors ?? [];
  const address = manifest.MandateAnchor.address;
  const slaHours = Math.round(manifest.slaWindowSeconds / 3600);

  return (
    <article>
      <h2>MandateAnchor</h2>
      <p className="lede">
        The modern direct-debit mandate: a bank posts a redacted envelope hash,
        a server-authored idempotency key, the SLA deadline, and the pinned
        sanctions-list snapshot. A replay inside the TTL routes to
        <code> DuplicateRouted</code>; a missed SLA fires{" "}
        <code>SLABreached</code> on-chain. Napoleonic 1804 lineage.
      </p>

      <dl className="facts">
        <dt>Contract</dt>
        <dd>
          <a href={`${SEPOLIA_ADDR}${address}`} target="_blank" rel="noreferrer">
            <code>{address}</code>
          </a>
        </dd>
        <dt>SLA window</dt>
        <dd>
          <code>{manifest.slaWindowSeconds}s</code> ({slaHours}h) — CBN CPR 2019 Part 6
        </dd>
        <dt>Allowlist seed</dt>
        <dd>
          {manifest.allowBankTx ? (
            <a
              href={`${SEPOLIA_TX}${manifest.allowBankTx}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{manifest.allowBankTx.slice(0, 10)}…</code>
            </a>
          ) : (
            <span className="muted">pending</span>
          )}
        </dd>
      </dl>

      <h3>Anchor sequence ({anchors.length})</h3>
      {anchors.length === 0 ? (
        <p className="muted">
          No anchors recorded. The GitHub Actions cron
          (<code>.github/workflows/beacon-anchor-cron.yml</code>) activates once
          the <code>DEPLOYER_MNEMONIC</code> repo secret is set.
        </p>
      ) : (
        <table className="anchors">
          <thead>
            <tr>
              <th>#</th>
              <th>Mandate ID</th>
              <th>Amount</th>
              <th>Commitment</th>
              <th>Block</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {anchors.map((a) => (
              <tr key={a.sequence}>
                <td>{a.sequence}</td>
                <td>
                  <code>{a.mandateId.slice(0, 10)}…</code>
                </td>
                <td>{a.amount}</td>
                <td>
                  <code>{a.commitment.slice(0, 10)}…</code>
                </td>
                <td>{a.blockNumber}</td>
                <td>
                  <a href={`${SEPOLIA_TX}${a.txHash}`} target="_blank" rel="noreferrer">
                    etherscan →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
