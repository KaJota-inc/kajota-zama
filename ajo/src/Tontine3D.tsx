import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float, Html, Sparkles, Line } from "@react-three/drei";
import * as THREE from "three";
import { fromUnits } from "./useMechanism";

const TEAL = "#39d0c8";
const GOLD = "#f5c542";
const ASH = "#38332b";

// One member node around the dividend core. Active members glow and feed the core; when a member
// exits it dims and disconnects — and because the pot is split among fewer, the survivors brighten.
function Member({ i, total, active, survivors }: { i: number; total: number; active: boolean; survivors: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const a = (i / Math.max(total, 1)) * Math.PI * 2;
  const R = 3;
  const pos: [number, number, number] = [Math.cos(a) * R, Math.sin(i * 1.3) * 0.4, Math.sin(a) * R];
  // fewer survivors ⇒ each one shines brighter (the growing dividend)
  const glow = active ? 0.6 + 1.4 / Math.max(survivors, 1) : 0.05;
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.y += 0.01;
    m.position.y = pos[1] + Math.sin(s.clock.elapsedTime * 0.8 + i) * 0.12;
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, glow, 0.06);
    mat.color.lerp(new THREE.Color(active ? TEAL : ASH), 0.06);
    mat.emissive.lerp(new THREE.Color(active ? TEAL : ASH), 0.06);
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, active ? 1 : 0.4, 0.06);
    const sc = active ? 1 : 0.6;
    m.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.06);
  });
  return (
    <group>
      {active && <Line points={[[0, 0, 0], pos]} color={TEAL} lineWidth={1} transparent opacity={0.25} />}
      <mesh ref={ref} position={pos}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.6} metalness={0.6} roughness={0.2} transparent opacity={1} />
      </mesh>
    </group>
  );
}

function Core({ acc }: { acc: bigint }) {
  const ref = useRef<THREE.Mesh>(null);
  const size = 0.5 + Math.min(Number(fromUnits(acc)) / 1000, 1.4) * 0.5; // grows with the dividend
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.y += 0.005;
    const p = size * (1 + Math.sin(s.clock.elapsedTime * 1.8) * 0.05);
    ref.current.scale.set(p, p, p);
  });
  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.7} metalness={0.9} roughness={0.1} wireframe />
      </mesh>
      <Sparkles count={40} scale={2.2} size={3} speed={0.3} color={GOLD} />
      <Html center distanceFactor={10} position={[0, -1.5, 0]}>
        <div style={{ textAlign: "center", color: "#fff", fontFamily: "system-ui", whiteSpace: "nowrap", pointerEvents: "none" }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.7 }}>DIVIDEND / SURVIVOR</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{fromUnits(acc)} coins</div>
        </div>
      </Html>
    </group>
  );
}

export function Tontine3D({ activeCount, members, acc }: { activeCount: number; members: number; acc: bigint }) {
  const total = Math.max(members, 5);
  return (
    <div className="galaxy" style={{ height: "min(56vh, 460px)" }}>
      <Canvas camera={{ position: [0, 2.5, 8.5], fov: 52 }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[6, 8, 6]} intensity={110} color={GOLD} />
        <pointLight position={[-6, -4, -6]} intensity={80} color={TEAL} />
        <Stars radius={60} depth={40} count={2200} factor={4} fade speed={1} />
        <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.4}>
          <Core acc={acc} />
        </Float>
        {Array.from({ length: total }).map((_, i) => (
          <Member key={i} i={i} total={total} active={i < activeCount} survivors={Math.max(activeCount, 1)} />
        ))}
        <OrbitControls autoRotate autoRotateSpeed={0.45} enablePan={false} minDistance={5} maxDistance={18} />
      </Canvas>
      <div className="galaxy-hint">{activeCount} survivor{activeCount === 1 ? "" : "s"} sharing the dividend · fewer survivors, brighter each</div>
    </div>
  );
}
