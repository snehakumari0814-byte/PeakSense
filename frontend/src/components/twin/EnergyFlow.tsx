"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";

/**
 * A single restrained pulsing ring representing live energy activity at a
 * locality zone. Pulse speed scales gently with risk intensity — kept
 * subtle on purpose (control-system feel, not a game effect).
 */
export default function EnergyFlow({
  radius,
  color,
  intensity,
}: {
  radius: number;
  color: string;
  intensity: number;
}) {
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ringRef.current;
    if (!mesh) return;
    const speed = 0.6 + intensity * 0.9;
    const t = clock.getElapsedTime() * speed;
    const pulse = (Math.sin(t) + 1) / 2;
    const material = mesh.material as MeshStandardMaterial;
    material.opacity = 0.12 + pulse * 0.18 * (0.4 + intensity);
    const scale = 1 + pulse * 0.04;
    mesh.scale.set(scale, 1, scale);
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[radius * 0.82, radius * 0.9, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        transparent
        opacity={0.2}
        depthWrite={false}
      />
    </mesh>
  );
}
