import type { LocationMetrics, MetricLocation, MetricRow, MetricsBatch } from '/@/lib/metricsApi';
import type { WorldData, WorldDataResponse, WorldScene, WorldScenes } from '/@/lib/worlds';

import { hashBetween } from './hash';

/**
 * Demo data for the POC: Worlds and analytics for whoever is signed in.
 *
 * The Creator Fund surfaces only have something to show for a creator who
 * owns published Worlds with analytics, which most wallets testing the POC
 * don't. While demo data is on (POC menu, default on), the Worlds client and
 * the metrics client answer from here instead of the network:
 *
 * - `fetchWorlds({ authorized_deployer })` lists DEMO_WORLDS as owned by that wallet;
 * - `fetchWorldScenes(name)` answers for those names only, so nothing else (the
 *   publish flow asks about the creator's real NAMEs) is touched;
 * - `fetchMetrics` generates every metric the service exports, per scene.
 *
 * Everything is a function of the World name, so a scene shows the same
 * numbers on every visit.
 */

/** Name, title and the base parcel of each scene. */
const DEMO_WORLDS: Array<{ name: string; title: string; scenes: Array<[number, number]> }> = [
  { name: 'bananarama.dcl.eth', title: 'Bananarama', scenes: [[0, 0]] },
  // Foundation content in the fund's exclusion list: shows "Not eligible".
  { name: 'cozyfarm.dcl.eth', title: 'Cozy Farm', scenes: [[0, 0]] },
  { name: 'skyrace.dcl.eth', title: 'Sky Race', scenes: [[0, 0]] },
  { name: 'moonlit-gallery.dcl.eth', title: 'Moonlit Gallery', scenes: [[0, 0]] },
  { name: 'hidden-grove.dcl.eth', title: 'Hidden Grove', scenes: [[0, 0]] },
  // Two scenes in one World: two analytics rows, one tile.
  {
    name: 'pixel-arena.dcl.eth',
    title: 'Pixel Arena',
    scenes: [
      [0, 0],
      [4, 0],
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 16;

const demoWorld = (name: string) => DEMO_WORLDS.find(world => world.name === name);

export const isDemoWorld = (name: string) => !!demoWorld(name);

export function demoWorlds(params: {
  authorized_deployer: string;
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}): WorldDataResponse {
  const search = params.search?.trim().toLowerCase() ?? '';
  const worlds: WorldData[] = DEMO_WORLDS.filter(world => world.name.includes(search)).map(
    (world, i) => ({
      name: world.name,
      owner: params.authorized_deployer,
      deployedScenes: world.scenes.length,
      title: world.title,
      description: null,
      contentRating: null,
      spawnCoordinates: '0,0',
      skyboxTime: null,
      singlePlayer: false,
      showInPlaces: true,
      categories: [],
      thumbnailHash: null,
      lastDeployedAt: new Date(Date.now() - (i + 1) * 2 * DAY_MS).toISOString(),
      blockedSince: null,
      worldShape: null,
    }),
  );

  const byName = (a: WorldData, b: WorldData) => a.name.localeCompare(b.name);
  const byDeploy = (a: WorldData, b: WorldData) =>
    (a.lastDeployedAt ?? '').localeCompare(b.lastDeployedAt ?? '');
  worlds.sort(params.sort === 'name' ? byName : byDeploy);
  if (params.order === 'desc') worlds.reverse();

  const offset = params.offset ?? 0;
  return { worlds: worlds.slice(offset, offset + (params.limit ?? 100)), total: worlds.length };
}

/** `null` for any World that isn't a demo one, so the caller asks the real server. */
export function demoWorldScenes(worldName: string): WorldScenes | null {
  const world = demoWorld(worldName);
  if (!world) return null;
  const scenes = world.scenes.map(
    ([x, y]) =>
      ({
        worldName,
        parcels: [`${x},${y}`],
        entity: { metadata: { scene: { base: `${x},${y}` }, display: { title: world.title } } },
        createdAt: new Date(Date.now() - 3 * DAY_MS).toISOString(),
      }) as unknown as WorldScene,
  );
  return { scenes, total: scenes.length };
}

const round = (value: number, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Local `YYYY-MM-DD`, the way the adapter parses periods back. */
const localDay = (time: number) => {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** The Mondays starting the last 16 complete weeks, oldest first. */
function weekStarts(now = Date.now()): string[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const sinceMonday = (today.getDay() + 6) % 7;
  const lastCompleteMonday = today.getTime() - (sinceMonday + 7) * DAY_MS;
  return Array.from({ length: WEEKS }, (_, i) =>
    localDay(lastCompleteMonday - (WEEKS - 1 - i) * 7 * DAY_MS),
  );
}

/** Every metric the analytics service exports, for one scene. */
function demoBag(location: MetricLocation): LocationMetrics['metrics'] {
  const seed = `${location.world ?? 'land'}@${location.x},${location.y}`;
  const visitors60 = round(hashBetween(`${seed}:visitors`, 400, 6000));
  const desktopShare = hashBetween(`${seed}:desktop`, 0.15, 0.45);
  const retention = hashBetween(`${seed}:d7`, 0.06, 0.34);
  const playtime = hashBetween(`${seed}:play`, 120, 900);
  const afk = hashBetween(`${seed}:afk`, 30, 180);
  const concurrent = round(visitors60 / hashBetween(`${seed}:cc`, 900, 2400), 2);

  /** All / desktop / mobile rows; desktop and mobile drift from `all` by up to ±`spread`. */
  const split = (name: string, all: number, spread: number, decimals: number): MetricRow[] => [
    { series: 'all', period: null, value: round(all, decimals) },
    ...(['desktop', 'mobile'] as const).map(series => ({
      series,
      period: null,
      value: round(
        all * hashBetween(`${seed}:${name}:${series}`, 1 - spread, 1 + spread),
        decimals,
      ),
    })),
  ];
  const visitorRows = (visitors: number): MetricRow[] => [
    { series: 'all', period: null, value: visitors },
    { series: 'desktop', period: null, value: round(visitors * desktopShare) },
    { series: 'mobile', period: null, value: round(visitors * (1 - desktopShare)) },
  ];

  const weeks = weekStarts();
  const weekly = (name: string, base: number, decimals: number, perSeries: boolean): MetricRow[] =>
    weeks.flatMap((period, i): MetricRow[] => {
      // A gentle trend plus week-to-week noise.
      const trend = 0.75 + (0.5 * i) / (WEEKS - 1);
      const value = base * trend * hashBetween(`${seed}:${name}:${period}`, 0.7, 1.3);
      if (!perSeries) return [{ series: null, period, value: round(value, decimals) }];
      return [
        { series: 'all', period, value: round(value, decimals) },
        { series: 'desktop', period, value: round(value * desktopShare, decimals) },
        { series: 'mobile', period, value: round(value * (1 - desktopShare), decimals) },
      ];
    });
  const weeklyRate = (name: string, base: number): MetricRow[] =>
    weeks.flatMap((period, i) =>
      (['all', 'desktop', 'mobile'] as const).map(series => ({
        series,
        period,
        value: round(
          Math.min(0.95, base * hashBetween(`${seed}:${name}:${series}:${period}:${i}`, 0.6, 1.4)),
          6,
        ),
      })),
    );

  return {
    unique_visitors_60d: visitorRows(visitors60),
    unique_visitors_30d: visitorRows(round(visitors60 * 0.55)),
    unique_visits_60d: visitorRows(round(visitors60 * hashBetween(`${seed}:visits`, 1.5, 2.6))),
    unique_visits_30d: visitorRows(
      round(visitors60 * 0.55 * hashBetween(`${seed}:visits`, 1.5, 2.6)),
    ),
    d7_retention_rate_60d: split('d7_60', retention, 0.3, 6),
    d7_retention_rate_30d: split('d7_30', retention * 1.05, 0.3, 6),
    playtime_seconds_p50_60d: split('p50_60', playtime, 0.4, 2),
    playtime_seconds_p50_30d: split('p50_30', playtime * 1.08, 0.4, 2),
    avg_playtime_seconds_60d: split('avg_60', playtime * 1.4, 0.4, 2),
    avg_playtime_seconds_30d: split('avg_30', playtime * 1.45, 0.4, 2),
    avg_afk_seconds_per_user_60d: split('afk_60', afk, 0.5, 2),
    avg_afk_seconds_per_user_30d: split('afk_30', afk * 0.95, 0.5, 2),
    concurrent_users_avg_60d: [{ series: null, period: null, value: concurrent }],
    concurrent_users_avg_30d: [{ series: null, period: null, value: round(concurrent * 1.1, 2) }],
    concurrent_users_peak_60d: [{ series: null, period: null, value: round(concurrent * 7 + 3) }],
    concurrent_users_peak_30d: [{ series: null, period: null, value: round(concurrent * 6 + 3) }],
    unique_visitors_weekly: weekly('wau', visitors60 / 7, 0, true),
    d7_retention_rate_weekly: weeklyRate('d7w', retention),
    socially_engaged_ratio_weekly: weekly(
      'social',
      hashBetween(`${seed}:social`, 0.15, 0.45),
      6,
      false,
    ),
  };
}

/** A whole batch, positional like the real one: entry `i` answers `locations[i]`. */
export function demoMetricsBatch(locations: MetricLocation[]): MetricsBatch {
  return {
    exported_at: new Date(Date.now() - DAY_MS).toISOString(),
    source: 'creator-fund-poc-demo',
    locations: locations.map(location => ({
      ...location,
      location_key: `${location.world ?? ''}|${location.x}|${location.y}`,
      builder_project_id: null,
      // A scene outside the demo set (a real LAND scene, say) gets data too.
      metrics: demoBag(location),
    })),
  };
}
