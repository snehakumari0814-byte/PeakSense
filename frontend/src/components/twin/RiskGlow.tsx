"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending } from "three";
import type { Mesh, MeshBasicMaterial } from "three";
import { getRadialGlowTexture } from "@/lib/glowTexture";
import { ZONE_RADIUS } from "@/lib/twinLayout";

const BASE_OPACITY = 0.3;

/**
 * Subtle radial ground glow beneath a locality zone's buildings, tinted by
 * risk color. CRITICAL zones pulse gently — restrained, not flashing.
 */
export default function RiskGlow({ color, pulse }: { color: string; pulse: boolean }) {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulse) return;
    const mesh = ref.current;
    if (!mesh) return;
    const material = mesh.material as MeshBasicMaterial;
    const t = (Math.sin(clock.getElapsedTime() * 1.8) + 1) / 2;
    material.opacity = BASE_OPACITY + t * 0.22;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[ZONE_RADIUS * 2.6, ZONE_RADIUS * 2.6]} />
      <meshBasicMaterial
        map={getRadialGlowTexture()}
        color={color}
        transparent
        opacity={BASE_OPACITY}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
