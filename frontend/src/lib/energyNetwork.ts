/**
 * A small set of prototype VISUAL electricity-flow connections between
 * locality zones for the 3D Digital Twin.
 *
 * The network starts from a minimum-spanning-tree over each locality's
 * scene position (guarantees every zone is connected with the fewest
 * possible edges), then adds a few of the next-nearest neighbor pairs so
 * the result reads as a small coherent grid (roughly 10-15 edges for the
 * 10 prototype localities) rather than a bare, obviously-algorithmic tree.
 * This is presentation only: it does NOT represent Mumbai's actual
 * electricity transmission/distribution topology, substations, or grid
 * routing.
 */

import type { Locality } from "@/types/locality";
import type { ForecastResponse } from "@/types/forecast";
import { localityScenePosition, type ScenePosition } from "@/lib/twinLayout";
import { demandRatio } from "@/lib/risk";

export type NetworkEdge = {
  id: string;
  fromId: string;
  toId: string;
  from: ScenePosition;
  to: ScenePosition;
  /** 0-1ish, average demand intensity of the two endpoints — drives flow speed/visibility. */
  intensity: number;
};

const MAX_EDGES = 14;

function distanceSquared(a: ScenePosition, b: ScenePosition): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

function edgeKey(i: number, j: number): string {
  return i < j ? `${i}-${j}` : `${j}-${i}`;
}

function getEndpointRatio(locality: Locality, forecast?: ForecastResponse): number {
  if (!locality.peak_threshold_mw || locality.peak_threshold_mw <= 0) return 0;
  const demand = forecast?.summary.currentLoadMw ?? locality.current_demand_mw;
  const threshold = forecast?.peakAnalysis.thresholdMw ?? locality.peak_threshold_mw;
  return demand / threshold;
}

export function buildEnergyNetwork(
  localities: Locality[],
  forecasts?: Record<string, ForecastResponse>,
): NetworkEdge[] {
  if (localities.length < 2) return [];

  const positions = localities.map((l) => localityScenePosition(l));
  const n = localities.length;

  // Base connectivity: minimum spanning tree (n - 1 edges).
  const inTree = new Array<boolean>(n).fill(false);
  const pairs: [number, number][] = [];
  inTree[0] = true;
  let added = 1;

  while (added < n) {
    let bestI = -1;
    let bestJ = -1;
    let bestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!inTree[i]) continue;
      for (let j = 0; j < n; j++) {
        if (inTree[j]) continue;
        const d = distanceSquared(positions[i], positions[j]);
        if (d < bestDist) {
          bestDist = d;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI === -1) break;
    inTree[bestJ] = true;
    added++;
    pairs.push([bestI, bestJ]);
  }

  // Densify with the next-nearest pairs (not already connected) so the
  // network looks like a small coherent grid instead of a bare tree.
  const seen = new Set<string>(pairs.map(([i, j]) => edgeKey(i, j)));
  const candidates: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = edgeKey(i, j);
      if (seen.has(key)) continue;
      candidates.push({ i, j, d: distanceSquared(positions[i], positions[j]) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);

  for (const c of candidates) {
    if (pairs.length >= MAX_EDGES) break;
    const key = edgeKey(c.i, c.j);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([c.i, c.j]);
  }

  return pairs.map(([i, j]) => {
    const a = localities[i];
    const b = localities[j];
    const ratioA = getEndpointRatio(a, forecasts?.[a.id]);
    const ratioB = getEndpointRatio(b, forecasts?.[b.id]);
    return {
      id: `${a.id}--${b.id}`,
      fromId: a.id,
      toId: b.id,
      from: positions[i],
      to: positions[j],
      intensity: Math.min(1.15, (ratioA + ratioB) / 2),
    };
  });
}
