import { describe, expect, it, vi } from 'vitest';

import { LandType, RoleType, type Land } from '/@/lib/land';
import { buildSetEstateParcelsOperator, buildSetLandOperator } from '/@/lib/landTransactions';

import { planCollaboratorChange } from './plan';

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      ({
        LAND_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000001',
        ESTATE_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000002',
      })[key],
  },
}));

const estate = (updateOperator: string | null, parcelOperators: Array<string | null>): Land => ({
  id: '501',
  tokenId: '501',
  type: LandType.ESTATE,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  parcels: parcelOperators.map((operator, x) => ({
    x,
    y: 0,
    id: `${x},0`,
    updateOperator: operator,
  })),
  name: '',
  description: null,
  owner: '0xowner',
  operators: [],
  updateOperator,
});

const ANA = '0x00000000000000000000000000000000000000a1';
const BEN = '0x00000000000000000000000000000000000000b2';

describe('planCollaboratorChange', () => {
  describe('when adding to an estate', () => {
    it('should set the estate-wide operator in one transaction', () => {
      const land = estate(null, [null]);
      const plan = planCollaboratorChange(land, { kind: 'add', address: ANA });

      expect(plan.txs).toEqual([buildSetLandOperator(land, ANA)]);
      expect(plan.isApplied(estate(ANA, [null]))).toBe(true);
      expect(plan.isApplied(land)).toBe(false);
    });
  });

  describe('when removing an estate-wide row and two parcel rows together', () => {
    it('should revoke the estate-wide one, then all those parcels in one transaction', () => {
      const land = estate(ANA, [BEN, null, BEN]);
      const plan = planCollaboratorChange(land, {
        kind: 'remove',
        collaborators: [
          { address: ANA, scope: { kind: 'estate-wide' } },
          {
            address: BEN,
            scope: {
              kind: 'parcels',
              parcels: [
                { x: 0, y: 0 },
                { x: 2, y: 0 },
              ],
            },
          },
        ],
      });

      expect(plan.txs).toEqual([
        buildSetLandOperator(land, null),
        buildSetEstateParcelsOperator(
          '501',
          [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
          ],
          null,
        ),
      ]);
      expect(plan.doneKey).toBe('tx.done.collaborators_removed');
      expect(plan.isApplied(estate(null, [null, null, null]))).toBe(true);
    });
  });

  describe("when a parcel operator's parcels change", () => {
    it('should set the chosen parcels and revoke the dropped ones', () => {
      const land = estate(null, [ANA, ANA, null]);
      const plan = planCollaboratorChange(land, {
        kind: 'parcels',
        address: ANA,
        parcels: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        previous: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      });

      expect(plan.txs).toEqual([
        buildSetEstateParcelsOperator(
          '501',
          [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
          ],
          ANA,
        ),
        buildSetEstateParcelsOperator('501', [{ x: 0, y: 0 }], null),
      ]);
      expect(plan.isApplied(estate(null, [null, ANA, ANA]))).toBe(true);
    });
  });
});
