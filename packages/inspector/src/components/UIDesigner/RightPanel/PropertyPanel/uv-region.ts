// UI background `uvs` is 8 floats = the 4 (u,v) corners of the quad, and is only
// honored in STRETCH texture mode (see @dcl/react-ecs uiBackground docs). We let
// the author pick a rectangular sub-region of the texture (atlas / spritesheet)
// as [uMin,vMin]-[uMax,vMax] normalized 0..1, and map it to the corner winding
// here — the SINGLE place to adjust corner order if the runtime renders a region
// flipped or rotated. Winding: bottom-left, top-left, top-right, bottom-right
// (the geometric rectangle; the shipped default's repeated corner is a
// placeholder, not a real quad).
export interface UvRegion {
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function regionToUvs(r: UvRegion): number[] {
  const uMin = clamp01(r.uMin);
  const vMin = clamp01(r.vMin);
  const uMax = clamp01(r.uMax);
  const vMax = clamp01(r.vMax);
  return [uMin, vMin, uMin, vMax, uMax, vMax, uMax, vMin];
}

// Recover the region rectangle from a uvs array for display. Reads the min/max
// of the u and v channels so it round-trips regionToUvs and tolerates hand-set
// or legacy windings. Falls back to the full [0,1] square when uvs is absent
// or malformed (< 8 entries).
export function uvsToRegion(uvs: number[] | undefined): UvRegion {
  if (!uvs || uvs.length < 8) return { uMin: 0, vMin: 0, uMax: 1, vMax: 1 };
  const us = [uvs[0], uvs[2], uvs[4], uvs[6]];
  const vs = [uvs[1], uvs[3], uvs[5], uvs[7]];
  return {
    uMin: clamp01(Math.min(...us)),
    vMin: clamp01(Math.min(...vs)),
    uMax: clamp01(Math.max(...us)),
    vMax: clamp01(Math.max(...vs)),
  };
}
