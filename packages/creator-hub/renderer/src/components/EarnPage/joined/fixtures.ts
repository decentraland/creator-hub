import type { CreatorFundCycles, Cycle } from '/shared/types/creator-fund';

const cycle = (id: number, start: string, end: string, status: Cycle['status']): Cycle => ({
  id,
  start_at: `${start}T00:00:00Z`,
  end_at: `${end}T00:00:00Z`,
  pool_usdc: 10000,
  status,
});

/** Test fixtures for the joined Creator Fund page: obviously fake places and cycles. */
export const CYCLES: CreatorFundCycles = {
  cycles: [
    cycle(1, '2026-10-01', '2026-10-16', 'closed'),
    cycle(4, '2026-11-16', '2026-12-01', 'upcoming'),
    cycle(3, '2026-11-01', '2026-11-16', 'running'),
    cycle(2, '2026-10-16', '2026-11-01', 'closed'),
  ],
};

export const ok = <T>(data: T, status = 200) => ({ ok: true as const, status, data });
export const fail = (status = 500) => ({ ok: false as const, status, error: 'boom' });
