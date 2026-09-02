"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Locality } from "@/types/locality";
import type { ForecastResponse } from "@/types/forecast";
import { localityScenePosition } from "@/lib/twinLayout";
import { buildEnergyNetwork } from "@/lib/energyNetwork";
import LocalityZone from "@/components/twin/LocalityZone";
import EnergyFlow from "@/components/twin/EnergyFlow";
import MumbaiTerrain from "@/components/twin/MumbaiTerrain";
import BackgroundBuildings from "@/components/twin/BackgroundBuildings";
import TwinControls, { type LayerKey } from "@/components/twin/TwinControls";
import ViewportControls from "@/components/twin/ViewportControls";

const OVERVIEW_POSITION = new Vector3(0, 195, 245);
const OVERVIEW_TARGET = new Vector3(0, 0, 0);
const TRANSITION_MS = 750;
const ZOOM_FACTOR = 0.82;

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  flow: true,
  riskHeat: true,
  demand: true,
  solar: false,
};

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
  forecasts,
  selectedId,
  layers,
  onSelect,
  focus,
  resetToken,
  controlsRef,
}: {
  localities: Locality[];
  forecasts?: Record<string, ForecastResponse>;
  selectedId: string | null;
  layers: Record<LayerKey, boolean>;
  onSelect: (id: string) => void;
  focus: [number, number, number] | null;
  resetToken: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const edges = useMemo(
    () => buildEnergyNetwork(localities, forecasts),
    [localities, forecasts],
  );

  return (
    <>
      <color attach="background" args={["#0b1120"]} />
      <fog attach="fog" args={["#0b1120", 260, 520]} />

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

      <MumbaiTerrain localities={localities} />
      <BackgroundBuildings localities={localities} />

      {layers.flow && <EnergyFlow edges={edges} />}

      {localities.map((locality) => (
        <LocalityZone
          key={locality.id}
          locality={locality}
          forecast={forecasts?.[locality.id]}
          position={localityScenePosition(locality)}
          selected={locality.id === selectedId}
          showRiskHeat={layers.riskHeat}
          showDemand={layers.demand}
          showSolar={layers.solar}
          onSelect={() => onSelect(locality.id)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={40}
        maxDistance={480}
        maxPolarAngle={Math.PI / 2.15}
      />
      <CameraRig focus={focus} resetToken={resetToken} controlsRef={controlsRef} />
    </>
  );
}

export default function MumbaiDigitalTwin({
  localities,
  forecasts,
  backendStatus = "live",
  selectedId,
  onSelect,
  onReset,
}: {
  localities: Locality[];
  forecasts?: Record<string, ForecastResponse>;
  backendStatus?: "live" | "fallback" | "checking";
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReset: () => void;
}) {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [resetToken, setResetToken] = useState(0);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

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

  const handleToggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const zoomBy = (factor: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    const direction = camera.position.clone().sub(controls.target).multiplyScalar(factor);
    camera.position.copy(controls.target).add(direction);
    controls.update();
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <Canvas shadows camera={{ position: [0, 195, 245], fov: 42, near: 1, far: 1400 }}>
        <Scene
          localities={localities}
          forecasts={forecasts}
          selectedId={selectedId}
          layers={layers}
          onSelect={onSelect}
          focus={focus}
          resetToken={resetToken}
          controlsRef={controlsRef}
        />
      </Canvas>

      <TwinControls
        layers={layers}
        backendStatus={backendStatus}
        onToggleLayer={handleToggleLayer}
        onReset={handleReset}
      />
      <ViewportControls
        onZoomIn={() => zoomBy(ZOOM_FACTOR)}
        onZoomOut={() => zoomBy(1 / ZOOM_FACTOR)}
        onResetOrientation={handleReset}
      />
    </div>
  );
}
