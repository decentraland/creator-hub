import { describe, expect, it } from 'vitest';

import { getCoverCrop, getThumbnailSize, THUMBNAIL_ASPECT_RATIO } from './image';

describe('getCoverCrop', () => {
  describe('when the source is wider than 16:9', () => {
    it('should crop the sides and keep the full height', () => {
      expect(getCoverCrop(2000, 1000, THUMBNAIL_ASPECT_RATIO)).toEqual({
        x: 111,
        y: 0,
        width: 1778,
        height: 1000,
      });
    });
  });

  describe('when the source is taller than 16:9', () => {
    it('should crop the top and bottom and keep the full width', () => {
      expect(getCoverCrop(873, 648, THUMBNAIL_ASPECT_RATIO)).toEqual({
        x: 0,
        y: 78,
        width: 873,
        height: 491,
      });
    });
  });

  describe('when the source is already 16:9', () => {
    it('should keep the whole image', () => {
      expect(getCoverCrop(1920, 1080, THUMBNAIL_ASPECT_RATIO)).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });
  });
});

describe('getThumbnailSize', () => {
  it('should produce an exact 16:9 size no wider than the recommended 1920', () => {
    const size = getThumbnailSize(3000);
    expect(size).toEqual({ width: 1920, height: 1080 });
  });

  it('should never upscale a smaller capture', () => {
    const { width, height } = getThumbnailSize(873);
    expect(width).toBeLessThanOrEqual(873);
    expect(width / height).toBeCloseTo(THUMBNAIL_ASPECT_RATIO, 5);
    expect(Number.isInteger(height)).toBe(true);
  });

  it('should still return a usable size for a tiny capture', () => {
    const { width, height } = getThumbnailSize(10);
    expect(width).toBeGreaterThan(0);
    expect(width / height).toBeCloseTo(THUMBNAIL_ASPECT_RATIO, 5);
  });
});
