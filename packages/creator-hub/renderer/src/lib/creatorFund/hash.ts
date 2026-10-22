/**
 * A stable number in [0, 1) for a string, so mocked answers are the same on
 * every render and every launch.
 *
 * FNV-1a, then murmur3's finalizer. Without the finalizer, seeds that differ
 * only in their last character (`…:places:0`, `…:places:1`) land ~0.004 apart,
 * so every row of a board drew the same value.
 */
export function hashUnit(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

/** A stable hex string of `length` characters for a string, for mock addresses and hashes. */
export function hashHex(seed: string, length: number): string {
  let hex = '';
  for (let i = 0; hex.length < length; i++) {
    hex += Math.floor(hashUnit(`${seed}:${i}`) * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  }
  return hex.slice(0, length);
}

/** A stable value in [min, max) for a string. */
export function hashBetween(seed: string, min: number, max: number): number {
  return min + hashUnit(seed) * (max - min);
}
