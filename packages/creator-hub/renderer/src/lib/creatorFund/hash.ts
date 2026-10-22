/**
 * A stable number in [0, 1) for a string (FNV-1a), so mocked answers are the
 * same on every render and every launch.
 */
export function hashUnit(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

/** A stable value in [min, max) for a string. */
export function hashBetween(seed: string, min: number, max: number): number {
  return min + hashUnit(seed) * (max - min);
}
