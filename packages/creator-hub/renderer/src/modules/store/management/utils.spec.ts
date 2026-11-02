import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorldData, WorldScene, Worlds } from '../../../lib/worlds';
import { fetchAllDeployedWorlds, fetchWorldSceneCoords } from './utils';

const TEST_ADDRESS = '0xowner';

const scene = (base: string | undefined, parcels: string[] = []): WorldScene =>
  ({
    parcels,
    entity: base ? { metadata: { scene: { base } } } : {},
  }) as unknown as WorldScene;

const world = (name: string, deployedScenes = 1): WorldData =>
  ({
    name,
    owner: TEST_ADDRESS,
    deployedScenes,
    title: name,
    description: '',
    thumbnailHash: null,
    lastDeployedAt: null,
  }) as unknown as WorldData;

const createWorldsApi = () =>
  ({
    fetchWorlds: vi.fn(),
    fetchWorldScenes: vi.fn(),
    getContentSrcUrl: vi.fn((hash: string) => `https://content.com/${hash}`),
  }) as unknown as Worlds & {
    fetchWorlds: ReturnType<typeof vi.fn>;
    fetchWorldScenes: ReturnType<typeof vi.fn>;
  };

describe('fetchWorldSceneCoords', () => {
  let worldsApi: ReturnType<typeof createWorldsApi>;

  beforeEach(() => {
    worldsApi = createWorldsApi();
  });

  describe('when the world holds more scenes than one page returns', () => {
    beforeEach(() => {
      worldsApi.fetchWorldScenes.mockImplementation(
        (_name: string, params: { limit: number; offset: number }) => {
          const all = Array.from({ length: 250 }, (_, i) => scene(`${i},0`));
          return Promise.resolve({
            scenes: all.slice(params.offset, params.offset + params.limit),
            total: all.length,
          });
        },
      );
    });

    it('should page through total rather than stopping at the first page', async () => {
      const coords = await fetchWorldSceneCoords(worldsApi, 'big.dcl.eth');

      expect(coords).toHaveLength(250);
      expect(coords?.[249]).toEqual({ x: 249, y: 0 });
    });
  });

  describe('when the world holds no scenes', () => {
    beforeEach(() => {
      worldsApi.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });
    });

    it('should report an empty list, which is not a failure', async () => {
      expect(await fetchWorldSceneCoords(worldsApi, 'empty.dcl.eth')).toEqual([]);
    });
  });

  describe('when the scene lookup answers nothing', () => {
    beforeEach(() => {
      worldsApi.fetchWorldScenes.mockResolvedValue(null);
    });

    it('should report null, so a failure is not read as "no scenes"', async () => {
      expect(await fetchWorldSceneCoords(worldsApi, 'broken.dcl.eth')).toBeNull();
    });
  });

  describe('when the scene lookup throws', () => {
    beforeEach(() => {
      worldsApi.fetchWorldScenes.mockRejectedValue(new Error('REQUEST_TIMEOUT'));
    });

    it('should report null rather than an empty list', async () => {
      expect(await fetchWorldSceneCoords(worldsApi, 'broken.dcl.eth')).toBeNull();
    });
  });

  describe('when a later page fails', () => {
    beforeEach(() => {
      worldsApi.fetchWorldScenes
        .mockResolvedValueOnce({ scenes: [scene('0,0')], total: 200 })
        .mockResolvedValue(null);
    });

    it('should report null rather than the pages it managed to read', async () => {
      expect(await fetchWorldSceneCoords(worldsApi, 'flaky.dcl.eth')).toBeNull();
    });
  });

  describe('when a scene carries no base in its metadata', () => {
    beforeEach(() => {
      worldsApi.fetchWorldScenes.mockResolvedValue({
        scenes: [scene(undefined, ['10,0', '9,0', '11,0'])],
        total: 1,
      });
    });

    it('should fall back to the numerically lowest parcel, not the lowest string', async () => {
      expect(await fetchWorldSceneCoords(worldsApi, 'nobase.dcl.eth')).toEqual([{ x: 9, y: 0 }]);
    });
  });
});

describe('fetchAllDeployedWorlds', () => {
  let worldsApi: ReturnType<typeof createWorldsApi>;

  beforeEach(() => {
    worldsApi = createWorldsApi();
    worldsApi.fetchWorldScenes.mockResolvedValue({ scenes: [scene('0,0')], total: 1 });
  });

  describe('when the wallet holds more worlds than one page returns', () => {
    beforeEach(() => {
      const all = Array.from({ length: 120 }, (_, i) => world(`w${i}.dcl.eth`));
      worldsApi.fetchWorlds.mockImplementation((params: { limit: number; offset: number }) =>
        Promise.resolve({
          worlds: all.slice(params.offset, params.offset + params.limit),
          total: all.length,
        }),
      );
    });

    it('should page through total rather than returning the first page', async () => {
      const projects = await fetchAllDeployedWorlds(worldsApi, TEST_ADDRESS);

      expect(projects).toHaveLength(120);
      expect(projects[119].id).toBe('w119.dcl.eth');
    });

    it('should not carry the manage page search, sort or offset into the query', async () => {
      await fetchAllDeployedWorlds(worldsApi, TEST_ADDRESS);

      for (const [params] of worldsApi.fetchWorlds.mock.calls) {
        expect(params).toMatchObject({
          has_deployed_scenes: true,
          authorized_deployer: TEST_ADDRESS,
        });
        expect(params.search).toBeUndefined();
        expect(params.sort).toBeUndefined();
      }
    });
  });

  describe('when the worlds request keeps failing', () => {
    beforeEach(() => {
      worldsApi.fetchWorlds.mockResolvedValue(null);
    });

    it('should throw rather than answer with a short list', async () => {
      await expect(fetchAllDeployedWorlds(worldsApi, TEST_ADDRESS)).rejects.toThrow();
    });
  });

  describe('when the worlds request fails once', () => {
    beforeEach(() => {
      worldsApi.fetchWorlds
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ worlds: [world('recovered.dcl.eth')], total: 1 });
    });

    it('should retry, since a timeout says nothing about the next call', async () => {
      const projects = await fetchAllDeployedWorlds(worldsApi, TEST_ADDRESS);

      expect(projects.map(project => project.id)).toEqual(['recovered.dcl.eth']);
    });
  });

  describe('when one world cannot be listed', () => {
    beforeEach(() => {
      worldsApi.fetchWorlds.mockResolvedValue({
        worlds: [world('fine.dcl.eth'), world('broken.dcl.eth')],
        total: 2,
      });
      worldsApi.fetchWorldScenes.mockImplementation((name: string) =>
        name === 'broken.dcl.eth'
          ? Promise.resolve(null)
          : Promise.resolve({ scenes: [], total: 0 }),
      );
    });

    it('should name it rather than answer with the worlds it could read', async () => {
      await expect(fetchAllDeployedWorlds(worldsApi, TEST_ADDRESS)).rejects.toThrow(
        /broken\.dcl\.eth/,
      );
    });
  });
});
