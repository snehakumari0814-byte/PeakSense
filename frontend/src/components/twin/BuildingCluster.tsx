"use client";

import { useMemo } from "react";
import { createRng } from "@/lib/prng";

type BuildingSpec = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
};

/**
 * Stylized building block cluster for one locality zone.
 *
 * - `density` (0-1) drives how many buildings populate the cluster.
 * - `heightRatio` (demand / peak threshold) drives building height.
 * - `color` is the current risk color (or a neutral tone when the risk
 *   visualization toggle is off).
 */
export default function BuildingCluster({
  seed,
  radius,
  density,
  heightRatio,
  color,
}: {
  seed: string;
  radius: number;
  density: number;
  heightRatio: number;
  color: string;
}) {
  const buildings = useMemo<BuildingSpec[]>(() => {
    const rng = createRng(seed);
    const count = Math.round(8 + Math.min(1, density) * 12);
    const maxHeight = 6 + Math.min(1.3, heightRatio) * 16;
    const specs: BuildingSpec[] = [];

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * (radius * 0.74);
      const width = 1.1 + rng() * 2.1;
      const depth = 1.1 + rng() * 2.1;

      // Mix short/medium/tall structures instead of one continuous curve,
      // so the cluster reads as a varied skyline rather than uniform blocks.
      const tier = rng();
      const tierVariance = tier < 0.35 ? 0.28 + rng() * 0.22 : tier < 0.75 ? 0.55 + rng() * 0.3 : 0.9 + rng() * 0.35;
      const height = Math.max(1.5, maxHeight * tierVariance);

      specs.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        width,
        depth,
        height,
      });
    }
    return specs;
  }, [seed, radius, density, heightRatio]);

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.height / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.width, b.height, b.depth]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.15}
            roughness={0.55}
            metalness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}
