import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { POOL_ABI, CHIT_ABI, TONTINE_ABI } from "./abi";
import { POOL_ADDRESS, CHIT_ADDRESS, TONTINE_ADDRESS, PUBLIC_RPC, EXPLORER, CUSDT_DECIMALS } from "./config";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const coins = (v: bigint) => (Number(v) / 10 ** CUSDT_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
const isSet = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a) && a !== "0x0000000000000000000000000000000000000000";

type Stat = { k: string; v: string };

// A tour through the history of pooled money: three different ways to run a confidential pool, all
// on the same encrypted cUSDT rail. Every number is read live from Sepolia.
export function Mechanisms() {
  const [premium, setPremium] = useState<Stat[]>([]);
  const [chit, setChit] = useState<Stat[]>([]);
  const [tontine, setTontine] = useState<Stat[]>([]);

  useEffect(() => {
    const rp = new ethers.JsonRpcProvider(PUBLIC_RPC);
    const CHIT_PHASE = ["Open", "Bidding — sealed bids in", "Settled — winner drawn"];
    const POOL_STATUS = ["Open for savings", "Picking a winner…", "Winner picked"];
    (async () => {
      try {
        const p = new ethers.Contract(POOL_ADDRESS, POOL_ABI, rp);
        const [ph, jp, ct, r] = await Promise.all([p.phase(), p.jackpot(), p.participantsCount(), p.roundId()]);
        setPremium([
          { k: "Prize pot", v: `${coins(jp)} coins` },
          { k: "This round", v: POOL_STATUS[Number(ph)] ?? `#${r}` },
          { k: "Savers", v: `${ct}` },
        ]);
      } catch {
        /* rpc */
      }
      if (isSet(CHIT_ADDRESS)) {
        try {
          const c = new ethers.Contract(CHIT_ADDRESS, CHIT_ABI, rp);
          const [pot, ph, r, m, b] = await Promise.all([
            c.pot(),
            c.phase(),
            c.roundId(),
            c.membersCount(),
            c.biddersCount(),
          ]);
          setChit([
            { k: "Pot", v: `${coins(pot)} coins` },
            { k: "Round", v: CHIT_PHASE[Number(ph)] ?? `#${r}` },
            { k: "Members", v: `${m}` },
            { k: "Bids in", v: `${b}` },
          ]);
        } catch {
          /* rpc */
        }
      }
      if (isSet(TONTINE_ADDRESS)) {
        try {
          const t = new ethers.Contract(TONTINE_ADDRESS, TONTINE_ABI, rp);
          const [active, acc, dist, m] = await Promise.all([
            t.activeCount(),
            t.accDividend(),
            t.totalDistributed(),
            t.membersCount(),
          ]);
          setTontine([
            { k: "Survivors", v: `${active}` },
            { k: "Dividend / survivor", v: `${coins(acc)} coins` },
            { k: "Total paid out", v: `${coins(dist)} coins` },
            { k: "Members", v: `${m}` },
          ]);
        } catch {
          /* rpc */
        }
      }
    })();
  }, []);

  return (
    <div className="wrap wide">
      <header>
        <div className="brand">
          <h1>
            À<span className="accent">jọ</span>
          </h1>
          <span className="pill">Three ways to pool</span>
        </div>
        <p className="sub">
          Humans have pooled money for a thousand years — and almost every scheme died for the same reason: you had to
          trust an operator with the books. <b>FHE fixes exactly that</b> — private books that are still publicly
          verifiable. So here are <b>three ways history ran a pool</b>, each rebuilt confidentially on the same cUSDT
          rail. Every figure is live on Sepolia.
        </p>
        <nav>
          <a className="link" href="#">
            ← Back to app
          </a>
          <a className="link" href="#evidence">
            Evidence ↗
          </a>
        </nav>
      </header>

      <div className="mech-grid">
        <MechCard
          era="England · 1956"
          name="Premium Bonds"
          tag="Random draw"
          address={POOL_ADDRESS}
          href="#"
          blurb="No-loss savings whose pooled interest is paid out as a lottery, drawn by a random-number machine (ERNIE). This is essentially what Àjọ already is."
          crux="Winner = a public commit-revealed seed over encrypted, time-weighted balances. Provably fair, nobody sees a balance."
          stats={premium}
          live
        />
        <MechCard
          era="South India · 1000+ yrs"
          name="Chit fund"
          tag="Sealed-bid auction"
          address={CHIT_ADDRESS}
          href="#chit"
          blurb="A rotating pool where each round is a sealed-bid auction: the highest bidder takes the pot now, at a discount — and that discount is split among everyone else."
          crux="Winner = a homomorphic argmax over encrypted bids. A sealed-bid auction is the canonical thing FHE is for — bids never leave ciphertext."
          stats={chit}
        />
        <MechCard
          era="France · 1653"
          name="Tontine"
          tag="Survivorship"
          address={TONTINE_ADDRESS}
          href="#tontine"
          blurb="Members pool money and share the yield; each time one exits, their share redistributes to the rest — so the dividend grows as the group shrinks. Banned in 1905 for opacity."
          crux="Payout = a survivor dividend that grows as the active set shrinks. Principal stays encrypted; only the fair per-survivor rate is public."
          stats={tontine}
        />
      </div>

      <footer>
        One rail, three mechanisms — Premium Bonds is the random draw you already know; the chit fund and the tontine are
        new FHE contracts. History banned the last two for lack of trustworthy confidentiality; FHE brings them back.
      </footer>
    </div>
  );
}

function MechCard({
  era,
  name,
  tag,
  address,
  href,
  blurb,
  crux,
  stats,
  live,
}: {
  era: string;
  name: string;
  tag: string;
  address: string;
  href: string;
  blurb: string;
  crux: string;
  stats: Stat[];
  live?: boolean;
}) {
  const deployed = isSet(address);
  return (
    <article className="mech-card">
      <div className="mech-top">
        <span className="mech-era">{era}</span>
        <span className="badge mech-tag">{tag}</span>
      </div>
      <h2 className="mech-name">{name}</h2>
      <p className="mech-blurb">{blurb}</p>
      <p className="mech-crux">
        <b>How it decides:</b> {crux}
      </p>

      <dl className="mech-stats">
        {stats.length ? (
          stats.map((s) => (
            <div key={s.k}>
              <dt>{s.k}</dt>
              <dd>{s.v}</dd>
            </div>
          ))
        ) : (
          <div>
            <dt>Status</dt>
            <dd className="dim">{deployed ? "reading chain…" : "deploying…"}</dd>
          </div>
        )}
      </dl>

      <a className={`primary mech-open${deployed ? "" : " disabled"}`} href={deployed ? href : undefined} aria-disabled={!deployed}>
        {live ? "Open the pool →" : "Open this pool →"}
      </a>

      <div className="mech-foot">
        {live && <span className="mech-live">● the live Àjọ pool</span>}
        {deployed && (
          <a className="link" href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer">
            {short(address)} ↗
          </a>
        )}
      </div>
    </article>
  );
}
