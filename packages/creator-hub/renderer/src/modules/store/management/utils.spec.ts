import { flatten } from 'flat';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ManagedProject } from '../../../../../shared/types/manage';
import { FilterBy, ManagedProjectType, SortBy } from '../../../../../shared/types/manage';
import type { Land, LandDeployment } from '../../../lib/land';
import { LandType, RoleType } from '../../../lib/land';
import type { WorldData, WorldScene, Worlds } from '../../../lib/worlds';
import { WorldRoleType } from '../../../lib/worlds';
import { en } from '../translation/locales';
import { setCurrentLocale } from '../translation/utils';
import {
  fetchAllDeployedWorlds,
  fetchWorldSceneCoords,
  getLandName,
  getManagers,
  groupLandDeployments,
  resolveWorldProject,
  selectLandProjects,
  selectWorldProjects,
  toLandProject,
  toManagedProject,
  toStreamOnlyProject,
} from './utils';

const TEST_ADDRESS = '0xowner';

beforeAll(() => {
  setCurrentLocale('en', flatten(en));
});

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

describe('toManagedProject', () => {
  const titledScene = (title?: string) =>
    ({
      parcels: ['0,0'],
      entity: { metadata: { scene: { base: '0,0' }, display: title ? { title } : {} } },
    }) as unknown as WorldScene;

  describe('when the World has a World Name and its scene has a title', () => {
    it('should carry the World Name as its title and the scene title on the deployment', async () => {
      const worldsApi = createWorldsApi();
      worldsApi.fetchWorldScenes.mockResolvedValue({ scenes: [titledScene('Scene X')], total: 1 });

      const project = await toManagedProject(
        worldsApi,
        { ...world('plaza.dcl.eth'), title: 'Plaza' },
        TEST_ADDRESS,
      );

      expect(project.title).toBe('Plaza');
      expect(project.deployment?.title).toBe('Scene X');
    });
  });

  describe('when someone else owns the World', () => {
    it('should carry its owner', async () => {
      const worldsApi = createWorldsApi();
      worldsApi.fetchWorldScenes.mockResolvedValue({ scenes: [titledScene()], total: 1 });

      const project = await toManagedProject(
        worldsApi,
        { ...world('plaza.dcl.eth'), owner: '0xother' },
        TEST_ADDRESS,
      );

      expect(project.owner).toBe('0xother');
    });
  });

  describe('when neither the World nor its scene is titled', () => {
    it('should leave the title unset and fall back to the domain on the deployment', async () => {
      const worldsApi = createWorldsApi();
      worldsApi.fetchWorldScenes.mockResolvedValue({ scenes: [titledScene()], total: 1 });

      const project = await toManagedProject(
        worldsApi,
        { ...world('plaza.dcl.eth'), title: null },
        TEST_ADDRESS,
      );

      expect(project.title).toBeUndefined();
      expect(project.deployment?.title).toBe('plaza.dcl.eth');
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
        place: { kind: 'estate', size: 2, base: { x: 5, y: 5 } },
      });
    });
  });

  describe('when the LAND is a parcel', () => {
    it('should place it at its own coordinates', () => {
      expect(toLandProject(landParcel(12, -2), [], contentUrl).place).toEqual({
        kind: 'parcel',
        x: 12,
        y: -2,
      });
    });
  });

  describe('when the estate lists its parcels out of order', () => {
    it('should take the lowest parcel as its base, for Jump In', () => {
      const land = landEstate('9', [
        [3, 1],
        [-2, 4],
        [-2, 0],
      ]);

      expect(toLandProject(land, [], contentUrl).place).toEqual({
        kind: 'estate',
        size: 3,
        base: { x: -2, y: 0 },
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

describe('toStreamOnlyProject', () => {
  const settingsApi = (overrides: { scenes?: unknown; settings?: unknown } = {}) => {
    const worldsApi = createWorldsApi() as ReturnType<typeof createWorldsApi> & {
      fetchWorldSettings: ReturnType<typeof vi.fn>;
    };
    worldsApi.fetchWorldSettings = vi.fn();
    if ('scenes' in overrides)
      worldsApi.fetchWorldScenes.mockImplementation(async () => overrides.scenes);
    if ('settings' in overrides)
      worldsApi.fetchWorldSettings.mockImplementation(async () => overrides.settings);
    return worldsApi;
  };
  const titledScene = {
    parcels: ['0,0'],
    entity: { metadata: { scene: { base: '0,0' }, display: { title: 'Scene X' } } },
  };

  describe('when the World is published and has a World Name', () => {
    it('should be a published, stream-only collaborator World named from its Details', async () => {
      const worldsApi = settingsApi({
        scenes: { scenes: [titledScene], total: 2 },
        settings: { title: 'Plaza', thumbnailHash: 'QmThumb' },
      });

      const project = await toStreamOnlyProject(worldsApi, 'plaza.dcl.eth');

      expect(worldsApi.fetchWorldScenes).toHaveBeenCalledWith('plaza.dcl.eth', { limit: 1 });
      expect(worldsApi.fetchWorldSettings).toHaveBeenCalledWith('plaza.dcl.eth');
      expect(project).toMatchObject({
        id: 'plaza.dcl.eth',
        displayName: 'plaza.dcl.eth',
        type: ManagedProjectType.WORLD,
        role: 'collaborator',
        access: 'stream',
        title: 'Plaza',
        deployment: { title: 'Scene X', scenesCount: 2, thumbnail: 'https://content.com/QmThumb' },
      });
    });
  });

  describe('when the settings cannot be read', () => {
    it('should still list the World, falling back to its scene title', async () => {
      const worldsApi = settingsApi({ scenes: { scenes: [titledScene], total: 1 } });
      worldsApi.fetchWorldSettings.mockRejectedValue(new Error('boom'));

      const project = await toStreamOnlyProject(worldsApi, 'plaza.dcl.eth');

      expect(project.title).toBeUndefined();
      expect(project.deployment?.title).toBe('Scene X');
    });
  });

  describe('when its scenes cannot be read', () => {
    it('should list the World as unpublished rather than drop it', async () => {
      const worldsApi = settingsApi({ settings: { title: 'Plaza' } });
      worldsApi.fetchWorldScenes.mockRejectedValue(new Error('boom'));

      const project = await toStreamOnlyProject(worldsApi, 'plaza.dcl.eth');

      expect(project.deployment).toBeUndefined();
      expect(project.access).toBe('stream');
    });
  });
});

describe('resolveWorldProject', () => {
  const worldsApi = () => {
    const api = createWorldsApi() as ReturnType<typeof createWorldsApi> & {
      fetchWorldSettings: ReturnType<typeof vi.fn>;
    };
    api.fetchWorldSettings = vi.fn(async () => ({ title: 'Plaza' }));
    api.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 1 });
    return api;
  };

  describe('when the account holds the NAME', () => {
    it('should resolve it as an owned, deployable World named from its Details', async () => {
      const project = await resolveWorldProject(
        worldsApi() as never,
        { subdomain: 'plaza.dcl.eth', nftOwnerAddress: TEST_ADDRESS.toUpperCase() },
        TEST_ADDRESS,
      );

      expect(project).toMatchObject({
        id: 'plaza.dcl.eth',
        role: WorldRoleType.OWNER,
        owner: TEST_ADDRESS.toUpperCase(),
        title: 'Plaza',
      });
      expect(project.access).toBeUndefined();
      expect(project.deployment?.scenesCount).toBe(1);
    });
  });

  describe('when someone else holds the NAME', () => {
    it('should resolve it as a collaborator World', async () => {
      const project = await resolveWorldProject(
        worldsApi() as never,
        { subdomain: 'plaza.dcl.eth', nftOwnerAddress: '0xother' },
        TEST_ADDRESS,
      );

      expect(project.role).toBe(WorldRoleType.COLLABORATOR);
      expect(project.owner).toBe('0xother');
    });
  });
});

describe('selectWorldProjects', () => {
  const project = (id: string): ManagedProject => ({
    id,
    displayName: id,
    type: ManagedProjectType.WORLD,
    role: RoleType.OWNER,
  });
  const published = [project('zeta.dcl.eth'), project('alpha.dcl.eth')];
  const empty = [project('omega.dcl.eth'), project('beta.dcl.eth')];
  const ids = (filters: Parameters<typeof selectWorldProjects>[2]) =>
    selectWorldProjects(published, empty, filters).map(world => world.id);

  describe('when sorting by last updated', () => {
    it('should keep the published order and list the empty worlds after, A to Z', () => {
      expect(ids({ sortBy: SortBy.LATEST, searchQuery: '' })).toEqual([
        'zeta.dcl.eth',
        'alpha.dcl.eth',
        'beta.dcl.eth',
        'omega.dcl.eth',
      ]);
    });
  });

  describe('when stream-only Worlds are listed too', () => {
    const streamOnly = [
      { ...project('alpha.dcl.eth'), access: 'stream' as const },
      {
        ...project('stream-live.dcl.eth'),
        access: 'stream' as const,
        deployment: {
          title: 'Live',
          description: '',
          thumbnail: '',
          lastPublishedAt: 0,
          scenesCount: 1,
        },
      },
      { ...project('stream-empty.dcl.eth'), access: 'stream' as const },
    ];
    const merged = (filters: Parameters<typeof selectWorldProjects>[2]) =>
      selectWorldProjects(published, empty, filters, streamOnly).map(world => world.id);

    it('should merge them without a second card for a World already listed', () => {
      expect(merged({ sortBy: SortBy.LATEST, searchQuery: '' })).toEqual([
        'zeta.dcl.eth',
        'alpha.dcl.eth',
        'stream-live.dcl.eth',
        'beta.dcl.eth',
        'omega.dcl.eth',
        'stream-empty.dcl.eth',
      ]);
    });

    it('should honour the publish filter and the search', () => {
      expect(
        merged({ sortBy: SortBy.LATEST, searchQuery: 'stream', publishFilter: FilterBy.PUBLISHED }),
      ).toEqual(['zeta.dcl.eth', 'alpha.dcl.eth', 'stream-live.dcl.eth']);
      expect(
        merged({
          sortBy: SortBy.LATEST,
          searchQuery: 'stream',
          publishFilter: FilterBy.UNPUBLISHED,
        }),
      ).toEqual(['zeta.dcl.eth', 'alpha.dcl.eth', 'stream-empty.dcl.eth']);
    });
  });

  describe('when sorting by name', () => {
    it('should merge both lists A to Z', () => {
      expect(ids({ sortBy: SortBy.NAME, searchQuery: '' })).toEqual([
        'alpha.dcl.eth',
        'beta.dcl.eth',
        'omega.dcl.eth',
        'zeta.dcl.eth',
      ]);
    });
  });

  describe('when searching', () => {
    it('should narrow the empty worlds, which the server search never sees', () => {
      expect(ids({ sortBy: SortBy.LATEST, searchQuery: 'OME' })).toEqual([
        'zeta.dcl.eth',
        'alpha.dcl.eth',
        'omega.dcl.eth',
      ]);
    });
  });
});

describe('getLandName', () => {
  describe('when the LAND has an on-chain name', () => {
    it('should use it', () => {
      expect(getLandName(toLandProject(landParcel(1, 1, 'Plaza'), [], contentUrl))).toBe('Plaza');
    });
  });

  describe('when an unnamed LAND is a parcel', () => {
    it('should name it by its coordinates', () => {
      expect(getLandName(toLandProject(landParcel(12, -2, ''), [], contentUrl))).toBe(
        'Parcel 12,-2',
      );
    });
  });

  describe('when an unnamed LAND is an estate', () => {
    it('should name it by its id', () => {
      expect(getLandName(toLandProject(landEstate('501', [[0, 0]], ''), [], contentUrl))).toBe(
        'Estate 501',
      );
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

  describe('when a LAND has no on-chain name', () => {
    const unnamed = [landParcel(40, 40, ''), landParcel(1, 1, 'Zeta'), landParcel(2, 2, 'Alpha')];
    const named = (filters: Partial<Parameters<typeof selectLandProjects>[2]>) =>
      selectLandProjects(
        unnamed.map(land => toLandProject(land, [], contentUrl)),
        unnamed,
        { publishFilter: undefined, sortBy: SortBy.NAME, searchQuery: '', ...filters },
      ).map(getLandName);

    it('should sort it by the name the card shows', () => {
      expect(named({})).toEqual(['Alpha', 'Parcel 40,40', 'Zeta']);
    });

    it('should find it by the name the card shows', () => {
      expect(named({ searchQuery: 'parcel 40' })).toEqual(['Parcel 40,40']);
    });
  });
});

describe('getManagers', () => {
  describe('when an account manages both registries', () => {
    it('should list it once, as a full manager', () => {
      expect(
        getManagers([
          { address: '0xa', type: LandType.PARCEL },
          { address: '0xa', type: LandType.ESTATE },
        ]),
      ).toEqual([{ address: '0xa', state: 'full' }]);
    });
  });

  describe('when an account manages only the LAND registry', () => {
    it('should flag it as applying to LAND only', () => {
      expect(getManagers([{ address: '0xb', type: LandType.PARCEL }])).toEqual([
        { address: '0xb', state: 'land-only' },
      ]);
    });
  });
});
