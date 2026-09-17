import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ManagedProject } from '../../../shared/types/manage';
import { ManagedProjectType } from '../../../shared/types/manage';
import { WorldRoleType } from './worlds';

const fetchLandPublishedScenes = vi.fn();

vi.mock('./land', async () => {
  const actual = await import('./land');
  return {
    ...actual,
    Lands: class {
      fetchLandPublishedScenes = (...args: unknown[]) => fetchLandPublishedScenes(...args);
    },
  };
});

vi.mock('/@/modules/store/translation/utils', () => ({
  t: (key: string, values?: Record<string, unknown>) =>
    key === 'analytics.list.genesis_city' ? `Genesis City (${values?.coords})` : key,
}));

const { collectAnalyticsPlaces, fromLocalId, toLocalId } = await import('./analyticsLocations');

const THUMBNAIL = 'fallback.png';

const world = (id: string, scenes: Array<{ x: number; y: number }>): ManagedProject => ({
  id,
  displayName: id,
  type: ManagedProjectType.WORLD,
  role: WorldRoleType.OWNER,
  scenes,
});

describe('toLocalId and fromLocalId', () => {
  it.each([
    { world: 'example-name.dcl.eth', x: 0, y: 0 },
    // Plain .eth names are real, and are a different place from their .dcl.eth namesake.
    { world: 'shinydcl.eth', x: 0, y: 0 },
    { world: 'dafu.dcl.eth', x: -2, y: 6 },
    { x: 20, y: 2 },
    { x: -101, y: 102 },
  ])('should round-trip %j', location => {
    expect(fromLocalId(toLocalId(location))).toEqual(location);
  });

  it('should keep a world and a Genesis City scene at the same coordinates distinct', () => {
    expect(toLocalId({ world: 'a.dcl.eth', x: 0, y: 0 })).not.toBe(toLocalId({ x: 0, y: 0 }));
  });

  it('should distinguish a plain .eth world from its .dcl.eth namesake', () => {
    expect(toLocalId({ world: 'silverbrainiac.eth', x: 0, y: 0 })).not.toBe(
      toLocalId({ world: 'silverbrainiac.dcl.eth', x: 0, y: 0 }),
    );
  });

  it('should not be the API location_key, which we are told not to build or parse', () => {
    expect(toLocalId({ world: 'example-name.dcl.eth', x: 0, y: 0 })).not.toBe(
      'example-name.dcl.eth|0|0',
    );
    expect(toLocalId({ x: 20, y: 2 })).not.toBe('20|2');
  });

  it('should reject an id it did not produce', () => {
    expect(fromLocalId('example-name.dcl.eth|0|0')).toBeNull();
    expect(fromLocalId('land:nonsense')).toBeNull();
    expect(fromLocalId('')).toBeNull();
  });
});

