import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";

/**
 * MandateClock3D — a CBN CPR 2019 24-hour SLA, in the round.
 *
 * Essence: a dial with the deadline marked. One orb per anchor glides from `postedAt` → `deadline`.
 * At the deadline the orb turns red and pulses — "SLABreached, anyone can call `emitSLABreach`".
 * A replay inside the TTL spawns a second orb in a side bin — "DuplicateRouted, human approval
 * owns the next step".
 */

const GOLD = "#f5c542";
const RUST = "#b8431b";
const CHALK = "#efe8d8";
const INK = "#1b1a16";

function Dial() {
  const points = Array.from({ length: 129 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    return [Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2] as [number, number, number];
  });
  return <Line points={points} color={INK} lineWidth={1.4} transparent opacity={0.5} />;
}

function Tick({ hour }: { hour: number }) {
  const a = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(a) * 2.2;
  const z = Math.sin(a) * 2.2;
  return (
    <Html position={[x, 0.1, z]} center style={{ pointerEvents: "none" }}>
      <div
        style={{
          color: INK,
          fontSize: 10,
          fontFamily: "ui-monospace, monospace",
          opacity: 0.6,
        }}
      >
        {hour}h
      </div>
    </Html>
  );
}

function AnchorOrb({ progress, breached }: { progress: number; breached: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    if (breached) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      ref.current.scale.set(pulse, pulse, pulse);
    }
  });
  const a = (progress * 24 / 24) * Math.PI * 2 - Math.PI / 2;
  return (
    <mesh ref={ref} position={[Math.cos(a) * 2.2, 0.25, Math.sin(a) * 2.2]}>
      <sphereGeometry args={[0.14, 20, 20]} />
      <meshStandardMaterial
        color={breached ? RUST : GOLD}
        emissive={breached ? RUST : GOLD}
        emissiveIntensity={breached ? 0.9 : 0.5}
      />
    </mesh>
  );
}

function DuplicateBin({ count }: { count: number }) {
  return (
    <group position={[3.4, 0.2, 0]}>
      <mesh>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshStandardMaterial color={CHALK} opacity={0.3} transparent />
      </mesh>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[(i - count / 2) * 0.14, 0.3 + i * 0.03, 0]}>
          <sphereGeometry args={[0.08, 14, 14]} />
          <meshStandardMaterial color={RUST} emissive={RUST} emissiveIntensity={0.4} />
        </mesh>
      ))}
      <Html position={[0, 0.9, 0]} center style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(27, 26, 22, 0.78)",
            color: CHALK,
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
          }}
        >
          DuplicateRouted · {count}
        </div>
      </Html>
    </group>
  );
}

export function MandateScene3DOperable() {
  const [progress, setProgress] = useState(0.1); // fraction of the SLA elapsed
  const [replays, setReplays] = useState(0);

  const breached = progress >= 1;

  const advanceHour = () => setProgress((p) => Math.min(1, p + 1 / 24));
  const replay = () => setReplays((c) => c + 1);
  const reset = () => {
    setProgress(0.1);
    setReplays(0);
  };

  return (
    <div className="scene-wrap">
      <div className="scene">
        <Canvas camera={{ position: [4.5, 4, 4.5], fov: 50 }} flat>
          <color attach="background" args={["#f2ede0"]} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[4, 6, 4]} intensity={1.6} />
          <OrbitControls enablePan={false} />
          <Dial />
          {[0, 6, 12, 18].map((h) => (
            <Tick key={h} hour={h} />
          ))}
          <AnchorOrb progress={progress} breached={breached} />
          <DuplicateBin count={replays} />
          <Html position={[0, 1.6, 0]} center style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "rgba(239, 232, 216, 0.9)",
                color: INK,
                padding: "4px 10px",
                borderRadius: 10,
                fontSize: 11,
                fontFamily: "ui-sans-serif, system-ui",
                whiteSpace: "nowrap",
              }}
            >
              {Math.round(progress * 24)}h of 24h · {breached ? "SLABreached" : "Posted"}
            </div>
          </Html>
        </Canvas>
      </div>
      <div className="scene-hud">
        <button onClick={advanceHour} disabled={breached} className="hud-btn">
          +1 hour
        </button>
        <button onClick={replay} className="hud-btn">
          replay inside TTL
        </button>
        <button onClick={reset} className="hud-btn hud-btn-ghost">
          reset
        </button>
      </div>
      <p className="scene-caption">
        The orb walks the CBN CPR 2019 24-hour window. At the deadline it pulses red —
        <code> emitSLABreach</code> is permissionless, anyone can fire it. A replay inside the TTL
        is routed to the <code>DuplicateRouted</code> bin on the right rather than auto-settled;
        the server-authored idempotency key makes this routing structural.
      </p>
    </div>
  );
}
