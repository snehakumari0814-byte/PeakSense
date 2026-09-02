/**
 * Stylized "Mumbai peninsula" silhouette for the Digital Twin's terrain.
 *
 * This is NOT a real coastline. It is a convex hull computed over the same
 * locality scene positions the rest of the twin already uses (derived from
 * backend lat/long via `localityScenePosition`), expanded outward with a
 * little seeded jitter for an organic, hand-drawn edge. Deriving it from
 * locality positions — rather than hardcoding coastline points — means the
 * shape stays sensible even if the prototype locality set changes later.
 */

import type { Locality } from "@/types/locality";
import { localityScenePosition } from "@/lib/twinLayout";
import { createRng } from "@/lib/prng";

export type Point = [x: number, z: number];

const HULL_EXPANSION = 1.7;
const HULL_JITTER = 0.14;

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function buildSilhouette(localities: Locality[]): Point[] {
  const points = localities.map((l) => {
    const [x, , z] = localityScenePosition(l);
    return [x, z] as Point;
  });

  if (points.length < 3) return points;

  const hull = convexHull(points);
  const cx = hull.reduce((sum, p) => sum + p[0], 0) / hull.length;
  const cz = hull.reduce((sum, p) => sum + p[1], 0) / hull.length;
  const rng = createRng("mumbai-silhouette");

  return hull.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const scale = HULL_EXPANSION + (rng() - 0.5) * HULL_JITTER;
    return [cx + dx * scale, cz + dz * scale] as Point;
  });
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersects =
      zi > point[1] !== zj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
