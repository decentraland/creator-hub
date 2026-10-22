import { Provider } from 'react-redux';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Leaderboard as LeaderboardData, LeaderboardCreator } from '/@/lib/creatorFund';
import { CLOSED_CYCLES, creatorFundApi } from '/@/lib/creatorFund';

import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';

import { Leaderboard } from './component';

const ADDRESS = '0x1234567890123456789012345678901234567890';

vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

vi.mock('/@/hooks/useAuth', () => ({
  useAuth: () => ({ isSignedIn: true, wallet: ADDRESS, avatar: undefined }),
}));

const creator = (rank: number, address = `0x${String(rank).padStart(40, '0')}`) => ({
  rank,
  address,
  name: `creator${rank}`,
  paid_places: 1,
  amount_usdc: 1000 / rank,
});

const boardWith = (me: LeaderboardCreator | null): LeaderboardData => ({
  cycle_id: CLOSED_CYCLES[0].id,
  paid_creators: 92,
  paid_places: 166,
  creators: Array.from({ length: 20 }, (_, i) => (me && me.rank === i + 1 ? me : creator(i + 1))),
  scenes: [],
  me,
});

const creatorRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('Leaderboard', () => {
  let store: TestStore;

  const renderBoard = () =>
    render(
      <Provider store={store}>
        <ThemeProvider theme={dark}>
          <Leaderboard onJoin={vi.fn()} />
        </ThemeProvider>
      </Provider>,
    );

  const enrolled = (isEnrolled: boolean) =>
    vi
      .spyOn(creatorFundApi, 'getEnrollment')
      .mockResolvedValue(
        isEnrolled
          ? { address: ADDRESS, enrolled_at: '2026-10-22T00:00:00.000Z', terms_version: 'v' }
          : null,
      );

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(creatorFundApi, 'getPayoutWallet').mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the creator ranked 64th', () => {
    beforeEach(() => {
      enrolled(true);
      vi.spyOn(creatorFundApi, 'getLeaderboard').mockResolvedValue(boardWith(creator(64, ADDRESS)));
    });

    it('should show the top 20, then them below it', async () => {
      renderBoard();

      await screen.findByText('#20');
      const rows = creatorRows();
      const last = rows[rows.length - 1];
      expect(within(last).getByText('#64')).toBeDefined();
      expect(within(last).getByText('You')).toBeDefined();
      expect(screen.getAllByText('You')).toHaveLength(1);
      expect(creatorFundApi.getLeaderboard).toHaveBeenCalledWith(CLOSED_CYCLES[0].id, ADDRESS);
    });
  });

  describe('when the creator made the top 20', () => {
    beforeEach(() => {
      enrolled(true);
      vi.spyOn(creatorFundApi, 'getLeaderboard').mockResolvedValue(boardWith(creator(5, ADDRESS)));
    });

    it('should mark them in their place, with nothing pinned below', async () => {
      renderBoard();

      await screen.findByText('#20');
      expect(within(creatorRows()[4]).getByText('You')).toBeDefined();
      expect(creatorRows()).toHaveLength(20);
    });
  });

  describe('when the creator has not joined', () => {
    beforeEach(() => {
      enrolled(false);
      vi.spyOn(creatorFundApi, 'getLeaderboard').mockResolvedValue(boardWith(null));
    });

    it('should show the public board and invite them to join', async () => {
      renderBoard();

      expect(await screen.findByText('Join the Creator Fund to see where you rank.')).toBeDefined();
      expect(screen.queryByText('You')).toBeNull();
      expect(creatorFundApi.getLeaderboard).toHaveBeenCalledWith(CLOSED_CYCLES[0].id, undefined);
    });
  });
});
