"use client";

import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Locality } from "@/types/locality";
import { buildSilhouette, type Point } from "@/lib/mumbaiSilhouette";
import { GROUND_SIZE } from "@/lib/twinLayout";
import { createRng } from "@/lib/prng";

const TEXTURE_SIZE = 1024;

function sceneToCanvas(x: number, z: number): [number, number] {
  const u = (x / GROUND_SIZE + 0.5) * TEXTURE_SIZE;
  const v = (z / GROUND_SIZE + 0.5) * TEXTURE_SIZE;
  return [u, v];
}

function generateTerrainTexture(polygon: Point[]): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Dark water base with a faint vignette for depth.
  const water = ctx.createRadialGradient(
    TEXTURE_SIZE / 2,
    TEXTURE_SIZE / 2,
    TEXTURE_SIZE * 0.1,
    TEXTURE_SIZE / 2,
    TEXTURE_SIZE / 2,
    TEXTURE_SIZE * 0.75,
  );
  water.addColorStop(0, "#0c1830");
  water.addColorStop(1, "#050a18");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  if (polygon.length >= 3) {
    ctx.save();
    ctx.beginPath();
    polygon.forEach(([x, z], i) => {
      const [u, v] = sceneToCanvas(x, z);
      if (i === 0) ctx.moveTo(u, v);
      else ctx.lineTo(u, v);
    });
    ctx.closePath();

    // Landmass fill — a subtle green-to-blue gradient (dark "terrain" tones)
    // that still reads noticeably lighter than the water under filmic tone
    // mapping.
    const land = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    land.addColorStop(0, "#1a3328");
    land.addColorStop(0.55, "#1c2f38");
    land.addColorStop(1, "#182a47");
    ctx.fillStyle = land;
    ctx.fill();

    // Coastline edge glow.
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Everything below is clipped to the landmass only.
    ctx.clip();

    // Faint street grid.
    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
    ctx.lineWidth = 1;
    const step = TEXTURE_SIZE / 44;
    for (let gx = 0; gx <= TEXTURE_SIZE; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, TEXTURE_SIZE);
      ctx.stroke();
    }
    for (let gz = 0; gz <= TEXTURE_SIZE; gz += step) {
      ctx.beginPath();
      ctx.moveTo(0, gz);
      ctx.lineTo(TEXTURE_SIZE, gz);
      ctx.stroke();
    }

    // Sparse deterministic "city density" texture — purely decorative noise,
    // not individual real buildings.
    const rng = createRng("mumbai-terrain-noise");
    for (let i = 0; i < 900; i++) {
      const x = rng() * TEXTURE_SIZE;
      const y = rng() * TEXTURE_SIZE;
      const size = 2 + rng() * 6;
      ctx.fillStyle = `rgba(71, 85, 105, ${0.25 + rng() * 0.3})`;
      ctx.fillRect(x, y, size, size);
    }

    // Tiny warm "city light" specks scattered across the landmass — a
    // decorative night-city sparkle, not real building/light locations.
    const lightsRng = createRng("mumbai-terrain-lights");
    for (let i = 0; i < 260; i++) {
      const x = lightsRng() * TEXTURE_SIZE;
      const y = lightsRng() * TEXTURE_SIZE;
      const warm = lightsRng() > 0.35;
      ctx.fillStyle = warm
        ? `rgba(251, 191, 36, ${0.35 + lightsRng() * 0.35})`
        : `rgba(103, 232, 249, ${0.3 + lightsRng() * 0.3})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Procedural, local-only stylized Mumbai coastline/terrain base for the
 * Digital Twin — no external map tiles, imagery, or API keys. Purely
 * illustrative: NOT a geographically accurate coastline.
 */
export default function MumbaiTerrain({ localities }: { localities: Locality[] }) {
  const texture = useMemo(() => {
    const polygon = buildSilhouette(localities);
    return generateTerrainTexture(polygon);
  }, [localities]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial map={texture} roughness={1} metalness={0} />
    </mesh>
  );
}
