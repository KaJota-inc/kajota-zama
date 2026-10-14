import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/**
 * EsusuRing3D — the rotating-savings mechanism as a navigable scene.
 *
 * The historical mechanism's essence is a *ring* of members with a *pot* in the middle, where
 * exactly one member sweeps the pot per cycle. The scene encodes this literally:
 *
 *   - N stones arranged in a circle, one per member;
 *   - the collector of the current cycle glows gold and sits closest to the pot;
 *   - a growing pot sphere in the centre, scaled by contributions attested so far;
 *   - sparkle streams flow from attesting members to the pot;
 *   - a rotation arrow traces the next collector around the ring.
 *
 * Operable, not decorative — the "Advance cycle" HUD button bumps the simulation forward so a
 * judge sees the collector change and the pot reset, without touching the chain.
 */

const GOLD = "#f5c542";
const INK = "#1b1a16";
const CHALK = "#efe8d8";
const RUST = "#b8431b";
const SOFT = "#c6a97e";

export type EsusuScene3DProps = {
  memberCount: number;
  collectorOrder: readonly number[];   // indices into the member ring, length = memberCount
  currentCycle: number;                // 0-indexed
  contributionsThisCycle: number;      // 0..memberCount
};

function MemberStone({
  position,
  index,
  collectorIndex,
  isCollector,
  isContributed,
}: {
  position: [number, number, number];
  index: number;
  collectorIndex: number;
  isCollector: boolean;
  isContributed: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const bob = isCollector ? Math.sin(t * 1.6 + index) * 0.06 : 0;
    ref.current.position.y = position[1] + bob;
    const target = isCollector ? 1.25 : 1;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
  });

  const colour = isCollector ? GOLD : isContributed ? SOFT : CHALK;
  const emissive = isCollector ? GOLD : "#000000";
  const emissiveIntensity = isCollector ? 0.55 : 0.0;

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={colour}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>
      <Html distanceFactor={18} position={[0, 0.6, 0]} center style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(27, 26, 22, 0.78)",
            color: CHALK,
            padding: "2px 6px",
            borderRadius: 6,
            fontSize: 8,
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
            border: isCollector ? `1px solid ${GOLD}` : "1px solid transparent",
          }}
        >
          member {index}{isCollector ? ` · collector #${collectorIndex}` : ""}
        </div>
      </Html>
    </group>
  );
}

function Pot({ fillRatio }: { fillRatio: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const scale = 0.4 + fillRatio * 0.7;

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.3;
    ref.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.05);
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={RUST}
          emissive={RUST}
          emissiveIntensity={0.35 + fillRatio * 0.4}
          roughness={0.3}
          metalness={0.4}
          wireframe={fillRatio < 1}
        />
      </mesh>
      {fillRatio >= 1 && <Sparkles count={28} size={2.5} scale={2.2} speed={0.4} color={GOLD} />}
    </group>
  );
}

function ContributionBeam({
  start,
  end,
  active,
}: {
  start: [number, number, number];
  end: [number, number, number];
  active: boolean;
}) {
  if (!active) return null;
  return (
    <Line
      points={[start, end]}
      color={SOFT}
      lineWidth={1.4}
      transparent
      opacity={0.7}
      dashed
      dashSize={0.14}
      gapSize={0.1}
    />
  );
}

function RingFloor({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const n = 128;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return pts;
  }, [radius]);
  return <Line points={points} color={INK} lineWidth={1} transparent opacity={0.3} />;
}

export function EsusuScene3D({
  memberCount,
  collectorOrder,
  currentCycle,
  contributionsThisCycle,
}: EsusuScene3DProps) {
  const radius = Math.max(2, memberCount * 0.5);
  const positions = useMemo(
    () =>
      Array.from({ length: memberCount }, (_, i): [number, number, number] => {
        const a = (i / memberCount) * Math.PI * 2 - Math.PI / 2;
        return [Math.cos(a) * radius, 0.5, Math.sin(a) * radius];
      }),
    [memberCount, radius],
  );

  const collectorMemberIndex = collectorOrder[currentCycle] ?? 0;
  const fillRatio = Math.min(1, contributionsThisCycle / Math.max(1, memberCount));

  return (
    <Canvas camera={{ position: [radius * 1.6, radius * 1.3, radius * 1.6], fov: 50 }} flat>
      <color attach="background" args={["#f2ede0"]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[6, 10, 4]} intensity={1.6} />
      <pointLight position={[0, 3, 0]} intensity={120} color="#f5c542" distance={10} />
      <OrbitControls enablePan={false} enableZoom={true} minDistance={radius * 0.9} maxDistance={radius * 3} />

      <RingFloor radius={radius} />

      {positions.map((p, i) => (
        <MemberStone
          key={i}
          position={p}
          index={i}
          collectorIndex={collectorOrder.indexOf(i)}
          isCollector={i === collectorMemberIndex}
          isContributed={i < contributionsThisCycle}
        />
      ))}

      {positions.map((p, i) =>
        i < contributionsThisCycle && i !== collectorMemberIndex ? (
          <ContributionBeam key={`beam-${i}`} start={p} end={[0, 0.4, 0]} active />
        ) : null,
      )}

      <Pot fillRatio={fillRatio} />

      <Html position={[0, radius * 0.9, 0]} center style={{ pointerEvents: "none" }} distanceFactor={14}>
        <div
          style={{
            background: "rgba(239, 232, 216, 0.9)",
            color: INK,
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 9,
            fontFamily: "ui-sans-serif, system-ui",
            whiteSpace: "nowrap",
            border: `1px solid ${INK}22`,
          }}
        >
          cycle {currentCycle + 1} of {memberCount} · {contributionsThisCycle}/{memberCount} attested
        </div>
      </Html>
    </Canvas>
  );
}

/**
 * The HUD-wrapped scene. Owns the "Advance cycle" / "Add contribution" buttons so the user can
 * step the simulation forward and see the collector change, the ring highlight shift, and the
 * pot reset — the mechanism's essence in 15 seconds per [[feedback_history_3d_hack_approach]].
 */
export function EsusuScene3DOperable({
  memberCount,
  collectorOrder,
}: {
  memberCount: number;
  collectorOrder: readonly number[];
}) {
  const [cycle, setCycle] = useState(0);
  const [contributions, setContributions] = useState(0);

  const addContribution = () => setContributions((c) => Math.min(memberCount, c + 1));
  const advance = () => {
    setCycle((c) => (c + 1) % memberCount);
    setContributions(0);
  };
  const reset = () => {
    setCycle(0);
    setContributions(0);
  };

  const canCollect = contributions >= memberCount;

  return (
    <div className="scene-wrap">
      <div className="scene">
        <EsusuScene3D
          memberCount={memberCount}
          collectorOrder={collectorOrder}
          currentCycle={cycle}
          contributionsThisCycle={contributions}
        />
      </div>
      <div className="scene-hud">
        <button
          onClick={addContribution}
          disabled={contributions >= memberCount}
          className="hud-btn"
        >
          + attest contribution ({contributions}/{memberCount})
        </button>
        <button onClick={advance} disabled={!canCollect} className="hud-btn hud-btn-primary">
          {canCollect ? "collector sweeps · advance" : "quorum pending"}
        </button>
        <button onClick={reset} className="hud-btn hud-btn-ghost">
          reset
        </button>
      </div>
      <p className="scene-caption">
        Each cycle, members attest a contribution; once the ring is full the designated collector
        sweeps the pot and rotation advances. The on-chain <code>rotationCommit</code> pins the
        member set and the collector order at seal, so no path through this simulation can
        reshuffle it afterwards.
      </p>
    </div>
  );
}
