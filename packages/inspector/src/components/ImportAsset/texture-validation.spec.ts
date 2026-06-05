import { isPowerOfTwo, nextPowerOfTwo } from './texture-validation';

describe('isPowerOfTwo', () => {
  it('should return true for powers of two', () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(4)).toBe(true);
    expect(isPowerOfTwo(256)).toBe(true);
    expect(isPowerOfTwo(512)).toBe(true);
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(2048)).toBe(true);
    expect(isPowerOfTwo(4096)).toBe(true);
  });

  it('should return false for non-powers of two', () => {
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(5)).toBe(false);
    expect(isPowerOfTwo(100)).toBe(false);
    expect(isPowerOfTwo(500)).toBe(false);
    expect(isPowerOfTwo(1000)).toBe(false);
    expect(isPowerOfTwo(1023)).toBe(false);
    expect(isPowerOfTwo(2049)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    expect(isPowerOfTwo(-1)).toBe(false);
    expect(isPowerOfTwo(-256)).toBe(false);
  });
});

describe('nextPowerOfTwo', () => {
  it('should return the same value for powers of two', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(256)).toBe(256);
    expect(nextPowerOfTwo(1024)).toBe(1024);
    expect(nextPowerOfTwo(2048)).toBe(2048);
  });

  it('should return the next power of two for non-powers', () => {
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(100)).toBe(128);
    expect(nextPowerOfTwo(500)).toBe(512);
    expect(nextPowerOfTwo(1000)).toBe(1024);
    expect(nextPowerOfTwo(1023)).toBe(1024);
    expect(nextPowerOfTwo(1025)).toBe(2048);
    expect(nextPowerOfTwo(2049)).toBe(4096);
  });

  it('should return 1 for zero or negative values', () => {
    expect(nextPowerOfTwo(0)).toBe(1);
    expect(nextPowerOfTwo(-5)).toBe(1);
  });

  describe('when used for texture size calculations', () => {
    it('should upscale a 500x200 texture to 512x512', () => {
      const width = 500;
      const height = 200;
      const targetSize = Math.max(nextPowerOfTwo(width), nextPowerOfTwo(height));
      expect(targetSize).toBe(512);
    });

    it('should upscale a 900x900 texture to 1024x1024', () => {
      const size = 900;
      expect(nextPowerOfTwo(size)).toBe(1024);
    });

    it('should keep a 1024x1024 texture as-is', () => {
      const size = 1024;
      expect(nextPowerOfTwo(size)).toBe(1024);
    });
  });
});
