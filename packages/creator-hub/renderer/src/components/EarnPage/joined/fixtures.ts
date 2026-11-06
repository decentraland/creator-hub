import type {
  CreatorFundCycles,
  CreatorFundPlace,
  Cycle,
  Leaderboard,
  LeaderboardCycle,
} from '/shared/types/creator-fund';

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

export const RUNNING = CYCLES.cycles[2];
export const LATEST_CLOSED = CYCLES.cycles[3];
export const OLDEST_CLOSED = CYCLES.cycles[0];

export const place = (id: string, overrides: Partial<CreatorFundPlace> = {}): CreatorFundPlace => ({
  id,
  title: `Example Place ${id}`,
  image: null,
  world: false,
  world_name: null,
  base_position: '5,7',
  positions: ['5,7'],
  owner: '0x0000000000000000000000000000000000000001',
  role: 'owner',
  status: 'in_program',
  reasons: [],
  ...overrides,
});

export const exampleWorld = (id: string, overrides: Partial<CreatorFundPlace> = {}) =>
  place(id, {
    title: `Example World ${id}`,
    world: true,
    world_name: 'example-world.dcl.eth',
    base_position: '0,0',
    positions: ['0,0'],
    ...overrides,
  });

export const leaderboard = (cycleId: LeaderboardCycle, count = 20): Leaderboard => ({
  cycle_id: cycleId,
  entries: Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    place:
      index % 2 === 0
        ? place(`place-${index}`, { title: `Example Place ${index + 1}`, base_position: '23,-14' })
        : exampleWorld(`place-${index}`, { title: `Example World ${index + 1}` }),
    earned_usdc: index === 0 ? '1842.50' : `${(1000 - index * 10).toFixed(2)}`,
  })),
});

export const ok = <T>(data: T, status = 200) => ({ ok: true as const, status, data });
export const fail = (status = 500) => ({ ok: false as const, status, error: 'boom' });
