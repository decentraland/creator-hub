import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_STORAGE_KEY, SimulatedCreator, mockBackoffice, mockControls } from './mockBackoffice';

const ADDRESS = '0x1111111111111111111111111111111111111111';

/** The mock waits like a real round trip; skip the wait. */
const settle = async <T>(promise: Promise<T>) => {
  await vi.runAllTimersAsync();
  return promise;
};

describe('mockControls.reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(MOCK_STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when the demo simulates a not eligible creator', () => {
    beforeEach(async () => {
      mockControls.setSimulatedCreator(SimulatedCreator.NOT_ELIGIBLE);
      await settle(mockBackoffice.enroll(ADDRESS, '2026-10-beta'));
      await settle(mockBackoffice.setPayoutWallet(ADDRESS, ADDRESS));
    });

    it('should leave the fund and clear the wallet', async () => {
      mockControls.reset();

      expect(await settle(mockBackoffice.getEnrollment(ADDRESS))).toBeNull();
      expect(await settle(mockBackoffice.getPayoutWallet(ADDRESS))).toBeNull();
    });

    it('should keep simulating the not eligible creator, so the join can be re-run as them', async () => {
      mockControls.reset();

      const eligibility = await settle(mockBackoffice.getCreatorEligibility(ADDRESS));
      expect(eligibility.eligible).toBe(false);
    });
  });
});
