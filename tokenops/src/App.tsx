import { useMemo, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useQueryClient } from "@tanstack/react-query";
import { useZamaSDK } from "@zama-fhe/react-sdk";
import { useMintConfidential } from "@tokenops/sdk/testnet-faucet/react";
import {
  useIsRegistered,
  useRegister,
  usePreflightDisperse,
  useDisperse,
} from "@tokenops/sdk/fhe-disperse/react";
import { CTTT, CTTT_DECIMALS } from "./config";

type Row = { recipient: string; amount: string };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const toUnits = (v: string) => BigInt(Math.round(parseFloat(v || "0") * 10 ** CTTT_DECIMALS));

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();
  const zamaSDK = useZamaSDK();

  const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 30));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tokenops-sdk"] });

  const user = address as Address | undefined;
  const [rows, setRows] = useState<Row[]>([{ recipient: "", amount: "" }]);

  // --- faucet (mint CTTT) ---
  const mint = useMintConfidential();

  // --- register (one-time per user) ---
  const { data: isRegistered } = useIsRegistered({ user: user! });
  const register = useRegister();

  // --- disperse ---
  const valid = rows.filter((r) => isAddress(r.recipient) && r.amount.trim() !== "");
  const recipients = valid.map((r) => r.recipient as Address);
  const amounts = valid.map((r) => toUnits(r.amount));
  const { data: report } = usePreflightDisperse({
    user: user!,
    token: CTTT,
    recipients,
    amounts,
    mode: "wallet",
  });
  // The relayer satisfies the Encryptor interface at runtime; its published type
  // is slightly looser than useDisperse's param, so we cast (matches SDK README).
  const disperse = useDisperse({ encryptor: (() => zamaSDK.relayer) as never });

  const total = useMemo(() => valid.reduce((s, r) => s + parseFloat(r.amount || "0"), 0), [rows]);

  return (
    <div className="wrap">
      <header>
        <h1>
          KaJota <span className="accent">Confidential Disperse</span>
        </h1>
        <p className="sub">
          Split a private balance across many recipients in one transaction — every amount encrypted. Built on the{" "}
          <b>TokenOps SDK</b> + <b>Zama FHEVM</b>. Each recipient can decrypt only their own allocation; the amounts and
          the list stay confidential on-chain.
        </p>
      </header>

      {!isConnected ? (
        <button className="primary big" onClick={() => connect({ connector: injected() })}>
          Connect Wallet
        </button>
      ) : (
        <div className="account">
          <span className="dot" /> {short(address)} · Sepolia
          <button className="link" onClick={() => disconnect()}>
            disconnect
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <section className="card">
            <h2>
              <span className="step">1</span> Get test tokens
            </h2>
            <p className="hint">Mint 1,000 CTTT (the ERC-7984 confidential test token) to your wallet — public mint, fully backed.</p>
            <button
              className="primary"
              disabled={mint.isPending}
              onClick={() =>
                mint.mutate(
                  { amount: 1_000_000_000n },
                  {
                    onSuccess: () => {
                      say("Minted 1,000 CTTT to your wallet.");
                      invalidate();
                    },
                    onError: (e) => say(`Faucet failed: ${(e as Error).message}`),
                  },
                )
              }
            >
              {mint.isPending ? "Minting…" : "Mint 1,000 CTTT"}
            </button>
          </section>

          <section className="card">
            <h2>
              <span className="step">2</span> Register (one-time)
            </h2>
            <p className="hint">Registers your confidential wallet-pair with the disperse singleton. Needed once per account.</p>
            <button
              className="primary"
              disabled={isRegistered === true || register.isPending}
              onClick={() =>
                register.mutate(
                  { token: CTTT },
                  {
                    onSuccess: () => {
                      say("Registered with the disperse singleton.");
                      invalidate();
                    },
                    onError: (e) => say(`Register failed: ${(e as Error).message}`),
                  },
                )
              }
            >
              {isRegistered ? "Registered ✓" : register.isPending ? "Registering…" : "Register"}
            </button>
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> Confidential disperse
            </h2>
            <p className="hint">Add recipients + amounts. Each amount is encrypted client-side before it ever leaves your browser.</p>
            {rows.map((r, i) => (
              <div className="form" key={i}>
                <input
                  placeholder="Recipient 0x…"
                  value={r.recipient}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, recipient: e.target.value } : x)))}
                />
                <input
                  placeholder="CTTT amount"
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                />
                <button className="ghost" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}>
                  ✕
                </button>
              </div>
            ))}
            <div className="actions">
              <button className="ghost" onClick={() => setRows((rs) => [...rs, { recipient: "", amount: "" }])}>
                + Add recipient
              </button>
              <span className="total">{valid.length} recipients · {total} CTTT</span>
            </div>

            {report && !report.ready && report.blockerErrors?.length > 0 && (
              <ul className="blockers">
                {report.blockerErrors.map((err: { code: string; message: string }) => (
                  <li key={err.code + err.message}>{err.message}</li>
                ))}
              </ul>
            )}

            <button
              className="primary big"
              disabled={!report?.ready || disperse.isPending || valid.length === 0}
              onClick={() =>
                disperse.mutate(
                  { token: CTTT, mode: "wallet", recipients, amounts },
                  {
                    onSuccess: () => {
                      say(`Confidential disperse to ${valid.length} recipients confirmed.`);
                      invalidate();
                    },
                    onError: (e) => say(`Disperse failed: ${(e as Error).message}`),
                  },
                )
              }
            >
              {disperse.isPending ? "Dispersing privately…" : "Disperse privately"}
            </button>
          </section>
        </>
      )}

      <section className="logbox">
        <h3>Activity</h3>
        {log.length === 0 ? <p className="hint">Nothing yet.</p> : log.map((l, i) => <div key={i} className="line">{l}</div>)}
      </section>

      <footer>
        TokenOps SDK · Zama FHEVM · CTTT <code>{short(CTTT)}</code> · Zama Developer Program — Special Bounty Track
      </footer>
    </div>
  );
}
