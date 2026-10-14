import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * SakkSeal3D — a cross-city sealed instruction, modernised on-chain.
 *
 * Essence: a wax-sealed envelope that opens only when the witness quorum attests. The scene
 * places the sealed cube at the centre; three witness pillars surround it. Each click on a
 * pillar lights that witness; when the quorum (2-of-3 by default) is met, the seal breaks
 * open with a sparkle release.
 */

const GOLD = "#f5c542";
const RUST = "#b8431b";
const CHALK = "#efe8d8";
const INK = "#1b1a16";

function SealCube({ opened }: { opened: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.35;
    const target = opened ? 1.3 : 1;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
  });
  return (
    <mesh ref={ref} position={[0, 0.6, 0]}>
      <boxGeometry args={[0.9, 0.9, 0.9]} />
      <meshStandardMaterial
        color={opened ? GOLD : RUST}
        emissive={opened ? GOLD : RUST}
        emissiveIntensity={opened ? 0.6 : 0.3}
        wireframe={opened}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  );
}

function WitnessPillar({
  position,
  index,
  attested,
  onAttest,
}: {
  position: [number, number, number];
  index: number;
  attested: boolean;
  onAttest: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const target = attested ? 1 : 0.9;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1);
  });
  return (
    <group position={position}>
      <mesh ref={ref} onClick={onAttest}>
        <cylinderGeometry args={[0.22, 0.22, 1.2, 20]} />
        <meshStandardMaterial
          color={attested ? GOLD : CHALK}
          emissive={attested ? GOLD : "#000"}
          emissiveIntensity={attested ? 0.4 : 0}
        />
      </mesh>
      <Html distanceFactor={10} position={[0, 0.9, 0]} center style={{ pointerEvents: "none" }}>
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
          witness {index}{attested ? " · attested" : ""}
        </div>
      </Html>
    </group>
  );
}

export function SakkScene3DOperable({ quorum = 2, witnessCount = 3 }: { quorum?: number; witnessCount?: number }) {
  const [attestations, setAttestations] = useState<boolean[]>(() => Array(witnessCount).fill(false));
  const attested = attestations.filter(Boolean).length;
  const opened = attested >= quorum;

  const toggle = (i: number) => {
    setAttestations((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };
  const reset = () => setAttestations(Array(witnessCount).fill(false));

  const positions: [number, number, number][] = Array.from({ length: witnessCount }, (_, i) => {
    const a = (i / witnessCount) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * 2, 0.6, Math.sin(a) * 2];
  });

  return (
    <div className="scene-wrap">
      <div className="scene">
        <Canvas camera={{ position: [3.5, 3, 3.5], fov: 50 }} flat>
          <color attach="background" args={["#f2ede0"]} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[4, 6, 4]} intensity={1.6} />
          <pointLight position={[0, 2, 0]} intensity={100} color="#f5c542" distance={10} />
          <OrbitControls enablePan={false} />
          <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.2}>
            <SealCube opened={opened} />
          </Float>
          {positions.map((p, i) => (
            <WitnessPillar
              key={i}
              position={p}
              index={i}
              attested={attestations[i] ?? false}
              onAttest={() => toggle(i)}
            />
          ))}
          <Html position={[0, 2, 0]} center style={{ pointerEvents: "none" }}>
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
              {attested}/{witnessCount} attested · quorum {quorum} · {opened ? "SEAL OPEN" : "SEAL CLOSED"}
            </div>
          </Html>
        </Canvas>
      </div>
      <div className="scene-hud">
        <span className="hud-caption">click any pillar to attest</span>
        <button onClick={reset} className="hud-btn hud-btn-ghost">reset</button>
      </div>
      <p className="scene-caption">
        The sealed cube opens only once the witness quorum attests. Replay fails by status; a
        forged pre-image fails by hash. The historical sakk died when cross-city coordination
        collapsed under Mongol-era trade disruption; on-chain witnessing fixes both failure
        modes.
      </p>
    </div>
  );
}
