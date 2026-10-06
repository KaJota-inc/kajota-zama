import type { BeaconManifest } from "../types";

const SEPOLIA_TX = "https://sepolia.etherscan.io/tx/";
const SEPOLIA_ADDR = "https://sepolia.etherscan.io/address/";

export function SakkMandateSection({ manifest }: { manifest: BeaconManifest }) {
  const c = manifest.SakkMandate;
  if (!c) {
    return (
      <article>
        <h2>SakkMandate</h2>
        <p className="muted">Not deployed yet. Run <code>scripts/beacon/deploy-sakk-esusu.mjs</code>.</p>
      </article>
    );
  }
  return (
    <article>
      <h2>SakkMandate</h2>
      <p className="lede">
        The 10–11c Abbasid sealed Islamic banking instruction. The payer
        commits to a mandate body as a sealed hash, a witness quorum attests,
        and the beneficiary opens the pre-image on-chain. Replay fails by
        status; forgery fails by hash. The historical form died when
        cross-city coordination collapsed; on-chain witnessing fixes both
        failure modes.
      </p>

      <dl className="facts">
        <dt>Contract</dt>
        <dd>
          <a href={`${SEPOLIA_ADDR}${c.address}`} target="_blank" rel="noreferrer">
            <code>{c.address}</code>
          </a>
        </dd>
        <dt>Deploy tx</dt>
        <dd>
          <a href={`${SEPOLIA_TX}${c.txHash}`} target="_blank" rel="noreferrer">
            <code>{c.txHash.slice(0, 10)}…</code>
          </a>
        </dd>
        <dt>Allowlist seed</dt>
        <dd>
          {c.allowPayerTx ? (
            <a href={`${SEPOLIA_TX}${c.allowPayerTx}`} target="_blank" rel="noreferrer">
              <code>{c.allowPayerTx.slice(0, 10)}…</code>
            </a>
          ) : (
            <span className="muted">pending</span>
          )}
        </dd>
      </dl>

      {c.seedSealTx ? (
        <>
          <h3>Seed seal</h3>
          <dl className="facts">
            <dt>Sakk ID</dt>
            <dd>
              <code>{c.seedSakkId}</code>
            </dd>
            <dt>Commit</dt>
            <dd>
              <code>{c.seedCommit}</code>
            </dd>
            <dt>Beneficiary</dt>
            <dd>
              <code>{c.seedBeneficiary}</code>
            </dd>
            <dt>Witnesses (2-of-3)</dt>
            <dd>
              <ul className="witnesses">
                {(c.seedWitnesses ?? []).map((w) => (
                  <li key={w}>
                    <code>{w}</code>
                  </li>
                ))}
              </ul>
            </dd>
            <dt>Seal tx</dt>
            <dd>
              <a href={`${SEPOLIA_TX}${c.seedSealTx}`} target="_blank" rel="noreferrer">
                <code>{c.seedSealTx.slice(0, 10)}…</code>
              </a>
              {c.seedSealBlock ? <> @ block {c.seedSealBlock}</> : null}
            </dd>
          </dl>
          <p className="aside">
            A judge replaying the demo computes{" "}
            <code>keccak256(abi.encode(bodyBytes, 0xdeadbeef))</code> off the
            Basra draft text and must obtain the commit above byte-for-byte.
          </p>
        </>
      ) : (
        <p className="muted">
          No seal recorded yet. Run{" "}
          <code>scripts/beacon/seed-sakk-esusu.mjs</code>.
        </p>
      )}
    </article>
  );
}
