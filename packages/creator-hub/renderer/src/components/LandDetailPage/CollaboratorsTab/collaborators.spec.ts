import { describe, expect, it } from 'vitest';

import { LandType, RoleType, type Land } from '/@/lib/land';

import { getCollaborators } from './collaborators';

const base = {
  tokenId: '1',
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  name: '',
  description: null,
  owner: '0xowner',
  operators: [],
};

const parcel = (updateOperator: string | null): Land => ({
  ...base,
  id: '96,15',
  type: LandType.PARCEL,
  x: 96,
  y: 15,
  updateOperator,
});

const estate = (updateOperator: string | null, parcelOperators: Array<string | null>): Land => ({
  ...base,
  id: '501',
  type: LandType.ESTATE,
  parcels: parcelOperators.map((operator, x) => ({
    x,
    y: 0,
    id: `${x},0`,
    updateOperator: operator,
  })),
  updateOperator,
});

describe('getCollaborators', () => {
  describe('when a parcel has an update operator', () => {
    it('should list it as the token collaborator', () => {
      expect(getCollaborators(parcel('0xana'))).toEqual([
        { address: '0xana', scope: { kind: 'token' } },
      ]);
    });
  });

  describe('when a parcel has none', () => {
    it('should list nobody', () => {
      expect(getCollaborators(parcel(null))).toEqual([]);
    });
  });

  describe('when an estate has an estate-wide operator and per-parcel ones', () => {
    it('should list the estate-wide one, then one row per parcel operator with its parcels', () => {
      expect(getCollaborators(estate('0xall', ['0xana', null, '0xben', '0xana']))).toEqual([
        { address: '0xall', scope: { kind: 'estate-wide' } },
        {
          address: '0xana',
          scope: {
            kind: 'parcels',
            parcels: [
              { x: 0, y: 0 },
              { x: 3, y: 0 },
            ],
          },
        },
        { address: '0xben', scope: { kind: 'parcels', parcels: [{ x: 2, y: 0 }] } },
      ]);
    });
  });
});
