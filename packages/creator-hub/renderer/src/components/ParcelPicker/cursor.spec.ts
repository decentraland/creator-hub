import { describe, expect, it } from 'vitest';

import { isAllowed, nearestParcel, nextParcel, type Bounds } from './cursor';

const WORLD: Bounds = { min: { x: -150, y: -150 }, max: { x: 150, y: 150 } };

describe('cursor', () => {
  describe('when the allowed parcels are bounds', () => {
    it('should allow every parcel inside them and none outside', () => {
      expect(isAllowed(WORLD, { x: 150, y: -150 })).toBe(true);
      expect(isAllowed(WORLD, { x: 151, y: 0 })).toBe(false);
    });

    it('should step one parcel at a time and stop at the edge', () => {
      expect(nextParcel({ x: 0, y: 0 }, 'ArrowRight', WORLD)).toEqual({ x: 1, y: 0 });
      expect(nextParcel({ x: 0, y: 150 }, 'ArrowUp', WORLD)).toBeNull();
    });

    it('should clamp a point to the nearest allowed parcel', () => {
      expect(nearestParcel({ x: 200, y: -5 }, WORLD)).toEqual({ x: 150, y: -5 });
    });
  });

  describe('when the allowed parcels are a set', () => {
    it('should allow only its members', () => {
      expect(isAllowed(new Set(['1,1']), { x: 1, y: 1 })).toBe(true);
      expect(isAllowed(new Set(['1,1']), { x: 0, y: 0 })).toBe(false);
    });
  });
});
