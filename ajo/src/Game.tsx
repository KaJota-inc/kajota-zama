import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float, Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { PoolState, fromUnits } from "./usePool";
import { PHASES } from "./config";

const GOLD = "#f5c542";
const TEAL = "#39d0c8";

// ── One encrypted "ticket" crystal orbiting the vault ─────────────────────────────────────
function Ticket({ angle, radius, winner, drawing }: { angle: number; radius: number; winner: boolean; drawing: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useMemo(() => Math.random() * 10, []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const spin = drawing ? 6 : 1;
    const a = angle + state.clock.elapsedTime * 0.15 * spin;
    m.position.x = Math.cos(a) * radius;
    m.position.z = Math.sin(a) * radius;
    m.position.y = Math.sin(state.clock.elapsedTime * 0.8 + t0) * 0.35 + (winner ? 0.6 : 0);
    m.rotation.x += 0.01 * spin;
    m.rotation.y += 0.012 * spin;
    const target = winner ? 1.9 : 1;
    m.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.42, 0]} />
      <meshStandardMaterial
        color={winner ? GOLD : TEAL}
        emissive={winner ? GOLD : TEAL}
        emissiveIntensity={winner ? 1.4 : 0.5}
        metalness={0.6}
        roughness={0.15}
        transparent
        opacity={0.92}
      />
      {winner && <Sparkles count={30} scale={2.4} size={4} speed={0.6} color={GOLD} />}
    </mesh>
  );
}

// ── The jackpot vault at the centre ───────────────────────────────────────────────────────
function Vault({ jackpot, drawing }: { jackpot: bigint; drawing: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.y += drawing ? 0.06 : 0.006;
    const s = 1 + Math.sin(state.clock.elapsedTime * 2) * (drawing ? 0.12 : 0.03);
    m.scale.set(s, s, s);
  });
  return (
    <group>
      <mesh ref={ref}>
        <torusKnotGeometry args={[0.85, 0.26, 160, 24]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={drawing ? 1.2 : 0.6} metalness={0.9} roughness={0.1} />
      </mesh>
      <Html center distanceFactor={9} position={[0, -1.7, 0]}>
        <div style={{ textAlign: "center", color: "#fff", fontFamily: "system-ui", whiteSpace: "nowrap", pointerEvents: "none" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.7 }}>JACKPOT</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: GOLD }}>{fromUnits(jackpot)} cUSDT</div>
        </div>
      </Html>
      <Sparkles count={60} scale={4} size={3} speed={0.3} color={GOLD} />
    </group>
  );
}

// The boundary of the circle you dived into — you are literally inside the ring now. Settles from
// a wide sweep on mount so entering a circle reads as passing through its rim.
function EnclosingRing({ drawing }: { drawing: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.z += drawing ? 0.02 : 0.003;
    t.current = Math.min(1, t.current + delta / 0.9);
    const ease = 1 - Math.pow(1 - t.current, 3);
    const s = 1.35 - 0.35 * ease;
    m.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2.4, 0, 0]}>
      <torusGeometry args={[5, 0.11, 20, 140]} />
      <meshStandardMaterial
        color={GOLD}
        emissive={GOLD}
        emissiveIntensity={drawing ? 0.9 : 0.45}
        metalness={0.85}
        roughness={0.2}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function Scene({ tickets, winnerIdx, drawing, jackpot }: { tickets: number; winnerIdx: number; drawing: boolean; jackpot: bigint }) {
  const radius = 3.2;
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 8, 6]} intensity={120} color={GOLD} />
      <pointLight position={[-6, -4, -6]} intensity={80} color={TEAL} />
      <Stars radius={60} depth={40} count={2500} factor={4} fade speed={1} />
      <EnclosingRing drawing={drawing} />
      <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
        <Vault jackpot={jackpot} drawing={drawing} />
      </Float>
      {Array.from({ length: tickets }).map((_, i) => (
        <Ticket key={i} angle={(i / tickets) * Math.PI * 2} radius={radius} winner={winnerIdx === i} drawing={drawing} />
      ))}
      <OrbitControls autoRotate autoRotateSpeed={0.6} enablePan={false} minDistance={5} maxDistance={16} />
    </>
  );
}

/// The 3D "game mode" — a visualization on top of the same on-chain pool. The vault holds the
/// jackpot; each crystal is an encrypted ticket. "Spin the draw" plays the reveal (and fires the
/// real on-chain claim when a round is live).
export function Game({ p, circleName, onExit }: { p: PoolState; circleName?: string; onExit?: () => void }) {
  const [drawing, setDrawing] = useState(false);
  const [winnerIdx, setWinnerIdx] = useState(-1);
  const tickets = Math.max(Number(p.count), 6);

  const spin = async () => {
    setWinnerIdx(-1);
    setDrawing(true);
    if (p.phase === 2 && p.connected) void p.claim(); // fire the real winner payout too
    window.setTimeout(() => {
      setWinnerIdx(Math.floor(Math.random() * tickets));
      setDrawing(false);
    }, 2600);
  };

  return (
    <div className="game dive-in">
      {circleName && (
        <div className="game-topbar">
          {onExit && (
            <button className="ghost sm" onClick={onExit}>
              ← Galaxy
            </button>
          )}
          <span className="game-circle">
            Inside <b>{circleName}</b>
          </span>
        </div>
      )}
      <Canvas camera={{ position: [0, 2.5, 9], fov: 50 }} style={{ background: "transparent" }}>
        <Scene tickets={tickets} winnerIdx={winnerIdx} drawing={drawing} jackpot={p.jackpot} />
      </Canvas>

      <div className="hud">
        <div className="hud-status">
          <span>
            Round <b>#{p.roundId.toString()}</b>
          </span>
          <span className={`phase-${p.phase}`}>{PHASES[p.phase] ?? p.phase}</span>
          <span>
            {tickets} tickets 🔒 · Jackpot <b style={{ color: GOLD }}>{fromUnits(p.jackpot)}</b>
          </span>
        </div>

        <div className="hud-actions">
          {!p.connected ? (
            <button className="primary" onClick={p.connect}>
              Connect Wallet
            </button>
          ) : (
            <>
              <button className="ghost" disabled={!!p.busy} onClick={p.faucet}>
                {p.busy === "faucet" ? "Minting…" : "Mint cUSDT"}
              </button>
              <button className="primary" disabled={!!p.busy || p.phase !== 0} onClick={() => p.deposit(500)}>
                {p.busy === "deposit" ? "Encrypting…" : "Deposit 500 🔒"}
              </button>
              <button className="ghost" disabled={!!p.busy} onClick={p.revealBalance}>
                {p.busy === "reveal" ? "Decrypting…" : p.myBalance === null ? "Reveal balance" : `You: ${fromUnits(p.myBalance)}`}
              </button>
              <button className="gold" disabled={drawing} onClick={spin}>
                {drawing ? "Drawing…" : "🎲 Spin the draw"}
              </button>
            </>
          )}
        </div>

        {winnerIdx >= 0 && !drawing && (
          <div className="winner-banner">🎉 A winner was drawn — reveal your balance to see if it's you (only you can).</div>
        )}
        {p.log[0] && <div className="hud-log">{p.log[0]}</div>}
      </div>
    </div>
  );
}
