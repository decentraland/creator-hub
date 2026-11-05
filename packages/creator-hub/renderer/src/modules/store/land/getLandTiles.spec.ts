import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasTileProps } from 'decentraland-ui2/dist/components/Atlas/Atlas.types';

import type { EstateFields, Land, LandQueryResult, ParcelFields, RentalFields } from '/@/lib/land';

const LAND_REGISTRY = '0x000000000000000000000000000000000000a1a0';
const ESTATE_REGISTRY = '0x000000000000000000000000000000000000e57a';
const RENTALS_CONTRACT = '0x000000000000000000000000000000000000bea1';

const ME = '0x00000000000000000000000000000000000000a1';
const OWNER = '0x00000000000000000000000000000000000000b2';
const TENANT = '0x00000000000000000000000000000000000000c3';
const STRANGER = '0x00000000000000000000000000000000000000d4';

const fetchMock = vi.fn();

vi.mock('/shared/fetch', () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      ({ LAND_REGISTRY_ADDRESS: LAND_REGISTRY, ESTATE_REGISTRY_ADDRESS: ESTATE_REGISTRY })[key] ??
      'https://subgraph.example.org',
  },
}));

vi.mock('@sentry/electron/renderer', () => ({ captureException: vi.fn() }));

const { Lands, Rentals, RoleType } = await import('/@/lib/land');
const { selectors } = await import('./slice');

const parcel = (x: number, y: number, fields: Partial<ParcelFields> = {}): ParcelFields => ({
  x: String(x),
  y: String(y),
  tokenId: `${x}${y}`,
  owner: { address: ME },
  operator: null,
  updateOperator: null,
  data: null,
  ...fields,
});

const estate = (
  id: string,
  coords: [number, number][],
  fields: Partial<EstateFields> = {},
): EstateFields => ({
  id,
  owner: { address: ME },
  operator: null,
  updateOperator: null,
  size: coords.length,
  parcels: coords.map(([x, y]) => ({ x: String(x), y: String(y), tokenId: `${x}${y}` })),
  data: null,
  ...fields,
});

const emptyResult = (): LandQueryResult => ({
  tenantParcels: [],
  tenantEstates: [],
  lessorParcels: [],
  lessorEstates: [],
  ownerParcels: [],
  ownerEstates: [],
  updateOperatorParcels: [],
  updateOperatorEstates: [],
  approvedParcels: [],
  approvedEstates: [],
  ownerAuthorizations: [],
  operatorAuthorizations: [],
});

type Grant = LandQueryResult['operatorAuthorizations'][number];

const grant = (fields: {
  registry: string;
  type?: string;
  isApproved: boolean;
  timestamp: number;
  parcels?: ParcelFields[];
  estates?: EstateFields[];
}): Grant => ({
  type: fields.type ?? 'UpdateManager',
  isApproved: fields.isApproved,
  tokenAddress: fields.registry,
  timestamp: String(fields.timestamp),
  owner: { address: OWNER, parcels: fields.parcels ?? [], estates: fields.estates ?? [] },
});

const respond = (data: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ data }),
});

/** The atlas tiles of an estate: `getLandTiles` reads an estate's coords from them. */
const estateTiles = (estateId: string, coords: [number, number][]) =>
  Object.fromEntries(
    coords.map(([x, y]) => [
      `${x},${y}`,
      { x, y, estateId, type: 'owned' } as unknown as AtlasTileProps,
    ]),
  );

async function fetchLands(data: Partial<LandQueryResult>): Promise<Land[]> {
  fetchMock.mockResolvedValueOnce(respond({ ...emptyResult(), ...data }));
  const [lands] = await new Lands().fetchLand(ME);
  return lands;
}

function offered(lands: Land[], tiles: Record<string, AtlasTileProps> = {}): string[] {
  return Object.keys(
    selectors.getLandTiles({ data: lands, tiles, error: null, status: 'succeeded' }),
  ).sort();
}

