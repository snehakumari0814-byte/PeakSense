"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Locality } from "@/types/locality";
import type { ForecastResponse } from "@/types/forecast";
import type { ScenePosition } from "@/lib/twinLayout";
import { ZONE_RADIUS } from "@/lib/twinLayout";
import { demandRatio, riskLevel, RISK_COLORS, type RiskLevel } from "@/lib/risk";
import BuildingCluster from "@/components/twin/BuildingCluster";
import LocalityOverlay from "@/components/twin/LocalityOverlay";
import RiskGlow from "@/components/twin/RiskGlow";

const NEUTRAL_COLOR = "#64748b";
const SOLAR_COLOR = "#fbbf24";
const BASELINE_HEIGHT_RATIO = 0.4;

export default function LocalityZone({
  locality,
  forecast,
  position,
  selected,
  showRiskHeat,
  showDemand,
  showSolar,
  onSelect,
}: {
  locality: Locality;
  forecast?: ForecastResponse;
  position: ScenePosition;
  selected: boolean;
  showRiskHeat: boolean;
  showDemand: boolean;
  showSolar: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  // Live risk from ML forecast endpoint (falls back to ratio calculation if forecast is not yet loaded)
  const risk: RiskLevel = forecast?.peakAnalysis?.risk ?? riskLevel(locality);
  const currentDemand = forecast?.summary?.currentLoadMw ?? locality.current_demand_mw;
  const peakThreshold = forecast?.peakAnalysis?.thresholdMw ?? locality.peak_threshold_mw;
  const ratio = peakThreshold > 0 ? currentDemand / peakThreshold : demandRatio(locality);

  const riskColor = RISK_COLORS[risk];
  const buildingColor = showRiskHeat ? riskColor : NEUTRAL_COLOR;
  const density = locality.residential_share + locality.commercial_share;
  const hasSolar = showSolar && locality.solar_capacity_mw >= 2;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const targetScale = selected ? 1.12 : hovered ? 1.04 : 1;
    const next = group.scale.x + (targetScale - group.scale.x) * 0.15;
    group.scale.setScalar(next);
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Zone pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ZONE_RADIUS, 48]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.05} />
      </mesh>

      {showRiskHeat && <RiskGlow color={riskColor} pulse={risk === "CRITICAL"} />}

      {/* Boundary ring — explicitly stylized, not an official zone boundary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[ZONE_RADIUS - 1.4, ZONE_RADIUS, 64]} />
        <meshBasicMaterial
          color={selected ? "#34d399" : buildingColor}
          transparent
          opacity={selected ? 0.18 : 0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[ZONE_RADIUS - 0.4, ZONE_RADIUS, 64]} />
        <meshBasicMaterial
          color={selected ? "#34d399" : buildingColor}
          transparent
          opacity={selected ? 0.9 : 0.45}
        />
      </mesh>

      <BuildingCluster
        seed={locality.id}
        radius={ZONE_RADIUS}
        density={density}
        heightRatio={showDemand ? ratio : BASELINE_HEIGHT_RATIO}
        color={buildingColor}
      />

      {hasSolar && (
        <mesh position={[0, 0.3, ZONE_RADIUS * 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.1, 16]} />
          <meshStandardMaterial
            color={SOLAR_COLOR}
            emissive={SOLAR_COLOR}
            emissiveIntensity={0.8}
          />
        </mesh>
      )}

      <group position={[0, 20, 0]}>
        <LocalityOverlay
          name={locality.name}
          risk={risk}
          color={riskColor}
          selected={selected}
          showRisk={showRiskHeat}
        />
      </group>
    </group>
  );
}
