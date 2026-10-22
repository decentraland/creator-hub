import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PayoutStatus } from './contract';
import { CLOSED_CYCLES } from './cycles';
import { hashHex } from './hash';
import { mockBackoffice } from './mockBackoffice';
import { creatorStanding, cycleDistribution, leaderboardFor } from './mockLeaderboard';
import { PROGRAM } from './program';

const CYCLE = CLOSED_CYCLES[0];

/** The first mock wallet whose standing in `CYCLE` passes `test`. */
function findAddress(test: (rank: number | null) => boolean): string {
  for (let i = 0; i < 1000; i++) {
    const address = `0x${hashHex(`spec:${i}`, 40)}`;
    if (test(creatorStanding(address, CYCLE)?.rank ?? null)) return address;
  }
  throw new Error('no mock wallet matches');
}

describe('cycleDistribution', () => {
  it('should split the whole pool, highest payout first', () => {
    const amounts = cycleDistribution(CYCLE);
    const total = amounts.reduce((sum, amount) => sum + amount, 0);

    expect(total).toBeCloseTo(PROGRAM.poolUsdc, -1);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });
});

describe('leaderboardFor', () => {
  describe('when nobody asks', () => {
    it('should rank the top 20 creators and scenes by what they were paid', () => {
      const { creators, scenes, me } = leaderboardFor(CYCLE);

      for (const board of [creators, scenes]) {
        expect(board.map(row => row.rank)).toEqual(
          Array.from({ length: PROGRAM.leaderboardSize }, (_, i) => i + 1),
        );
        const amounts = board.map(row => row.amount_usdc);
        expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
      }
      expect(me).toBeNull();
    });

    it('should vary from row to row, not hand every creator the same', () => {
      const { creators } = leaderboardFor(CYCLE);

      expect(new Set(creators.map(creator => creator.paid_places)).size).toBeGreaterThan(1);
      expect(creators.some(creator => creator.name === null)).toBe(true);
    });
  });

  describe('when the asking creator made the top 20', () => {
    it('should show them in their place on the board', () => {
      const address = findAddress(rank => rank !== null && rank <= PROGRAM.leaderboardSize);
      const { creators, me } = leaderboardFor(CYCLE, address);

      expect(creators[me!.rank - 1].address).toBe(address);
      expect(creators).toHaveLength(PROGRAM.leaderboardSize);
    });
  });

  describe('when the asking creator ranked below the top 20', () => {
    it('should answer their standing without putting them on the board', () => {
      const address = findAddress(rank => rank !== null && rank > PROGRAM.leaderboardSize);
      const { creators, me } = leaderboardFor(CYCLE, address);

      expect(me!.rank).toBeGreaterThan(PROGRAM.leaderboardSize);
      expect(creators.some(creator => creator.address === address)).toBe(false);
    });
  });
});

describe('the leaderboard and Past payouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should agree on what every cycle paid the creator', async () => {
    const address = findAddress(rank => rank !== null);
    const payouts = mockBackoffice.getPayouts(address);
    await vi.runAllTimersAsync();

    for (const payout of await payouts) {
      const cycle = CLOSED_CYCLES.find(closed => closed.id === payout.cycle_id)!;
      const { me } = leaderboardFor(cycle, address);
      if (payout.status === PayoutStatus.PAID) expect(me?.amount_usdc).toBe(payout.amount_usdc);
      else expect(me).toBeNull();
    }
  });
});
