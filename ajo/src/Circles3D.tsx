import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float, Html, Sparkles, Line } from "@react-three/drei";
import * as THREE from "three";
import { CUSDT_DECIMALS, STATUS } from "./config";
import type { Circle } from "./circleStore";

const GOLD = "#f5c542";
const TEAL = "#39d0c8";
const WARN = "#f0917f";
const DIM = "#6b6350";

type CircleState = { phase: number; round: bigint; jackpot: bigint; depositors: bigint; flags: number; loaded: boolean };
const fmt = (v: bigint) => (Number(v) / 10 ** CUSDT_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 0 });

// One circle = one glowing ring. Radius scales with the jackpot; colour encodes the trust rating.
function CircleRing({
  circle,
  st,
  pos,
  active,
  onEnter,
}: {
  circle: Circle;
  st?: CircleState;
  pos: [number, number, number];
  active: boolean;
  onEnter: (a: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);

  const flagged = !!st && st.flags > 0;
  const color = !st ? DIM : flagged ? WARN : GOLD;
  const savers = st ? Math.max(Number(st.depositors), 1) : 1;
  // jackpot → ring size (log-compressed so a whale circle doesn't dwarf the rest)
  const jack = st ? Number(st.jackpot) / 10 ** CUSDT_DECIMALS : 0;
  const R = 0.62 + Math.log10(1 + jack) * 0.26 + (active ? 0.16 : 0);

  useFrame((state) => {
    const g = ref.current;
    if (g) {
      const s = active ? 1.12 : hover ? 1.08 : 1;
      g.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
      g.position.y = pos[1] + Math.sin(state.clock.elapsedTime * 0.7 + pos[0]) * 0.12;
    }
    if (ring.current) {
      ring.current.rotation.z += flagged ? 0.02 : 0.008;
      ring.current.rotation.x = Math.PI / 2.6;
    }
  });

  const enter = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!active) onEnter(circle.address);
  };
  const over = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHover(false);
    document.body.style.cursor = "auto";
  };

  return (
    <group ref={ref} position={pos}>
      {/* invisible disc filling the ring so the whole circle is an easy click/dive target */}
      <mesh rotation={[Math.PI / 2.6, 0, 0]} onClick={enter} onPointerOver={over} onPointerOut={out}>
        <circleGeometry args={[R * 1.02, 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* the ring itself — a literal 3D circle */}
      <mesh ref={ring} onClick={enter} onPointerOver={over} onPointerOut={out}>
        <torusGeometry args={[R, active ? 0.1 : 0.07, 24, 96]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.5 : hover ? 1.1 : 0.7}
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>

      {/* encrypted savers orbiting inside the ring */}
      {Array.from({ length: Math.min(savers, 8) }).map((_, i) => (
        <Saver key={i} idx={i} total={Math.min(savers, 8)} R={R} color={color} />
      ))}

      {active && <Sparkles count={26} scale={R * 2.4} size={3} speed={0.5} color={GOLD} />}

      <Html center distanceFactor={12} position={[0, R + 0.5, 0]}>
        <div className={`ring-label${active ? " active" : ""}`} onClick={() => !active && onEnter(circle.address)}>
          <div className="rl-name">{circle.name}</div>
          <div className="rl-meta">
            {st ? (
              <>
                <span style={{ color: GOLD }}>{fmt(st.jackpot)} coins</span>
                <span className="rl-dot">·</span>
                <span>{STATUS[st.phase]}</span>
                <span className="rl-dot">·</span>
                <span style={{ color: flagged ? WARN : TEAL }}>{flagged ? `⚠ flagged ${st.flags}` : "✓ trusted"}</span>
              </>
            ) : (
              <span style={{ opacity: 0.6 }}>reading chain…</span>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
}

function Saver({ idx, total, R, color }: { idx: number; total: number; R: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const a0 = (idx / total) * Math.PI * 2;
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const a = a0 + state.clock.elapsedTime * 0.4;
    m.position.x = Math.cos(a) * R * 0.62;
    m.position.y = Math.sin(a) * R * 0.62;
    m.rotation.x += 0.03;
    m.rotation.y += 0.02;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.07, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.6} roughness={0.2} />
    </mesh>
  );
}

// The nucleus — the shared trust circle every ring is a spoke of.
function Nucleus() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.004;
  });
  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.7} metalness={0.9} roughness={0.1} wireframe />
      </mesh>
      <Sparkles count={40} scale={2} size={2} speed={0.25} color={TEAL} />
      <Html center distanceFactor={13} position={[0, -0.95, 0]}>
        <div className="nucleus-label">TRUST CIRCLE</div>
      </Html>
    </group>
  );
}

function Scene({
  circles,
  state,
  current,
  onEnter,
}: {
  circles: Circle[];
  state: Record<string, CircleState>;
  current: string;
  onEnter: (a: string) => void;
}) {
  const positions = useMemo(() => {
    const N = circles.length;
    const ORBIT = Math.max(3.4, 2.2 + N * 0.55);
    return circles.map((_, i) => {
      const a = (i / N) * Math.PI * 2;
      return [Math.cos(a) * ORBIT, Math.sin(i * 1.7) * 0.6, Math.sin(a) * ORBIT] as [number, number, number];
    });
  }, [circles]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 8, 6]} intensity={130} color={GOLD} />
      <pointLight position={[-6, -4, -6]} intensity={90} color={TEAL} />
      <Stars radius={70} depth={45} count={3000} factor={4} fade speed={1} />

      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <Nucleus />
      </Float>

      {circles.map((c, i) => {
        const st = state[c.address];
        const flagged = !!st && st.flags > 0;
        return (
          <group key={c.address}>
            {/* spoke: every circle is part of the one trust circle */}
            <Line
              points={[[0, 0, 0], positions[i]]}
              color={!st ? DIM : flagged ? WARN : GOLD}
              lineWidth={1}
              transparent
              opacity={0.22}
            />
            <CircleRing
              circle={c}
              st={st}
              pos={positions[i]}
              active={c.address.toLowerCase() === current.toLowerCase()}
              onEnter={onEnter}
            />
          </group>
        );
      })}

      <OrbitControls autoRotate autoRotateSpeed={0.5} enablePan={false} minDistance={6} maxDistance={22} />
    </>
  );
}

export function Circles3D({
  circles,
  state,
  current,
  onEnter,
}: {
  circles: Circle[];
  state: Record<string, CircleState>;
  current: string;
  onEnter: (a: string) => void;
}) {
  return (
    <div className="galaxy">
      <Canvas camera={{ position: [0, 1.4, 11], fov: 52 }} style={{ background: "transparent" }}>
        <Scene circles={circles} state={state} current={current} onEnter={onEnter} />
      </Canvas>
      <div className="galaxy-hint">Drag to orbit · click a ring to enter that circle</div>
    </div>
  );
}
