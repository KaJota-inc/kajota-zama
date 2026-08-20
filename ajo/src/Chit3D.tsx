import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float, Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { fromUnits } from "./useMechanism";

const GOLD = "#f5c542";
const TEAL = "#39d0c8";

// One sealed bid — a locked crystal orbiting the pot. Anonymous and encrypted until the gavel falls;
// on settle, the winner erupts gold and the rest dim as they share the discount.
function BidCrystal({ i, total, settled, winner }: { i: number; total: number; settled: boolean; winner: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const a0 = (i / Math.max(total, 1)) * Math.PI * 2;
  const r = 3;
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const a = a0 + s.clock.elapsedTime * 0.25;
    m.position.x = Math.cos(a) * r;
    m.position.z = Math.sin(a) * r;
    m.position.y = settled && winner ? THREE.MathUtils.lerp(m.position.y, 1.4, 0.06) : Math.sin(s.clock.elapsedTime + i) * 0.25;
    m.rotation.x += 0.02;
    m.rotation.y += 0.015;
    const target = settled ? (winner ? 2.4 : 0.55) : 1;
    m.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
    if (settled) {
      const c = winner ? GOLD : "#3a3630";
      mat.color.lerp(new THREE.Color(c), 0.08);
      mat.emissive.lerp(new THREE.Color(c), 0.08);
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, winner ? 2 : 0.1, 0.08);
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, winner ? 1 : 0.35, 0.08);
    }
  });
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.5} metalness={0.7} roughness={0.2} transparent opacity={0.9} />
      {settled && winner && <Sparkles count={40} scale={2.5} size={4} speed={0.7} color={GOLD} />}
    </mesh>
  );
}

function Pot({ pot }: { pot: bigint }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y += 0.006;
    if (ref.current) {
      const sc = 1 + Math.sin(s.clock.elapsedTime * 1.5) * 0.03;
      ref.current.scale.set(sc, sc, sc);
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <torusKnotGeometry args={[0.8, 0.24, 140, 20]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} metalness={0.9} roughness={0.12} />
      </mesh>
      <Html center distanceFactor={9} position={[0, -1.6, 0]}>
        <div style={{ textAlign: "center", color: "#fff", fontFamily: "system-ui", whiteSpace: "nowrap", pointerEvents: "none" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.7 }}>POT</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: GOLD }}>{fromUnits(pot)} coins</div>
        </div>
      </Html>
      <Sparkles count={50} scale={3.5} size={3} speed={0.3} color={GOLD} />
    </group>
  );
}

export function Chit3D({ pot, bidders, settled }: { pot: bigint; bidders: number; settled: boolean }) {
  const n = Math.max(bidders, 4);
  const winnerIdx = useMemo(() => (settled ? 0 : -1), [settled]);
  return (
    <div className="galaxy" style={{ height: "min(56vh, 460px)" }}>
      <Canvas camera={{ position: [0, 2.5, 8], fov: 52 }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[6, 8, 6]} intensity={120} color={GOLD} />
        <pointLight position={[-6, -4, -6]} intensity={70} color={TEAL} />
        <Stars radius={60} depth={40} count={2200} factor={4} fade speed={1} />
        <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.5}>
          <Pot pot={pot} />
        </Float>
        {Array.from({ length: n }).map((_, i) => (
          <BidCrystal key={i} i={i} total={n} settled={settled} winner={winnerIdx === i} />
        ))}
        <OrbitControls autoRotate autoRotateSpeed={0.5} enablePan={false} minDistance={5} maxDistance={16} />
      </Canvas>
      <div className="galaxy-hint">
        {settled ? "gavel down — the highest sealed bid won the pot" : "sealed bids orbit the pot · nobody can read them"}
      </div>
    </div>
  );
}
