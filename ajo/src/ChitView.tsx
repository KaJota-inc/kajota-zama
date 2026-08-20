import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useMechanism, fromUnits, toUnits, shortA } from "./useMechanism";
import { getFhevmInstance, encryptAmount } from "./fhevm";
import { CHIT_ABI } from "./abi";
import { CHIT_ADDRESS, EXPLORER } from "./config";

const PHASE = ["Open — deposits welcome", "Bidding — place your sealed bid", "Settled — winner drawn"];

// Interactive sealed-bid chit fund (the "bidding hui"). Each round is a sealed-bid auction settled
// by a homomorphic argmax over encrypted bids — the highest bidder takes the pot minus the bid,
// and the forgone discount is split among the rest.
export function ChitView() {
  const m = useMechanism(CHIT_ADDRESS, CHIT_ABI);
  const [s, setS] = useState<{ pot: bigint; phase: number; round: bigint; members: bigint; bidders: bigint; tally: boolean; settled: boolean; owner: string } | null>(null);
  const [bid, setBid] = useState("300");
  const [wd, setWd] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pot, phase, round, members, bidders, tally, settled, owner] = await Promise.all([
          m.read.pot(),
          m.read.phase(),
          m.read.roundId(),
          m.read.membersCount(),
          m.read.biddersCount(),
          m.read.tallyComplete(),
          m.read.settleComplete(),
          m.read.owner(),
        ]);
        setS({ pot, phase: Number(phase), round, members, bidders, tally, settled, owner: String(owner) });
      } catch {
        /* rpc */
      }
    })();
  }, [m.read, m.tick]);

  const isOwner = !!(s && m.address && s.owner.toLowerCase() === m.address.toLowerCase());
  const phase = s?.phase ?? 0;

  const placeBid = () =>
    m.run("bid", async () => {
      const inst = await getFhevmInstance();
      const { handle, proof } = await encryptAmount(inst, CHIT_ADDRESS, m.address!, toUnits(Number(bid)));
      const tx = await m.write!.submitBid(handle, proof, { gasLimit: 2_000_000n });
      m.say(`Sealing your bid ${shortA(tx.hash)} …`);
      await tx.wait();
      m.say("✓ Sealed bid submitted — nobody can see it.");
    });
  const host = (label: string, fn: () => Promise<ethers.ContractTransactionResponse>) =>
    m.run(label, async () => {
      const tx = await fn();
      await tx.wait();
      m.say(`✓ ${label} done.`);
    });
  const settledRound = s ? (s.round > 0n ? s.round - 1n : 0n) : 0n;

  return (
    <>
      <section className="intro">
        <div className="intro-points">
          <div>
            <span className="ip-ico">🔨</span>
            <b>Bid, don’t gamble</b>
            <span>Each round is a sealed-bid auction — the highest bidder takes the pot now, at a discount.</span>
          </div>
          <div>
            <span className="ip-ico">🤝</span>
            <b>Patience pays</b>
            <span>The discount the winner forgoes is split among everyone else. Wait, and you earn it.</span>
          </div>
          <div>
            <span className="ip-ico">🔒</span>
            <b>Bids stay secret</b>
            <span>Your bid never leaves ciphertext; the winner is found by a homomorphic argmax.</span>
          </div>
        </div>
      </section>

      <section className="status">
        <div className="stat">
          <span className="k">Pot</span>
          <span className="v">{s ? `${fromUnits(s.pot)} coins` : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Round</span>
          <span className={`v phase-${phase}`}>{s ? PHASE[phase] : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Members</span>
          <span className="v">{s ? `${s.members}` : "…"}</span>
        </div>
        <div className="stat">
          <span className="k">Bids in</span>
          <span className="v">{s ? `${s.bidders}` : "…"}</span>
        </div>
      </section>

      {!m.connected ? (
        <section className="card connect-card">
          <h2>Try the chit fund</h2>
          <p className="hint">Connect a wallet — it’s all free test coins on a test network.</p>
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
            <p className="hint">Grab free practice coins, then add them to the pool (encrypted).</p>
            <div className="row">
              <button className="ghost" disabled={!!m.busy} onClick={m.faucet}>
                {m.busy === "faucet" ? "Getting…" : "Get 1,000 free coins"}
              </button>
              <button className="primary" disabled={!!m.busy} onClick={() => m.deposit(1000)}>
                {m.busy === "deposit" ? "Adding…" : "Add 1,000 to the pool"}
              </button>
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">2</span> Place a sealed bid
            </h2>
            <p className="hint">The discount you’ll accept to take the pot now. Highest bid wins — but your bid stays private.</p>
            <div className="row">
              <input value={bid} onChange={(e) => setBid(e.target.value)} inputMode="decimal" />
              <span className="unit">coins</span>
              <button className="primary" disabled={!!m.busy || phase !== 1} onClick={placeBid}>
                {m.busy === "bid" ? "Sealing…" : "🔨 Submit sealed bid"}
              </button>
            </div>
            {phase !== 1 && <p className="muted">Bidding opens when the host starts a round (Host controls below).</p>}
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> Your balance & payout
            </h2>
            <div className="row">
              <button className="ghost" disabled={!!m.busy} onClick={m.revealBalance}>
                {m.busy === "reveal" ? "Checking…" : "🔓 Show my balance"}
              </button>
              <span className="balance">{m.myBalance === null ? "🔒 hidden" : `${fromUnits(m.myBalance)} coins`}</span>
            </div>
            <div className="row">
              <button className="primary" disabled={!!m.busy || !s?.settled} onClick={() => host("claim", () => m.write!.claim(settledRound, { gasLimit: 3_000_000n }))}>
                {m.busy === "claim" ? "Collecting…" : "🎁 Collect my outcome"}
              </button>
              {!s?.settled && <span className="muted">Lights up once a round is settled.</span>}
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">4</span> Take your money out
            </h2>
            <div className="row">
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
                <span className="host-title">🔨 Host controls — run a sealed-bid round</span>
                <span className="host-sub">you’re the host of this pool</span>
              </summary>
              <p className="hint">Add a prize, open bidding, then find the highest bidder over ciphertext.</p>
              <div className="row">
                <button className="ghost" disabled={!!m.busy || phase !== 0} onClick={() => host("fundPot", () => m.write!.fundPot(toUnits(1000), { gasLimit: 2_500_000n }))}>
                  1 · Add 1,000 prize
                </button>
                <button className="ghost" disabled={!!m.busy || phase === 1} onClick={() => host("openBidding", () => m.write!.openBidding({ gasLimit: 500_000n }))}>
                  2 · Open bidding
                </button>
                <button className="ghost" disabled={!!m.busy || phase !== 1 || s?.tally} onClick={() => host("tallyBids", () => m.write!.tallyBids(20, { gasLimit: 6_000_000n }))}>
                  3 · Tally bids
                </button>
                <button className="ghost" disabled={!!m.busy || !s?.tally || s?.settled} onClick={() => host("settle", () => m.write!.settle(20, { gasLimit: 6_000_000n }))}>
                  4 · Pick winner (argmax)
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
        Sealed-bid chit fund · <a className="link" href={`${EXPLORER}/address/${CHIT_ADDRESS}`} target="_blank" rel="noreferrer">see the contract ↗</a> · <a className="link" href="#mechanisms">← all three mechanisms</a>
      </footer>
    </>
  );
}
