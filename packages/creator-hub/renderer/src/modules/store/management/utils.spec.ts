import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilterBy, ManagedProjectType, SortBy } from '../../../../../shared/types/manage';
import type { Land, LandDeployment } from '../../../lib/land';
import { LandType, RoleType } from '../../../lib/land';
import type { WorldData, WorldScene, Worlds } from '../../../lib/worlds';
import {
  fetchAllDeployedWorlds,
  fetchWorldSceneCoords,
  groupLandDeployments,
  selectLandProjects,
  toLandProject,
} from './utils';

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

const landParcel = (x: number, y: number, name = 'Parcel'): Land => ({
  id: `${x},${y}`,
  tokenId: `token-${x}-${y}`,
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x,
  y,
  name,
  description: null,
  owner: TEST_ADDRESS,
  operators: [],
});

const landEstate = (id: string, coords: Array<[number, number]>, name = `Estate ${id}`): Land => ({
  id,
  tokenId: id,
  type: LandType.ESTATE,
  roles: [RoleType.MANAGER],
  role: RoleType.MANAGER,
  parcels: coords.map(([x, y]) => ({ x, y, id: `${x},${y}`, updateOperator: null })),
  name,
  description: null,
  owner: TEST_ADDRESS,
  operators: [],
});

const landDeployment = (id: string, parcels: string[], timestamp = 1000): LandDeployment =>
  ({
    id,
    timestamp,
    pointers: parcels,
    content: [{ file: 'thumb.png', hash: `hash-${id}` }],
    metadata: {
      display: { title: `Scene ${id}`, description: `About ${id}`, navmapThumbnail: 'thumb.png' },
      scene: { base: parcels[0], parcels },
    },
  }) as unknown as LandDeployment;

const contentUrl = (hash: string) => `https://peer.example.org/content/contents/${hash}`;

describe('groupLandDeployments', () => {
  describe('when scenes sit on a parcel and across an estate', () => {
    it('should file each scene under the LAND whose parcels it covers', () => {
      const lands = [
        landParcel(1, 1),
        landEstate('7', [
          [5, 5],
          [5, 6],
        ]),
      ];
      const onParcel = landDeployment('a', ['1,1']);
      const onEstate = landDeployment('b', ['5,5', '5,6']);

      expect(groupLandDeployments(lands, [onParcel, onEstate])).toEqual({
        '1,1': [onParcel],
        '7': [onEstate],
      });
    });
  });

  describe('when a LAND has nothing deployed', () => {
    it('should leave it out', () => {
      expect(groupLandDeployments([landParcel(1, 1)], [])).toEqual({});
    });
  });
});

describe('toLandProject', () => {
  describe('when the LAND holds scenes', () => {
    it('should be a LAND project summarising its latest scene', () => {
      const land = landEstate(
        '7',
        [
          [5, 5],
          [5, 6],
        ],
        'Plaza',
      );
      const project = toLandProject(
        land,
        [landDeployment('old', ['5,5'], 1000), landDeployment('new', ['5,6'], 2000)],
        contentUrl,
      );

      expect(project).toEqual({
        id: '7',
        displayName: 'Plaza',
        type: ManagedProjectType.LAND,
        role: RoleType.MANAGER,
        deployment: {
          title: 'Scene new',
          description: 'About new',
          thumbnail: contentUrl('hash-new'),
          lastPublishedAt: 2000,
          scenesCount: 2,
        },
        scenes: [
          { x: 5, y: 5 },
          { x: 5, y: 6 },
        ],
      });
    });
  });

  describe('when the LAND holds no scene', () => {
    it('should carry no deployment and no scenes', () => {
      const project = toLandProject(landParcel(1, 1), [], contentUrl);

      expect(project.deployment).toBeUndefined();
      expect(project.scenes).toEqual([]);
    });
  });
});

describe('selectLandProjects', () => {
  const lands = [
    landParcel(1, 1, 'Zeta'),
    landEstate(
      '7',
      [
        [-5, 10],
        [-5, 11],
      ],
      'Alpha',
    ),
    landParcel(2, 2, 'Empty lot'),
  ];
  const projects = [
    toLandProject(lands[0], [landDeployment('a', ['1,1'], 1000)], contentUrl),
    toLandProject(lands[1], [landDeployment('b', ['-5,10'], 3000)], contentUrl),
    toLandProject(lands[2], [], contentUrl),
  ];
  const select = (filters: Partial<Parameters<typeof selectLandProjects>[2]>) =>
    selectLandProjects(projects, lands, {
      publishFilter: FilterBy.PUBLISHED,
      sortBy: SortBy.LATEST,
      searchQuery: '',
      ...filters,
    }).map(project => project.displayName);

  describe('when filtering by published', () => {
    it('should list only LANDs holding a scene', () => {
      expect(select({})).toEqual(['Alpha', 'Zeta']);
    });
  });

  describe('when filtering by not published', () => {
    it('should list only LANDs holding no scene', () => {
      expect(select({ publishFilter: FilterBy.UNPUBLISHED })).toEqual(['Empty lot']);
    });
  });

  describe('when sorting by name', () => {
    it('should order them A to Z', () => {
      expect(select({ sortBy: SortBy.NAME })).toEqual(['Alpha', 'Zeta']);
    });
  });

  describe('when sorting by date modified', () => {
    it('should put the latest deployment first and LANDs never deployed last', () => {
      const all = [...projects].reverse();
      const order = selectLandProjects(all, lands, {
        publishFilter: undefined,
        sortBy: SortBy.LATEST,
        searchQuery: '',
      }).map(project => project.displayName);

      expect(order).toEqual(['Alpha', 'Zeta', 'Empty lot']);
    });
  });

  describe('when searching', () => {
    it('should match the LAND name, ignoring case', () => {
      expect(select({ searchQuery: 'zet' })).toEqual(['Zeta']);
    });

    it('should match the coordinates of a parcel, estate parcels included', () => {
      expect(select({ searchQuery: '-5, 11' })).toEqual(['Alpha']);
      expect(select({ searchQuery: '1,1' })).toEqual(['Zeta']);
    });
  });
});
