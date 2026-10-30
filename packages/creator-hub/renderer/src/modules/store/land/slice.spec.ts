import { describe, expect, it } from 'vitest';
import { isPlain } from '@reduxjs/toolkit';

import type { Authorization, Land, Rental } from '/@/lib/land';
import { LandType } from '/@/lib/land';
import { fetchLandList, initialState, reducer } from './slice';

describe('land reducer', () => {
  describe('when the land list arrives', () => {
    const authorizations: Authorization[] = [{ address: '0xmanager', type: LandType.PARCEL }];
    const rentals: Rental[] = [
      {
        id: 'rental-1',
        type: LandType.ESTATE,
        tokenId: '7',
        lessor: '0xlessor',
        tenant: '0xme',
        operator: '0xme',
        startedAt: 1_700_000_000_000,
        endsAt: 1_800_000_000_000,
      },
    ];

    const state = reducer(
      initialState,
      fetchLandList.fulfilled({ land: [], authorizations, rentals }, 'request-id', {
        address: '0xme',
      }),
    );

    it('should keep the UpdateManager authorizations and the rentals', () => {
      expect(state.authorizations).toEqual(authorizations);
      expect(state.rentals).toEqual(rentals);
    });

    it('should keep them serializable for the store', () => {
      expect(state.rentals.every(rental => Object.values(rental).every(isPlain))).toBe(true);
    });
  });

  describe('when an older land list request answers after a newer one', () => {
    const args = { address: '0xme' };
    const list = (id: string) => ({
      land: [{ id } as Land],
      authorizations: [],
      rentals: [],
    });
    const state = [
      fetchLandList.pending('older', args),
      fetchLandList.pending('newer', args),
      fetchLandList.fulfilled(list('newer'), 'newer', args),
      fetchLandList.fulfilled(list('older'), 'older', args),
      fetchLandList.rejected(new Error('late'), 'older', args),
    ].reduce(reducer, initialState);

    it('should keep the newer list', () => {
      expect(state.data.map(land => land.id)).toEqual(['newer']);
      expect(state.status).toBe('succeeded');
    });
  });
});
