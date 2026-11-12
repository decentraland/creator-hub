import type {
  CreatorFundCycles,
  CreatorFundPlace,
  Cycle,
  Leaderboard,
  LeaderboardCycle,
  MyPlaces,
  Payout,
} from '/shared/types/creator-fund';

import type { MetricsBatch } from '/@/lib/metricsApi';

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

/** The launch cycles 1–3 behind a closed test cycle that starts before the program. */
export const LAUNCH_CYCLES: CreatorFundCycles = {
  cycles: [
    {
      id: 4,
      start_at: '2026-11-02T15:10:00.000Z',
      end_at: '2026-11-10T15:10:00.000Z',
      pool_usdc: 1,
      status: 'closed',
    },
    ...[
      ['2026-11-15', '2026-12-01'],
      ['2026-12-01', '2026-12-16'],
      ['2026-12-16', '2027-01-01'],
    ].map(([start, end], index) => ({
      id: index + 1,
      start_at: `${start}T03:00:00.000Z`,
      end_at: `${end}T03:00:00.000Z`,
      pool_usdc: 10000,
      status: 'upcoming' as const,
    })),
  ],
};

/** The Creator Fund flag variant that starts the program with cycle 1. */
export const LAUNCH_VARIANT = {
  name: 'launch',
  enabled: true,
  payload: { type: 'json', value: '{"startDate":"2026-11-15T03:00:00Z"}' },
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

export const myPlaces = (places: CreatorFundPlace[], forCycle: Cycle = RUNNING): MyPlaces => ({
  cycle: forCycle,
  places,
});

type Values = Partial<
  Record<
    'new_decentraland_players_30d' | 'd3_retention_rate_30d' | 'avg_playtime_seconds_30d',
    number
  >
>;

/** A metrics answer for `places`, positionally; each place gets `values` unless overridden. */
export const metricsBatch = (
  places: CreatorFundPlace[],
  values: Values = {
    new_decentraland_players_30d: 1234,
    d3_retention_rate_30d: 0.102,
    avg_playtime_seconds_30d: 7680,
  },
): MetricsBatch => ({
  exported_at: '2026-11-03T15:24:00Z',
  source: 'test',
  locations: places.map(entry => ({
    location_key: entry.base_position,
    builder_project_id: null,
    x: 0,
    y: 0,
    metrics: Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        [{ series: 'all', period: null, value }],
      ]),
    ),
  })),
});

/** A payout for `forCycle`, one place per amount; paid ones carry an obviously fake hash. */
export const payout = (
  forCycle: Cycle,
  status: Payout['status'],
  places: [CreatorFundPlace, number][],
): Payout => ({
  cycle: forCycle,
  status,
  paid_places: places.length,
  amount_usdc: places.reduce((total, [, amount]) => total + amount, 0).toFixed(2),
  transaction_hash: status === 'paid' ? `0x${String(forCycle.id).padStart(64, '0')}` : null,
  paid_at: status === 'paid' ? forCycle.end_at : null,
  places: places.map(([entry, amount]) => ({ place: entry, amount_usdc: amount.toFixed(2) })),
});

export const ok = <T>(data: T, status = 200) => ({ ok: true as const, status, data });
export const fail = (status = 500) => ({ ok: false as const, status, error: 'boom' });
