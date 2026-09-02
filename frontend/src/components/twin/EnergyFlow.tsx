"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Vector3 } from "three";
import type { Mesh } from "three";
import type { NetworkEdge } from "@/lib/energyNetwork";

const FLOW_COLOR = "#2dd4bf";
const PARTICLE_COLOR = "#a5f3fc";
const FLOW_HEIGHT = 1.1;
const PARTICLE_OFFSETS = [0, 0.33, 0.66];

/**
 * Simple visual/prototype electricity-flow lines between locality zones,
 * with a few glowing particles animating along each line. A wider, dimmer
 * line sits behind the bright core line to fake a soft glow without a
 * post-processing dependency. Restrained on purpose — this communicates
 * "power is moving through the city," not a real grid simulation.
 */
function FlowParticle({
  from,
  to,
  speed,
  offset,
}: {
  from: Vector3;
  to: Vector3;
  speed: number;
  offset: number;
}) {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    mesh.position.lerpVectors(from, to, t);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.55, 8, 8]} />
      <meshStandardMaterial
        color={PARTICLE_COLOR}
        emissive={PARTICLE_COLOR}
        emissiveIntensity={1.8}
      />
    </mesh>
  );
}

export default function EnergyFlow({ edges }: { edges: NetworkEdge[] }) {
  return (
    <group>
      {edges.map((edge) => {
        const from = new Vector3(edge.from[0], FLOW_HEIGHT, edge.from[2]);
        const to = new Vector3(edge.to[0], FLOW_HEIGHT, edge.to[2]);
        const speed = 0.05 + edge.intensity * 0.2;
        const particleCount = edge.intensity > 0.55 ? 3 : 2;

        return (
          <group key={edge.id}>
            {/* Soft halo line */}
            <Line
              points={[from, to]}
              color={FLOW_COLOR}
              lineWidth={4}
              transparent
              opacity={0.06 + edge.intensity * 0.06}
            />
            {/* Bright core line */}
            <Line
              points={[from, to]}
              color={FLOW_COLOR}
              lineWidth={1.25}
              transparent
              opacity={0.32 + edge.intensity * 0.32}
            />
            {PARTICLE_OFFSETS.slice(0, particleCount).map((offset) => (
              <FlowParticle key={offset} from={from} to={to} speed={speed} offset={offset} />
            ))}
          </group>
        );
      })}
    </group>
  );
}
