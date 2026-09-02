/**
 * Prototype 3D scene layout for the Mumbai Digital Twin.
 *
 * This is presentation-only configuration. It derives a stylized (x, z)
 * scene position for each locality from the backend's DEMO lat/long values,
 * so the frontend does not maintain a second, hand-authored source of truth
 * for locality positions. The resulting layout is a rough, illustrative
 * approximation of Mumbai's geography for the 3D twin — NOT a
 * geographically accurate or official map projection.
 */

import type { Locality } from "@/types/locality";

// Mumbai's prototype locality set spans a much smaller longitude range than
// latitude range, so x/z use independent scale factors (chosen so the 10
// zones spread out legibly on the ground plane) rather than one uniform
// degrees-to-units scale.
const SCENE_SCALE_LON = 1550;
const SCENE_SCALE_LAT = 800;

// Approximate centroid of the prototype locality set, used only to center
// the stylized scene layout around the origin.
const CENTER_LAT = 19.07;
const CENTER_LON = 72.86;

export type ScenePosition = [x: number, y: number, z: number];

export function localityScenePosition(locality: Locality): ScenePosition {
  const x = (locality.longitude - CENTER_LON) * SCENE_SCALE_LON;
  // Latitude increases northward; map that to -z ("further back") so the
  // layout reads top-to-bottom the way a north-up map would.
  const z = -(locality.latitude - CENTER_LAT) * SCENE_SCALE_LAT;
  return [x, 0, z];
}

export const GROUND_SIZE = 420;
export const ZONE_RADIUS = 16;
