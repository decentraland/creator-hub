import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CreatorIneligibleReason,
  OptInReason,
  PayoutReason,
  creatorFundApi,
  worldFundKey,
} from '/@/lib/creatorFund';
import type { PlaceEligibility } from '/@/lib/creatorFund';
import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';

import { PlaceFundStatus, actions, selectors } from './slice';

const ADDRESS = '0x1111111111111111111111111111111111111111';

const place = (world: string, eligible: boolean): PlaceEligibility => ({
  place_id: worldFundKey(world),
  title: world,
  world_name: world,
  base_position: '0,0',
  owner: null,
  opt_in: { eligible, reasons: eligible ? [] : [OptInReason.PRIVATE_WORLD] },
  cycle: {
    id: '2026-10-01_2026-10-15',
    start_date: '2026-10-01',
    end_date: '2026-10-15',
    qualified: eligible,
    reasons: eligible ? [] : [PayoutReason.PRIVATE_WORLD],
  },
});

describe('creatorFund slice', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(creatorFundApi, 'getEnrollment').mockResolvedValue(null);
    vi.spyOn(creatorFundApi, 'getPayoutWallet').mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when the backoffice says the creator is not eligible', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'getCreatorEligibility').mockResolvedValue({
        address: ADDRESS,
        eligible: false,
        reasons: [CreatorIneligibleReason.SUSPENDED],
      });
    });

    it('should keep the answer and its reasons, and not enroll', async () => {
      await store.dispatch(actions.checkEligibility({ address: ADDRESS }));

      const state = store.getState().creatorFund;
      expect(state.eligibilityStatus).toBe('succeeded');
      expect(state.eligibility?.reasons).toEqual([CreatorIneligibleReason.SUSPENDED]);
      expect(state.enrollment).toBeNull();
    });
  });

  describe('when the creator joins', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'enroll').mockResolvedValue({
        address: ADDRESS,
        enrolled_at: '2026-10-22T00:00:00.000Z',
        terms_version: '2026-10-beta',
      });
      vi.spyOn(creatorFundApi, 'getPlacesEligibility').mockResolvedValue([
        place('open.dcl.eth', true),
        place('locked.dcl.eth', false),
      ]);
    });

    it('should move their eligible places into the fund and leave the others out', async () => {
      await store.dispatch(
        actions.fetchPlacesEligibility([
          { key: worldFundKey('open.dcl.eth'), title: null },
          { key: worldFundKey('locked.dcl.eth'), title: null },
        ]),
      );
      const open = worldFundKey('open.dcl.eth');
      const locked = worldFundKey('locked.dcl.eth');
      expect(selectors.getPlaceFundStatus(store.getState(), open)).toBe(PlaceFundStatus.ELIGIBLE);

      await store.dispatch(actions.joinCreatorFund({ address: ADDRESS }));

      expect(selectors.getPlaceFundStatus(store.getState(), open)).toBe(PlaceFundStatus.IN_FUND);
      expect(selectors.getPlaceFundStatus(store.getState(), locked)).toBe(
        PlaceFundStatus.NOT_ELIGIBLE,
      );
    });
  });

  describe('when a place has already been answered', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'getPlacesEligibility').mockResolvedValue([
        place('open.dcl.eth', true),
      ]);
    });

    it('should not ask about it again', async () => {
      const request = [{ key: worldFundKey('open.dcl.eth'), title: null }];
      await store.dispatch(actions.fetchPlacesEligibility(request));
      await store.dispatch(actions.fetchPlacesEligibility(request));

      expect(creatorFundApi.getPlacesEligibility).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a different wallet signs in', () => {
    beforeEach(() => {
      vi.mocked(creatorFundApi.getEnrollment).mockResolvedValueOnce({
        address: ADDRESS,
        enrolled_at: '2026-10-22T00:00:00.000Z',
        terms_version: '2026-10-beta',
      });
    });

    it('should drop the first wallet’s enrollment while the second one loads', async () => {
      await store.dispatch(actions.loadCreatorFund({ address: ADDRESS }));
      expect(store.getState().creatorFund.enrollment).not.toBeNull();

      const loading = store.dispatch(
        actions.loadCreatorFund({ address: '0x2222222222222222222222222222222222222222' }),
      );

      expect(store.getState().creatorFund.enrollment).toBeNull();
      await loading;
    });
  });
});
