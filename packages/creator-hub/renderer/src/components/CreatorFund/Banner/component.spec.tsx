import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { creatorFundApi } from '/@/lib/creatorFund';
import { actions } from '/@/modules/store/creatorFund';

import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';

import { CreatorFundBanner } from './component';

const ADDRESS = '0x1234567890123456789012345678901234567890';

vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

vi.mock('/@/hooks/useAuth', () => ({
  useAuth: () => ({ isSignedIn: true, wallet: ADDRESS }),
}));

const BANNER_TITLE = 'Get paid for the players you bring';

describe('CreatorFundBanner', () => {
  let store: TestStore;

  const renderBanner = () =>
    render(
      <Provider store={store}>
        <ThemeProvider theme={dark}>
          <MemoryRouter>
            <CreatorFundBanner />
          </MemoryRouter>
        </ThemeProvider>
      </Provider>,
    );

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(creatorFundApi, 'getPayoutWallet').mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the creator has not opted in', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'getEnrollment').mockResolvedValue(null);
    });

    it('should pitch the Creator Fund', async () => {
      renderBanner();

      expect(await screen.findByText(BANNER_TITLE)).toBeDefined();
    });
  });

  describe('when the creator has opted in', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'getEnrollment').mockResolvedValue({
        address: ADDRESS,
        enrolled_at: '2026-10-22T00:00:00.000Z',
        terms_version: '2026-10-beta',
      });
    });

    it('should not show the banner, not even while their enrollment loads', async () => {
      renderBanner();

      expect(screen.queryByText(BANNER_TITLE)).toBeNull();
      await waitFor(() => expect(store.getState().creatorFund.loadStatus).toBe('succeeded'));
      expect(screen.queryByText(BANNER_TITLE)).toBeNull();
    });
  });

  describe('when the creator opts in while it is on screen', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'getEnrollment').mockResolvedValue(null);
      vi.spyOn(creatorFundApi, 'enroll').mockResolvedValue({
        address: ADDRESS,
        enrolled_at: '2026-10-22T00:00:00.000Z',
        terms_version: '2026-10-beta',
      });
    });

    it('should go away', async () => {
      renderBanner();
      await screen.findByText(BANNER_TITLE);

      await store.dispatch(actions.joinCreatorFund({ address: ADDRESS }));

      await waitFor(() => expect(screen.queryByText(BANNER_TITLE)).toBeNull());
    });
  });
});
