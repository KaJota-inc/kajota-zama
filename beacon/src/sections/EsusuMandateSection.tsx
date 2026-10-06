import { useMemo, useState } from "react";
import type { BeaconManifest } from "../types";
import { rotationCommitment } from "../lib/commitment";

const SEPOLIA_TX = "https://sepolia.etherscan.io/tx/";
const SEPOLIA_ADDR = "https://sepolia.etherscan.io/address/";

export function EsusuMandateSection({ manifest }: { manifest: BeaconManifest }) {
  const c = manifest.EsusuMandate;
  const [verifyExpanded, setVerifyExpanded] = useState(false);

  const recomputed = useMemo(() => {
    if (
      !c?.seedMembers ||
      !c.seedCollectorOrder ||
      !c.seedContribution ||
      !c.seedCycleLength
    ) {
      return null;
    }
    try {
      return rotationCommitment({
        members: c.seedMembers,
        collectorOrder: c.seedCollectorOrder,
        contribution: c.seedContribution,
        cycleLength: c.seedCycleLength,
      });
    } catch {
      return null;
    }
  }, [c]);

  if (!c) {
    return (
      <article>
        <h2>EsusuMandate</h2>
        <p className="muted">
          Not deployed yet. Run <code>scripts/beacon/deploy-sakk-esusu.mjs</code>.
        </p>
      </article>
    );
  }

  return (
    <article>
      <h2>EsusuMandate</h2>
      <p className="lede">
        The pre-colonial West African rotating-savings mandate. An organiser
        seals a rotation of N members and a fixed collector order; each cycle
        every member attests their contribution and the designated collector
        sweeps the pot once the attestation set is full. Historical operators
        absconded or quietly reshuffled the order; the on-chain{" "}
        <code>rotationCommit</code> pinned at seal prevents that silently.
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
          {c.allowOrganiserTx ? (
            <a
              href={`${SEPOLIA_TX}${c.allowOrganiserTx}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{c.allowOrganiserTx.slice(0, 10)}…</code>
            </a>
          ) : (
            <span className="muted">pending</span>
          )}
        </dd>
      </dl>

      {c.seedSealTx ? (
        <>
          <h3>Seed rotation</h3>
          <dl className="facts">
            <dt>Rotation ID</dt>
            <dd>
              <code>{c.seedRotationId}</code>
            </dd>
            <dt>Members</dt>
            <dd>
              <ul className="witnesses">
                {(c.seedMembers ?? []).map((m) => (
                  <li key={m}>
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </dd>
            <dt>Collector order</dt>
            <dd>
              <ol className="witnesses">
                {(c.seedCollectorOrder ?? []).map((m, i) => (
                  <li key={`${m}-${i}`}>
                    <code>{m}</code>
                  </li>
                ))}
              </ol>
            </dd>
            <dt>Contribution / cycle</dt>
            <dd>
              <code>{c.seedContribution}</code> minor units ·{" "}
              <code>{Number(c.seedCycleLength ?? "0") / 86400}</code> days
            </dd>
            <dt>Seal tx</dt>
            <dd>
              <a href={`${SEPOLIA_TX}${c.seedSealTx}`} target="_blank" rel="noreferrer">
                <code>{c.seedSealTx.slice(0, 10)}…</code>
              </a>
              {c.seedSealBlock ? <> @ block {c.seedSealBlock}</> : null}
            </dd>
          </dl>

          <button
            className="verify"
            onClick={() => setVerifyExpanded((v) => !v)}
          >
            {verifyExpanded ? "Hide verifier" : "Verify this receipt in the browser"}
          </button>
          {verifyExpanded && recomputed && (
            <div className="verifier">
              <p>
                In-browser <code>keccak256(abi.encode(members, order, contrib, cycleLen))</code>:
              </p>
              <pre>
                <code>{recomputed}</code>
              </pre>
              <p className="muted">
                Compare against{" "}
                <code>EsusuMandate.rotationCommit(rotationId)</code> on
                Etherscan. The pinned commitment matches by construction —
                this is the regulator-replayable property the pitch names.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          No rotation recorded yet. Run{" "}
          <code>scripts/beacon/seed-sakk-esusu.mjs</code>.
        </p>
      )}
    </article>
  );
}
