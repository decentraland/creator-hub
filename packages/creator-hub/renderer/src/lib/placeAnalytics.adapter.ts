import type {
  PlaceAnalyticsSummary,
  PlaceEngagementMetrics,
  PlaceOverviewMetrics,
  PlaceRetentionMetrics,
  PlaceVisitsMetrics,
  PlatformBreakdown,
  TimeSeriesPoint,
} from '/shared/types/place-analytics';
import type { MetricsWindow } from '/shared/types/place-analytics';

import type { LocationMetrics, MetricRow } from './metricsApi';

/**
 * Projects the analytics API's flat metric bag onto the shapes the tabs render.
 *
 * `metrics[name]` is a list of `{ series, period, value }` rows. Fourteen metrics
 * split three ways by platform; five carry no series at all. Reading a split
 * metric without picking a series returns three rows and silently yields the
 * wrong number, so the two readers below are deliberately separate: a call site
 * has to say which kind it is reading.
 *
 * Anything the API does not carry stays `null` or empty, which the UI renders as
 * "-" or "no data yet". Partial bags are the norm — most locations carry only
 * some of the 19 — so every field falls back on its own.
 */

/** Every metric the service exports. */
export const METRIC_NAMES = [
  'avg_afk_seconds_per_user_30d',
  'avg_afk_seconds_per_user_60d',
  'avg_playtime_seconds_30d',
  'avg_playtime_seconds_60d',
  'concurrent_users_avg_30d',
  'concurrent_users_avg_60d',
  'concurrent_users_peak_30d',
  'concurrent_users_peak_60d',
  'd7_retention_rate_30d',
  'd7_retention_rate_60d',
  'd7_retention_rate_weekly',
  'playtime_seconds_p50_30d',
  'playtime_seconds_p50_60d',
  'socially_engaged_ratio_weekly',
  'unique_visitors_30d',
  'unique_visitors_60d',
  'unique_visitors_weekly',
  'unique_visits_30d',
  'unique_visits_60d',
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

/** The metrics whose rows carry `series: null`. Every other one splits three ways. */
export const SINGLE_SERIES_METRICS = [
  'concurrent_users_avg_30d',
  'concurrent_users_avg_60d',
  'concurrent_users_peak_30d',
  'concurrent_users_peak_60d',
  'socially_engaged_ratio_weekly',
] as const;

type SingleSeriesMetric = (typeof SINGLE_SERIES_METRICS)[number];
type SplitMetric = Exclude<MetricName, SingleSeriesMetric>;
type Platform = 'all' | 'desktop' | 'mobile';

type Bag = LocationMetrics['metrics'];

const SECONDS_PER_MINUTE = 60;

const rowsOf = (bag: Bag, name: MetricName): MetricRow[] => bag[name] ?? [];

/** A platform-split metric with no period: one value for the whole window. */
function platformValue(bag: Bag, name: SplitMetric, series: Platform): number | null {
  return rowsOf(bag, name).find(row => row.series === series)?.value ?? null;
}

/** A metric that has no series: its single value for the whole window. */
function singleValue(bag: Bag, name: SingleSeriesMetric): number | null {
  return rowsOf(bag, name)[0]?.value ?? null;
}

/**
 * Reads a period as local midnight.
 *
 * `new Date('2026-07-27')` parses as UTC, which renders as the 26th anywhere
 * west of Greenwich — every bucket would be labelled a day early.
 */
function parsePeriod(period: string): number {
  const [year, month, day] = period.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/**
 * A metric bucketed by week, oldest first.
 *
 * The export carries the last 16 complete weeks and is rebuilt daily, so the
 * series never grows — next month's response holds 16 later weeks.
 */
function weeklySeries(
  bag: Bag,
  name: MetricName,
  series: Platform | null,
  transform: (value: number) => number = value => value,
): TimeSeriesPoint[] {
  return rowsOf(bag, name)
    .filter(row => row.period !== null && row.series === series)
    .map(row => ({ date: parsePeriod(row.period as string), value: transform(row.value) }))
    .sort((a, b) => a.date - b.date);
}

/** Rates arrive as fractions (`0.1216`); every percentage in the UI is 0-100. */
const toPercentage = (value: number | null): number | null => (value === null ? null : value * 100);

/** Playtime and AFK are exported in seconds; the UI reads minutes throughout. */
const toMinutes = (value: number | null): number | null =>
  value === null ? null : value / SECONDS_PER_MINUTE;

function platforms(bag: Bag, name: SplitMetric, transform = (value: number | null) => value) {
  return {
    all: transform(platformValue(bag, name, 'all')),
    desktop: transform(platformValue(bag, name, 'desktop')),
    mobile: transform(platformValue(bag, name, 'mobile')),
  } satisfies PlatformBreakdown;
}

/**
 * Whether the API returned nothing for this location — either because the wallet
 * may not read it or because today's export holds no rows. The two are
 * deliberately indistinguishable, so both render as "no data yet", never as an
 * error.
 */
export const hasNoData = (location: LocationMetrics): boolean =>
  Object.keys(location.metrics).length === 0;

export function toOverview(
  { metrics }: LocationMetrics,
  window: MetricsWindow,
): PlaceOverviewMetrics {
  return {
    totalVisits: platformValue(metrics, `unique_visits_${window}`, 'all'),
    uniqueVisits: platformValue(metrics, `unique_visitors_${window}`, 'all'),
    concurrentUsers: singleValue(metrics, `concurrent_users_avg_${window}`),
    peakConcurrentUsers: singleValue(metrics, `concurrent_users_peak_${window}`),
    day7Retention: toPercentage(platformValue(metrics, `d7_retention_rate_${window}`, 'all')),
    medianPlaytime: toMinutes(platformValue(metrics, `playtime_seconds_p50_${window}`, 'all')),
    afkTime: toMinutes(platformValue(metrics, `avg_afk_seconds_per_user_${window}`, 'all')),
    desktopUsers: platformValue(metrics, `unique_visitors_${window}`, 'desktop'),
    mobileUsers: platformValue(metrics, `unique_visitors_${window}`, 'mobile'),
  };
}

export function toVisits({ metrics }: LocationMetrics, window: MetricsWindow): PlaceVisitsMetrics {
  return {
    uniqueVisits: platforms(metrics, `unique_visits_${window}`),
    weeklyActiveUsers: weeklySeries(metrics, 'unique_visitors_weekly', 'all'),
  };
}

export function toRetention(
  { metrics }: LocationMetrics,
  window: MetricsWindow,
): PlaceRetentionMetrics {
  return {
    platforms: platforms(metrics, `d7_retention_rate_${window}`, toPercentage),
    day7ByCohortWeek: weeklySeries(
      metrics,
      'd7_retention_rate_weekly',
      'all',
      value => value * 100,
    ),
  };
}

export function toEngagement(
  { metrics }: LocationMetrics,
  window: MetricsWindow,
): PlaceEngagementMetrics {
  return {
    medianPlaytime: toMinutes(platformValue(metrics, `playtime_seconds_p50_${window}`, 'all')),
    afkTime: toMinutes(platformValue(metrics, `avg_afk_seconds_per_user_${window}`, 'all')),
    sociallyEngaged: weeklySeries(
      metrics,
      'socially_engaged_ratio_weekly',
      null,
      value => value * 100,
    ),
  };
}

/** The headline figures one row of the Places list shows. */
export function toSummary(
  location: LocationMetrics,
  window: MetricsWindow,
  { placeId, name, thumbnail }: { placeId: string; name: string; thumbnail: string },
): PlaceAnalyticsSummary {
  const overview = toOverview(location, window);
  return {
    placeId,
    name,
    thumbnail,
    totalVisits: overview.totalVisits,
    day7Retention: overview.day7Retention,
    medianPlaytime: overview.medianPlaytime,
    concurrentUsers: overview.concurrentUsers,
    hasNoData: hasNoData(location),
  };
}
