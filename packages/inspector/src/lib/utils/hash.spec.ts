import { describe, it, expect } from 'vitest';
import { generateHash, getThumbnailHashNameForAsset } from './hash';

describe('Hash utilities', () => {
  describe('generateHash (async)', () => {
    it('should generate consistent hashes for the same input', async () => {
      const input = 'test-asset-path';
      const hash1 = await generateHash(input);
      const hash2 = await generateHash(input);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', async () => {
      const hash1 = await generateHash('asset1');
      const hash2 = await generateHash('asset2');
      expect(hash1).not.toBe(hash2);
    });

    it('should generate hex string of 16 characters', async () => {
      const hash = await generateHash('test');
      expect(hash).toMatch(/^[0-9a-f]{16}$/); // 16 hex characters (first 16 chars of SHA-256)
    });

    it('should handle empty string', async () => {
      const hash = await generateHash('');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should handle special characters and paths', async () => {
      const hash = await generateHash('asset-packs/models/tree with spaces.glb');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('getThumbnailHashNameForAsset (async)', () => {
    it('should return a proper hash filename with .png extension', async () => {
      const thumbnailName = await getThumbnailHashNameForAsset('asset-packs/models/tree.glb');
      expect(thumbnailName).toMatch(/^[0-9a-f]{16}\.png$/);
      expect(thumbnailName).not.toBe('[object Promise].png');
    });

    it('should be consistent for the same path', async () => {
      const path = 'asset-packs/models/tree.glb';
      const name1 = await getThumbnailHashNameForAsset(path);
      const name2 = await getThumbnailHashNameForAsset(path);
      expect(name1).toBe(name2);
      expect(name1).toMatch(/^[0-9a-f]{16}\.png$/);
    });

    it('should normalize path separators', async () => {
      // Both should return the same result after normalization
      const hash1 = await getThumbnailHashNameForAsset('asset-packs/models/tree.glb');
      const hash2 = await getThumbnailHashNameForAsset('asset-packs\\models\\tree.glb');
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{16}\.png$/);
    });

    it('should generate different filenames for different paths', async () => {
      const name1 = await getThumbnailHashNameForAsset('asset-packs/models/tree.glb');
      const name2 = await getThumbnailHashNameForAsset('asset-packs/models/house.glb');
      expect(name1).not.toBe(name2);
      expect(name1).toMatch(/^[0-9a-f]{16}\.png$/);
      expect(name2).toMatch(/^[0-9a-f]{16}\.png$/);
    });
  });
});
