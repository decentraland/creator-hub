import { describe, expect, it } from 'vitest';
import { isPlain } from '@reduxjs/toolkit';

import type { Authorization, Rental } from '/@/lib/land';
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
});
