import { describe, expect, it } from 'vitest';
import { isPlain } from '@reduxjs/toolkit';

import type { Authorization, Land, Rental } from '/@/lib/land';
import { LandType } from '/@/lib/land';
import { accountChanged } from '../account';
import { fetchLandList, fetchTiles, initialState, reducer } from './slice';

const ARGS = { address: '0xme' };
const listOf = (id: string) => ({ land: [{ id } as Land], authorizations: [], rentals: [] });

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

    const state = [
      fetchLandList.pending('request-id', { address: '0xme' }),
      fetchLandList.fulfilled({ land: [], authorizations, rentals }, 'request-id', {
        address: '0xme',
      }),
    ].reduce(reducer, initialState);

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

  describe('when the account changes while a land list request is in flight', () => {
    const args = { address: '0xprevious' };
    const tiles = { '0,0': { x: 0, y: 0, type: 'owned' } } as never;
    const state = [
      fetchTiles.fulfilled(tiles, 'tiles'),
      fetchLandList.pending('loaded', args),
      fetchLandList.fulfilled(
        { land: [{ id: 'loaded' } as Land], authorizations: [], rentals: [] },
        'loaded',
        args,
      ),
      fetchLandList.pending('late', args),
      accountChanged(),
      fetchLandList.fulfilled(
        { land: [{ id: 'late' } as Land], authorizations: [], rentals: [] },
        'late',
        args,
      ),
      fetchLandList.rejected(new Error('late'), 'late', args),
    ].reduce(reducer, initialState);

    it('should drop the previous account list and its late answer', () => {
      expect(state.data).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('should keep the atlas tiles, which belong to no account', () => {
      expect(state.tiles).toEqual(tiles);
    });
  });

  describe('when two land list requests overlap and the newer one fails after the older one lands', () => {
    const state = [
      fetchLandList.pending('older', ARGS),
      fetchLandList.pending('newer', ARGS),
      fetchLandList.fulfilled(listOf('older'), 'older', ARGS),
      fetchLandList.rejected(new Error('boom'), 'newer', ARGS),
    ].reduce(reducer, initialState);

    it('should keep the older list as a loaded one', () => {
      expect(state.data.map(land => land.id)).toEqual(['older']);
      expect(state.status).toBe('succeeded');
    });
  });

  describe('when two land list requests overlap and the newer one fails first', () => {
    const failedFirst = [
      fetchLandList.pending('older', ARGS),
      fetchLandList.pending('newer', ARGS),
      fetchLandList.rejected(new Error('boom'), 'newer', ARGS),
    ].reduce(reducer, initialState);
    const state = reducer(failedFirst, fetchLandList.fulfilled(listOf('older'), 'older', ARGS));

    it('should keep loading while the older request is still out', () => {
      expect(failedFirst.status).toBe('loading');
    });

    it('should then take the older list', () => {
      expect(state.data.map(land => land.id)).toEqual(['older']);
      expect(state.status).toBe('succeeded');
    });
  });

  describe('when the only land list request fails', () => {
    const state = [
      fetchLandList.pending('only', ARGS),
      fetchLandList.rejected(new Error('boom'), 'only', ARGS),
    ].reduce(reducer, initialState);

    it('should fail', () => {
      expect(state.status).toBe('failed');
      expect(state.error).toBe('boom');
    });
  });

  describe('when the atlas tiles load while the land list is in flight', () => {
    const state = [
      fetchLandList.pending('list', ARGS),
      fetchTiles.pending('tiles'),
      fetchTiles.fulfilled({}, 'tiles'),
    ].reduce(reducer, initialState);

    it('should keep the land list loading', () => {
      expect(state.status).toBe('loading');
    });
  });
});