describe('collectAnalyticsPlaces', () => {
  beforeEach(() => {
    fetchLandPublishedScenes.mockReset();
    fetchLandPublishedScenes.mockResolvedValue([]);
  });

  describe('when a world holds several scenes', () => {
    it('should produce one place per scene', async () => {
      const places = await collectAnalyticsPlaces(
        [
          world('dafu.dcl.eth', [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 9, y: 9 },
          ]),
        ],
        [],
        THUMBNAIL,
      );

      expect(places.map(place => place.location)).toEqual([
        { world: 'dafu.dcl.eth', x: 0, y: 0 },
        { world: 'dafu.dcl.eth', x: 2, y: 0 },
        { world: 'dafu.dcl.eth', x: 9, y: 9 },
      ]);
    });

    it('should name each row with its coordinates, so the rows are distinguishable', async () => {
      const places = await collectAnalyticsPlaces(
        [
          world('dafu.dcl.eth', [
            { x: 0, y: 0 },
            { x: 9, y: 9 },
          ]),
        ],
        [],
        THUMBNAIL,
      );

      expect(places.map(place => place.name)).toEqual(['dafu.dcl.eth (0,0)', 'dafu.dcl.eth (9,9)']);
    });
  });

  describe('when two scenes resolve to the same coordinate', () => {
    it('should produce one place, since the metrics are keyed by location', async () => {
      const places = await collectAnalyticsPlaces(
        [
          world('twin.dcl.eth', [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ]),
        ],
        [],
        THUMBNAIL,
      );

      expect(places).toHaveLength(1);
      expect(new Set(places.map(place => place.placeId)).size).toBe(places.length);
    });
  });

  describe('when a world holds one scene', () => {
    it('should name the row with the world alone', async () => {
      const [place] = await collectAnalyticsPlaces(
        [world('cozyfarm.dcl.eth', [{ x: 0, y: 0 }])],
        [],
        THUMBNAIL,
      );

      expect(place.name).toBe('cozyfarm.dcl.eth');
    });
  });

  describe('when a world has no scenes deployed', () => {
    it('should produce nothing to ask about', async () => {
      expect(await collectAnalyticsPlaces([world('empty.dcl.eth', [])], [], THUMBNAIL)).toEqual([]);
    });
  });

  describe('when the wallet holds LAND', () => {
    const estate = {
      id: 'estate-1',
      parcels: Array.from({ length: 120 }, (_, index) => ({
        x: index,
        y: 0,
        id: `${index},0`,
      })),
    } as never;
    const parcel = { id: 'parcel-1', x: -3, y: -2 } as never;

    it('should ask the content server about every owned parcel, estates expanded', async () => {
      await collectAnalyticsPlaces([], [estate, parcel], THUMBNAIL);

      const [coords] = fetchLandPublishedScenes.mock.calls[0];
      expect(coords).toHaveLength(121);
      expect(coords).toContainEqual([-3, -2]);
      expect(coords).toContainEqual([119, 0]);
    });

    it('should only produce places for parcels that actually hold a scene', async () => {
      fetchLandPublishedScenes.mockResolvedValue([
        { id: 'entity-1', metadata: { scene: { base: '-3,-2' }, display: {} } },
      ]);

      const places = await collectAnalyticsPlaces([], [estate, parcel], THUMBNAIL);

      expect(places).toHaveLength(1);
      expect(places[0].location).toEqual({ x: -3, y: -2 });
    });

    it('should locate a scene at its base parcel, not at every parcel it covers', async () => {
      fetchLandPublishedScenes.mockResolvedValue([
        {
          id: 'entity-1',
          metadata: { scene: { base: '5,7', parcels: ['5,7', '5,8'] }, display: {} },
        },
      ]);

      const places = await collectAnalyticsPlaces([], [parcel], THUMBNAIL);

      expect(places).toEqual([
        expect.objectContaining({ location: { x: 5, y: 7 }, placeId: 'land:5,7' }),
      ]);
    });

    it('should prefer the scene title when it has one', async () => {
      fetchLandPublishedScenes.mockResolvedValue([
        { id: 'entity-1', metadata: { scene: { base: '5,7' }, display: { title: 'My Gallery' } } },
      ]);

      const [place] = await collectAnalyticsPlaces([], [parcel], THUMBNAIL);

      expect(place.name).toBe('My Gallery');
    });

    it('should fall back to naming the row by its coordinates', async () => {
      fetchLandPublishedScenes.mockResolvedValue([
        { id: 'entity-1', metadata: { scene: { base: '5,7' }, display: {} } },
      ]);

      const [place] = await collectAnalyticsPlaces([], [parcel], THUMBNAIL);

      expect(place.name).toBe('Genesis City (5,7)');
    });

    it('should skip a deployment with no usable base coordinate', async () => {
      fetchLandPublishedScenes.mockResolvedValue([
        { id: 'entity-1', metadata: { display: {} } },
        { id: 'entity-2', metadata: { scene: { base: 'nonsense' }, display: {} } },
      ]);

      expect(await collectAnalyticsPlaces([], [parcel], THUMBNAIL)).toEqual([]);
    });

    it('should not call the content server when the wallet holds no LAND', async () => {
      await collectAnalyticsPlaces([world('a.dcl.eth', [{ x: 0, y: 0 }])], [], THUMBNAIL);

      expect(fetchLandPublishedScenes).not.toHaveBeenCalled();
    });
  });

  describe('when the wallet holds both worlds and LAND', () => {
    it('should return every scene, worlds first', async () => {
      fetchLandPublishedScenes.mockResolvedValue([
        { id: 'entity-1', metadata: { scene: { base: '20,2' }, display: {} } },
      ]);

      const places = await collectAnalyticsPlaces(
        [world('a.dcl.eth', [{ x: 0, y: 0 }])],
        [{ id: 'p', x: 20, y: 2 } as never],
        THUMBNAIL,
      );

      expect(places.map(place => place.placeId)).toEqual(['world:a.dcl.eth@0,0', 'land:20,2']);
    });
  });
});
