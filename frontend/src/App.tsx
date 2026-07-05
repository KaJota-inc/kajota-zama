import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { CONFIDENTIAL_PAY_ABI } from "./abi";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "./config";
import { encryptAmount, encryptAmounts, getFhevmInstance, userDecryptBalance } from "./fhevm";

type Row = { recipient: string; amount: string };

const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function App() {
  const [account, setAccount] = useState<string>("");
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainOk, setChainOk] = useState<boolean>(true);
  const [handle, setHandle] = useState<string>("");
  const [clearBalance, setClearBalance] = useState<bigint | null>(null);
  const [claimed, setClaimed] = useState<boolean>(false);
  const [busy, setBusy] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);

  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([{ recipient: "", amount: "" }]);

  const configured = useMemo(() => !/^0x0+$/.test(CONTRACT_ADDRESS), []);

  const say = useCallback((m: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 40)), []);

  const contract = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, CONFIDENTIAL_PAY_ABI, signer);
  }, [signer]);

  const connect = useCallback(async () => {
    try {
      const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (!eth) return say("No wallet found. Install MetaMask.");
      const provider = new ethers.BrowserProvider(eth);
      await provider.send("eth_requestAccounts", []);
      const net = await provider.getNetwork();
      setChainOk(Number(net.chainId) === SEPOLIA_CHAIN_ID);
      const s = await provider.getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
      say(`Connected ${short(await s.getAddress())} on chain ${net.chainId}`);
    } catch (e) {
      say(`Connect failed: ${(e as Error).message}`);
    }
  }, [say]);

  const refresh = useCallback(async () => {
    if (!contract || !account) return;
    try {
      const h: string = await contract.balanceOf(account);
      setHandle(h);
      setClearBalance(null);
      setClaimed(await contract.hasClaimed(account));
    } catch (e) {
      say(`Read failed: ${(e as Error).message}`);
    }
  }, [contract, account, say]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claim = useCallback(async () => {
    if (!contract) return;
    setBusy("Claiming faucet…");
    try {
      const tx = await contract.claimFaucet();
      say(`Faucet tx ${short(tx.hash)} sent…`);
      await tx.wait();
      say("Faucet claimed. Encrypted balance seeded.");
      await refresh();
    } catch (e) {
      say(`Faucet failed: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  }, [contract, refresh, say]);

  const decrypt = useCallback(async () => {
    if (!signer) return;
    setBusy("Decrypting your balance (EIP-712 signature)…");
    try {
      const instance = await getFhevmInstance();
      const clear = await userDecryptBalance(instance, signer, CONTRACT_ADDRESS, handle);
      setClearBalance(clear);
      say(`Decrypted balance = ${clear.toString()} (visible only to you)`);
    } catch (e) {
      say(`Decrypt failed: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  }, [signer, handle, say]);

  const transfer = useCallback(async () => {
    if (!contract || !signer) return;
    if (!ethers.isAddress(to)) return say("Recipient is not a valid address");
    setBusy("Encrypting amount & sending confidential transfer…");
    try {
      const instance = await getFhevmInstance();
      const { handle: encHandle, proof } = await encryptAmount(instance, CONTRACT_ADDRESS, account, BigInt(amount || "0"));
      const tx = await contract.confidentialTransfer(to, encHandle, proof);
      say(`Transfer tx ${short(tx.hash)} sent — amount stays encrypted on-chain.`);
      await tx.wait();
      say("Confidential transfer confirmed.");
      setAmount("");
      await refresh();
    } catch (e) {
      say(`Transfer failed: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  }, [contract, signer, to, amount, account, refresh, say]);

  const disperse = useCallback(async () => {
    if (!contract || !signer) return;
    const valid = rows.filter((r) => ethers.isAddress(r.recipient) && r.amount.trim() !== "");
    if (valid.length === 0) return say("Add at least one valid recipient + amount");
    setBusy(`Encrypting ${valid.length} amounts & dispersing confidentially…`);
    try {
      const instance = await getFhevmInstance();
      const { handles, proofs } = await encryptAmounts(
        instance,
        CONTRACT_ADDRESS,
        account,
        valid.map((r) => BigInt(r.amount)),
      );
      const tx = await contract.confidentialDisperse(
        valid.map((r) => r.recipient),
        handles,
        proofs,
      );
      say(`Disperse tx ${short(tx.hash)} sent — every amount encrypted.`);
      await tx.wait();
      say(`Confidential disperse to ${valid.length} recipients confirmed.`);
      await refresh();
    } catch (e) {
      say(`Disperse failed: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  }, [contract, signer, rows, account, refresh, say]);

  return (
    <div className="wrap">
      <header>
        <h1>
          KaJota <span className="accent">Confidential Pay</span>
        </h1>
        <p className="sub">
          Private payments on Ethereum via <b>Zama FHEVM</b>. Balances and amounts are Fully-Homomorphically
          Encrypted — the chain sees only ciphertext.
        </p>
      </header>

      {!configured && (
        <div className="banner warn">
          Contract address is not set. Deploy to Sepolia and set <code>VITE_CONTRACT_ADDRESS</code>.
        </div>
      )}
      {account && !chainOk && (
        <div className="banner warn">Wrong network — please switch your wallet to Sepolia (chainId 11155111).</div>
      )}

      {!account ? (
        <button className="primary big" onClick={connect}>
          Connect Wallet
        </button>
      ) : (
        <div className="account">
          <span className="dot" /> {short(account)} · Sepolia
        </div>
      )}

      {account && (
        <>
          <section className="card">
            <h2>Your confidential balance</h2>
            <div className="cipher">
              <label>On-chain (ciphertext handle)</label>
              <code className="handle">{handle || "—"}</code>
            </div>
            <div className="clear">
              <label>Decrypted (only you can)</label>
              <span className="value">{clearBalance === null ? "🔒 hidden" : clearBalance.toString()}</span>
            </div>
            <div className="actions">
              <button className="primary" disabled={!!busy || claimed} onClick={claim}>
                {claimed ? "Faucet claimed" : "Claim faucet (10,000)"}
              </button>
              <button className="ghost" disabled={!!busy || !handle} onClick={decrypt}>
                Decrypt my balance
              </button>
              <button className="ghost" disabled={!!busy} onClick={refresh}>
                Refresh
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Confidential transfer</h2>
            <p className="hint">The amount is encrypted client-side; overspend silently sends 0 — no balance leaks.</p>
            <div className="form">
              <input placeholder="Recipient 0x…" value={to} onChange={(e) => setTo(e.target.value)} />
              <input placeholder="Amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="primary" disabled={!!busy} onClick={transfer}>
                Send privately
              </button>
            </div>
          </section>

          <section className="card">
            <h2>
              Confidential disperse <span className="tag">TokenOps</span>
            </h2>
            <p className="hint">Split a private balance across many accounts in one tx — each amount stays encrypted.</p>
            {rows.map((r, i) => (
              <div className="form" key={i}>
                <input
                  placeholder="Recipient 0x…"
                  value={r.recipient}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, recipient: e.target.value } : x)))}
                />
                <input
                  placeholder="Amount"
                  inputMode="numeric"
                  value={r.amount}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                />
                <button
                  className="ghost"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="actions">
              <button className="ghost" onClick={() => setRows((rs) => [...rs, { recipient: "", amount: "" }])}>
                + Add recipient
              </button>
              <button className="primary" disabled={!!busy} onClick={disperse}>
                Disperse privately
              </button>
            </div>
          </section>
        </>
      )}

      {busy && <div className="busy">{busy}</div>}

      <section className="log">
        <h3>Activity</h3>
        {log.length === 0 ? <p className="hint">Nothing yet.</p> : log.map((l, i) => <div key={i} className="line">{l}</div>)}
      </section>

      <footer>
        FHEVM · <code>{short(CONTRACT_ADDRESS)}</code> · Zama Developer Program — Mainnet Season 3
      </footer>
    </div>
  );
}