describe('getLandTiles, the parcels the Publish to LAND picker offers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('when the wallet owns a parcel outright', () => {
    let lands: Land[];

    beforeEach(async () => {
      lands = await fetchLands({ ownerParcels: [parcel(10, 20)] });
    });

    it('should offer it', () => {
      expect(offered(lands)).toEqual(['10,20']);
    });

    it('should tag the wallet as its owner', () => {
      expect(lands[0].role).toBe(RoleType.OWNER);
    });
  });

  describe('when the wallet owns an estate', () => {
    const coords: [number, number][] = [
      [1, 1],
      [1, 2],
    ];
    let lands: Land[];

    beforeEach(async () => {
      lands = await fetchLands({ ownerEstates: [estate('7', coords)] });
    });

    it('should offer every parcel of the estate', () => {
      expect(offered(lands, estateTiles('7', coords))).toEqual(['1,1', '1,2']);
    });
  });

  describe('when the wallet rented its parcel out', () => {
    let lands: Land[];

    beforeEach(async () => {
      // While rented, the Rentals contract holds the LAND and the tenant's operator runs it.
      lands = await fetchLands({
        lessorParcels: [
          parcel(5, 5, { owner: { address: RENTALS_CONTRACT }, updateOperator: TENANT }),
        ],
      });
    });

    it('should not offer it, as the Catalyst refuses the lessor', () => {
      expect(offered(lands)).toEqual([]);
    });

    it('should still list it for the pages that report on the land the wallet holds', () => {
      expect(lands.map(land => [land.id, land.role])).toEqual([['5,5', RoleType.LESSOR]]);
    });
  });

  describe('when the wallet rents a parcel', () => {
    describe('and the rental names the wallet as the operator', () => {
      let lands: Land[];

      beforeEach(async () => {
        lands = await fetchLands({
          tenantParcels: [
            parcel(3, 4, { owner: { address: RENTALS_CONTRACT }, updateOperator: ME }),
          ],
          updateOperatorParcels: [
            parcel(3, 4, { owner: { address: RENTALS_CONTRACT }, updateOperator: ME }),
          ],
        });
      });

      it('should offer it', () => {
        expect(offered(lands)).toEqual(['3,4']);
      });

      it('should tag the wallet as its tenant', () => {
        expect(lands[0].role).toBe(RoleType.TENANT);
      });
    });

    describe('and the tenant named someone else as the operator', () => {
      let lands: Land[];

      beforeEach(async () => {
        lands = await fetchLands({
          tenantParcels: [
            parcel(3, 4, { owner: { address: RENTALS_CONTRACT }, updateOperator: STRANGER }),
          ],
        });
      });

      it('should not offer it, as only the update operator can deploy', () => {
        expect(offered(lands)).toEqual([]);
      });
    });
  });

  describe('when the wallet is the update operator of a parcel and an estate', () => {
    const coords: [number, number][] = [[8, 8]];
    let lands: Land[];

    beforeEach(async () => {
      lands = await fetchLands({
        updateOperatorParcels: [parcel(9, 9, { owner: { address: OWNER }, updateOperator: ME })],
        updateOperatorEstates: [
          estate('3', coords, { owner: { address: OWNER }, updateOperator: ME }),
        ],
      });
    });

    it('should offer both', () => {
      expect(offered(lands, estateTiles('3', coords))).toEqual(['8,8', '9,9']);
    });

    it('should tag the wallet as their operator', () => {
      expect(lands.map(land => land.role)).toEqual([RoleType.OPERATOR, RoleType.OPERATOR]);
    });
  });

  describe('when the owner approved the wallet for a single parcel', () => {
    let lands: Land[];

    beforeEach(async () => {
      lands = await fetchLands({
        approvedParcels: [parcel(6, 6, { owner: { address: OWNER }, operator: ME })],
      });
    });

    it('should offer it', () => {
      expect(offered(lands)).toEqual(['6,6']);
    });
  });

  describe('when an owner authorized the wallet on a registry', () => {
    const estateCoords: [number, number][] = [[0, 9]];
    const ownersLand = {
      parcels: [parcel(0, 1, { owner: { address: OWNER } })],
      estates: [estate('11', estateCoords, { owner: { address: OWNER } })],
    };
    const tiles = estateTiles('11', estateCoords);

    describe('and made the wallet UpdateManager on the LAND registry only', () => {
      let lands: Land[];

      beforeEach(async () => {
        lands = await fetchLands({
          operatorAuthorizations: [
            grant({ registry: LAND_REGISTRY, isApproved: true, timestamp: 1, ...ownersLand }),
          ],
        });
      });

      it("should offer the owner's parcels but not the owner's estates", () => {
        expect(offered(lands, tiles)).toEqual(['0,1']);
      });

      it('should tag the wallet as their operator', () => {
        expect(lands.map(land => land.role)).toEqual([RoleType.OPERATOR]);
      });
    });

    describe('and approved the wallet for all on the Estate registry only', () => {
      let lands: Land[];

      beforeEach(async () => {
        lands = await fetchLands({
          operatorAuthorizations: [
            grant({
              registry: ESTATE_REGISTRY,
              type: 'ApprovalForAll',
              isApproved: true,
              timestamp: 1,
              ...ownersLand,
            }),
          ],
        });
      });

      it("should offer the owner's estates but not the owner's parcels", () => {
        expect(offered(lands, tiles)).toEqual(['0,9']);
      });
    });

    describe('and later revoked it', () => {
      let lands: Land[];

      beforeEach(async () => {
        // The subgraph keeps both events, newest first as the query orders them.
        lands = await fetchLands({
          operatorAuthorizations: [
            grant({ registry: LAND_REGISTRY, isApproved: false, timestamp: 2, ...ownersLand }),
            grant({ registry: LAND_REGISTRY, isApproved: true, timestamp: 1, ...ownersLand }),
          ],
        });
      });

      it('should not offer any of the owner’s land', () => {
        expect(offered(lands, tiles)).toEqual([]);
      });
    });

    describe('and revoked it, then granted it again', () => {
      let lands: Land[];

      beforeEach(async () => {
        lands = await fetchLands({
          operatorAuthorizations: [
            grant({ registry: LAND_REGISTRY, isApproved: false, timestamp: 2, ...ownersLand }),
            grant({ registry: LAND_REGISTRY, isApproved: true, timestamp: 3, ...ownersLand }),
          ],
        });
      });

      it("should offer the owner's parcels", () => {
        expect(offered(lands, tiles)).toEqual(['0,1']);
      });
    });

    it('should ask the subgraph for every kind of authorization that grants access, newest first', async () => {
      await fetchLands({});

      const { query } = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(query).toContain(
        'where: { operator: $address, type_in: ["UpdateManager","ApprovalForAll","Operator"] }',
      );
      expect(query).toMatch(/operatorAuthorizations: authorizations\([^)]*orderBy: timestamp/);
    });
  });
});

describe('Rentals.fetchRentalTokenIds', () => {
  const NOW = new Date('2026-06-01T00:00:00Z');
  const seconds = (date: Date) => String(Math.floor(date.getTime() / 1000));

  const rental = (tokenId: string, endsAt: Date): RentalFields => ({
    id: tokenId,
    contractAddress: LAND_REGISTRY,
    tokenId,
    lessor: OWNER,
    tenant: ME,
    operator: ME,
    startedAt: seconds(new Date('2026-01-01T00:00:00Z')),
    endsAt: seconds(endsAt),
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when one of the wallet’s rentals has run out but was never claimed back', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        respond({
          tenantRentals: [
            rental('1', new Date('2026-05-01T00:00:00Z')),
            rental('2', new Date('2026-07-01T00:00:00Z')),
          ],
          lessorRentals: [],
        }),
      );
    });

    it('should keep only the rental still running', async () => {
      const { tenantRentals } = await new Rentals().fetchRentalTokenIds(ME);

      expect(tenantRentals.map(({ tokenId }) => tokenId)).toEqual(['2']);
    });
  });
});
