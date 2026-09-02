"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Locality } from "@/types/locality";
import { localityScenePosition, GROUND_SIZE } from "@/lib/twinLayout";
import LocalityZone from "@/components/twin/LocalityZone";
import TwinControls from "@/components/twin/TwinControls";

const OVERVIEW_POSITION = new Vector3(0, 195, 245);
const OVERVIEW_TARGET = new Vector3(0, 0, 0);
const TRANSITION_MS = 750;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function CameraRig({
  focus,
  resetToken,
  controlsRef,
}: {
  focus: [number, number, number] | null;
  resetToken: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const anim = useRef<{
    start: number;
    fromPos: Vector3;
    fromTarget: Vector3;
    toPos: Vector3;
    toTarget: Vector3;
  } | null>(null);
  const lastKey = useRef<string>("");

  const key = `${focus ? focus.join(",") : "overview"}::${resetToken}`;

  if (key !== lastKey.current) {
    lastKey.current = key;
    const controls = controlsRef.current;
    const fromPos = camera.position.clone();
    const fromTarget = controls ? controls.target.clone() : OVERVIEW_TARGET.clone();
    const toPos = focus
      ? new Vector3(focus[0] + 34, 30, focus[2] + 46)
      : OVERVIEW_POSITION.clone();
    const toTarget = focus ? new Vector3(focus[0], 6, focus[2]) : OVERVIEW_TARGET.clone();
    anim.current = { start: performance.now(), fromPos, fromTarget, toPos, toTarget };
  }

  useFrame(() => {
    const controls = controlsRef.current;
    const a = anim.current;
    if (!controls || !a) return;

    const elapsed = performance.now() - a.start;
    const t = Math.min(1, elapsed / TRANSITION_MS);
    const eased = easeInOutCubic(t);

    camera.position.lerpVectors(a.fromPos, a.toPos, eased);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, eased);
    controls.update();

    if (t >= 1) {
      anim.current = null;
    }
  });

  return null;
}

function Scene({
  localities,
  selectedId,
  showRisk,
  onSelect,
  focus,
  resetToken,
}: {
  localities: Locality[];
  selectedId: string | null;
  showRisk: boolean;
  onSelect: (id: string) => void;
  focus: [number, number, number] | null;
  resetToken: number;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <>
      <color attach="background" args={["#0b1120"]} />
      <fog attach="fog" args={["#0b1120", 220, 420]} />

      <hemisphereLight args={["#334155", "#0f172a", 0.55]} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#0a0f1e" roughness={1} metalness={0} />
      </mesh>

      <Grid
        position={[0, 0, 0]}
        args={[GROUND_SIZE, GROUND_SIZE]}
        cellSize={8}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={40}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={260}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {localities.map((locality) => (
        <LocalityZone
          key={locality.id}
          locality={locality}
          position={localityScenePosition(locality)}
          selected={locality.id === selectedId}
          showRisk={showRisk}
          onSelect={() => onSelect(locality.id)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={40}
        maxDistance={420}
        maxPolarAngle={Math.PI / 2.15}
      />
      <CameraRig focus={focus} resetToken={resetToken} controlsRef={controlsRef} />
    </>
  );
}

export default function MumbaiDigitalTwin({
  localities,
  selectedId,
  onSelect,
  onReset,
}: {
  localities: Locality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReset: () => void;
}) {
  const [showRisk, setShowRisk] = useState(true);
  const [resetToken, setResetToken] = useState(0);

  const focus = useMemo<[number, number, number] | null>(() => {
    if (!selectedId) return null;
    const locality = localities.find((l) => l.id === selectedId);
    if (!locality) return null;
    return localityScenePosition(locality);
  }, [selectedId, localities]);

  const handleReset = () => {
    onReset();
    setResetToken((n) => n + 1);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <Canvas shadows camera={{ position: [0, 195, 245], fov: 42, near: 1, far: 1200 }}>
        <Scene
          localities={localities}
          selectedId={selectedId}
          showRisk={showRisk}
          onSelect={onSelect}
          focus={focus}
          resetToken={resetToken}
        />
      </Canvas>

      <TwinControls showRisk={showRisk} onToggleRisk={() => setShowRisk((v) => !v)} onReset={handleReset} />
    </div>
  );
}
