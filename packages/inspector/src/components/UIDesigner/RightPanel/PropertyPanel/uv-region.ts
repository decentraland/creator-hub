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
