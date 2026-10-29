import { describe, expect, it } from 'vitest';

import type { WorldScene } from '/@/lib/worlds';

import { scenesOnParcels, toWorldScenes, usedBytes } from './worldScenes';

const worldScene = (overrides: Partial<WorldScene> = {}): WorldScene =>
  ({
    worldName: 'plaza.dcl.eth',
    deployer: '0xd',
    entityId: 'e1',
    parcels: ['1,0', '0,0'],
    size: '1048576',
    createdAt: '2026-10-01T00:00:00Z',
    thumbnailUrl: 'https://content.example/t.png',
    entity: { metadata: { display: { title: 'Plaza' }, scene: { base: '0,0' } } },
    ...overrides,
  }) as unknown as WorldScene;

describe('toWorldScenes', () => {
  describe('when the scene has a title and a base parcel', () => {
    it('should make a Scenes row from them, dated by its deploy time', () => {
      expect(toWorldScenes([worldScene()])).toEqual([
        {
          id: 'e1',
          title: 'Plaza',
          base: '0,0',
          parcels: ['1,0', '0,0'],
          timestamp: Date.parse('2026-10-01T00:00:00Z'),
          thumbnail: 'https://content.example/t.png',
        },
      ]);
    });
  });

  describe('when the scene has no title, base or thumbnail', () => {
    it('should fall back to its first parcel and an empty thumbnail', () => {
      const [row] = toWorldScenes([
        worldScene({ entity: { metadata: {} } as never, thumbnailUrl: undefined }),
      ]);

      expect([row.title, row.base, row.thumbnail]).toEqual(['1,0', '1,0', '']);
    });
  });
});

describe('toWorldScenes with no deploy time', () => {
  it('should date the row at 0 rather than an invalid date', () => {
    const [row] = toWorldScenes([worldScene({ createdAt: undefined as never })]);

    expect(row.timestamp).toBe(0);
  });
});

describe('scenesOnParcels', () => {
  const rows = toWorldScenes([
    worldScene({ entityId: 'a', parcels: ['0,0', '1,0'] }),
    worldScene({ entityId: 'b', parcels: ['5,5'] }),
  ]);

  describe('when the collaborator may deploy to every parcel', () => {
    it('should keep every scene', () => {
      expect(scenesOnParcels(rows, 'all').map(row => row.id)).toEqual(['a', 'b']);
    });
  });

  describe('when the collaborator may deploy to some parcels', () => {
    it('should keep a scene with any of its parcels among them', () => {
      expect(scenesOnParcels(rows, new Set(['1,0'])).map(row => row.id)).toEqual(['a']);
    });

    it('should keep none when no scene touches them', () => {
      expect(scenesOnParcels(rows, new Set(['9,9']))).toEqual([]);
    });
  });
});

describe('usedBytes', () => {
  it("should add up the scenes' sizes", () => {
    expect(usedBytes([worldScene({ size: '100' }), worldScene({ size: '250' })])).toBe(350);
  });
});
