"use client";

import { useEffect, useMemo, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
import type { Locality } from "@/types/locality";
import { buildSilhouette, pointInPolygon, type Point } from "@/lib/mumbaiSilhouette";
import { localityScenePosition, GROUND_SIZE, ZONE_RADIUS } from "@/lib/twinLayout";
import { createRng } from "@/lib/prng";

const TARGET_COUNT = 220;
const EXCLUSION_RADIUS = ZONE_RADIUS * 2.1;
const MAX_ATTEMPTS = TARGET_COUNT * 25;

type BuildingSpec = { x: number; z: number; w: number; d: number; h: number };

/**
 * Low-detail neutral buildings scattered across the terrain for visual city
 * density. These are NOT individual real-world buildings and carry no
 * locality data — the 10 backend-driven locality zones remain the only
 * interactive, data-bound elements. Rendered as one InstancedMesh for
 * performance.
 */
export default function BackgroundBuildings({ localities }: { localities: Locality[] }) {
  const meshRef = useRef<InstancedMesh>(null);

  const instances = useMemo<BuildingSpec[]>(() => {
    const polygon = buildSilhouette(localities);
    const zonePositions = localities.map((l) => localityScenePosition(l));
    const rng = createRng("mumbai-background-buildings");
    const specs: BuildingSpec[] = [];

    let attempts = 0;
    while (specs.length < TARGET_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const x = (rng() - 0.5) * GROUND_SIZE * 0.85;
      const z = (rng() - 0.5) * GROUND_SIZE * 0.85;
      const candidate: Point = [x, z];
      if (!pointInPolygon(candidate, polygon)) continue;

      const tooCloseToZone = zonePositions.some(([zx, , zz]) => {
        const dx = zx - x;
        const dz = zz - z;
        return dx * dx + dz * dz < EXCLUSION_RADIUS * EXCLUSION_RADIUS;
      });
      if (tooCloseToZone) continue;

      specs.push({
        x,
        z,
        w: 1 + rng() * 1.8,
        d: 1 + rng() * 1.8,
        h: 1 + rng() * 3.5,
      });
    }

    return specs;
  }, [localities]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new Object3D();
    instances.forEach((spec, i) => {
      dummy.position.set(spec.x, spec.h / 2, spec.z);
      dummy.scale.set(spec.w, spec.h, spec.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [instances]);

  if (instances.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#334155"
        emissive="#1e293b"
        emissiveIntensity={0.35}
        roughness={0.9}
        metalness={0.05}
      />
    </instancedMesh>
  );
}
