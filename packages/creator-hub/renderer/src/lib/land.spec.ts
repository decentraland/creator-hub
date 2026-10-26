import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coords } from './land';

const fetchMock = vi.fn();

vi.mock('/shared/fetch', () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

const CONFIG: Record<string, string> = {
  LAND_REGISTRY_ADDRESS: '0xland',
  ESTATE_REGISTRY_ADDRESS: '0xestate',
};

vi.mock('/@/config', () => ({
  config: { get: (key: string) => CONFIG[key] ?? 'https://peer.example.org' },
}));

const { Lands, RoleType } = await import('./land');

const ok = (scenes: Array<{ id: string }>) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(scenes),
});

const parcels = (count: number): Coords[] =>
  Array.from({ length: count }, (_, i): Coords => [i, 0]);

describe('Lands.fetchLandPublishedScenes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when a scene covers several of the owned parcels', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(ok([{ id: 'scene-a' }, { id: 'scene-a' }, { id: 'scene-b' }]));
    });

    it('should answer once per scene rather than once per parcel', async () => {
      const scenes = await new Lands().fetchLandPublishedScenes(parcels(3));

      expect(scenes.map(scene => scene.id)).toEqual(['scene-a', 'scene-b']);
    });
  });

  describe('when the wallet holds more parcels than one request takes', () => {
    beforeEach(() => {
      fetchMock.mockImplementation(() => Promise.resolve(ok([{ id: 'scene-a' }])));
    });

    it('should ask in batches and declare the body as JSON', async () => {
      await new Lands().fetchLandPublishedScenes(parcels(250));

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body).pointers).toHaveLength(100);
    });

    it('should allow longer than the default timeout, which a cold batch outlasts', async () => {
      await new Lands().fetchLandPublishedScenes(parcels(100));

      const [, , timeoutMs] = fetchMock.mock.calls[0];
      expect(timeoutMs).toBeGreaterThan(5000);
    });
  });

  describe('when a batch fails once', () => {
    beforeEach(() => {
      fetchMock
        .mockRejectedValueOnce(new Error('REQUEST_TIMEOUT'))
        .mockResolvedValue(ok([{ id: 'scene-a' }]));
    });

    it('should ask again rather than dropping those parcels', async () => {
      const scenes = await new Lands().fetchLandPublishedScenes(parcels(10));

      expect(scenes.map(scene => scene.id)).toEqual(['scene-a']);
    });
  });

  describe('when a batch keeps failing', () => {
    it('should throw, so the parcels are never silently missing from the list', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });

      await expect(new Lands().fetchLandPublishedScenes(parcels(10))).rejects.toThrow();
    });

    it('should throw when the request itself keeps erroring', async () => {
      fetchMock.mockRejectedValue(new Error('REQUEST_TIMEOUT'));

      await expect(new Lands().fetchLandPublishedScenes(parcels(10))).rejects.toThrow(
        'REQUEST_TIMEOUT',
      );
    });
  });

  describe('when the wallet holds no parcels', () => {
    it('should ask for nothing', async () => {
      expect(await new Lands().fetchLandPublishedScenes([])).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('when a parcel holds the empty scene an unpublish leaves behind', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        ok([
          { id: 'empty', metadata: { source: { isEmpty: true } } },
          { id: 'scene-a', metadata: { source: { isEmpty: false } } },
          { id: 'scene-b' },
        ] as Array<{ id: string }>),
      );
    });

    it('should leave it out, since nothing is published there', async () => {
      const scenes = await new Lands().fetchLandPublishedScenes(parcels(3));

      expect(scenes.map(scene => scene.id)).toEqual(['scene-a', 'scene-b']);
    });
  });
});

const ZERO = '0x0000000000000000000000000000000000000000';

const parcelFields = (x: number, y: number, updateOperator: string | null = null) => ({
  x: String(x),
  y: String(y),
  tokenId: `token-${x}-${y}`,
  owner: { address: '0xowner' },
  updateOperator,
  data: null,
});

const estateFields = (id: string, parcelOperators: Array<string | null>) => ({
  id,
  owner: { address: '0xowner' },
  updateOperator: null,
  size: parcelOperators.length,
  parcels: parcelOperators.map((updateOperator, i) => ({
    x: String(i),
    y: '9',
    tokenId: `token-${i}-9`,
    updateOperator,
  })),
  data: null,
});

const landQuery = (data: Record<string, unknown>) => ({
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({
      data: {
        tenantParcels: [],
        tenantEstates: [],
        lessorParcels: [],
        lessorEstates: [],
        ownerParcels: [],
        ownerEstates: [],
        updateOperatorParcels: [],
        updateOperatorEstates: [],
        ownerAuthorizations: [],
        operatorAuthorizations: [],
        ...data,
      },
    }),
});

describe('Lands.fetchLand', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('when the account is the update operator of a parcel', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        landQuery({ updateOperatorParcels: [parcelFields(1, 1, '0xme')] }),
      );
    });

    it('should give it the operator role, the one tagged as Collaborator', async () => {
      const [lands] = await new Lands().fetchLand('0xme');

      expect(lands.map(land => [land.id, land.role])).toEqual([['1,1', RoleType.OPERATOR]]);
    });
  });

  describe('when an owner made the account an UpdateManager of their LAND', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        landQuery({
          operatorAuthorizations: [
            {
              owner: {
                address: '0xowner',
                parcels: [parcelFields(2, 2)],
                estates: [estateFields('7', [null])],
              },
              isApproved: true,
              tokenAddress: '0xland',
            },
          ],
        }),
      );
    });

    it('should give the parcels the manager role, apart from token operators', async () => {
      const [lands] = await new Lands().fetchLand('0xme');

      expect(lands.find(land => land.id === '2,2')?.role).toBe(RoleType.MANAGER);
    });

    it('should leave out the estates, which the LAND registry approval does not cover', async () => {
      const [lands] = await new Lands().fetchLand('0xme');

      expect(lands.map(land => land.id)).toEqual(['2,2']);
    });
  });

  describe('when an owner made the account an UpdateManager of their estates', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        landQuery({
          operatorAuthorizations: [
            {
              owner: {
                address: '0xowner',
                parcels: [parcelFields(2, 2)],
                estates: [estateFields('7', [null])],
              },
              isApproved: true,
              tokenAddress: '0xestate',
            },
          ],
        }),
      );
    });

    it('should list only the estates, as managed', async () => {
      const [lands] = await new Lands().fetchLand('0xme');

      expect(lands.map(land => [land.id, land.role])).toEqual([['7', RoleType.MANAGER]]);
    });
  });

  describe('when the UpdateManager approval was revoked', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        landQuery({
          operatorAuthorizations: [
            {
              owner: { address: '0xowner', parcels: [parcelFields(2, 2)], estates: [] },
              isApproved: false,
              tokenAddress: '0xland',
            },
          ],
        }),
      );
    });

    it('should not list the owner LAND', async () => {
      const [lands] = await new Lands().fetchLand('0xme');

      expect(lands).toEqual([]);
    });
  });

  describe('when an estate parcel has its own update operator', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        landQuery({ ownerEstates: [estateFields('7', ['0xparcel-op', ZERO, null])] }),
      );
    });

    it('should ask the subgraph for each estate parcel operator', async () => {
      await new Lands().fetchLand('0xme');

      const { query } = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(query).toMatch(/parcels\(first: 1000\) \{[^}]*updateOperator/);
    });

    it('should keep it on that parcel, and no operator on the others', async () => {
      const [[estate]] = await new Lands().fetchLand('0xme');

      expect(estate.parcels?.map(parcel => parcel.updateOperator)).toEqual([
        '0xparcel-op',
        null,
        null,
      ]);
    });
  });
});
