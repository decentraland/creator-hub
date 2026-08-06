import type {
  PlaceAnalyticsSummary,
  PlaceEngagementMetrics,
  PlaceOverviewMetrics,
  PlaceRetentionMetrics,
  PlaceVisitsMetrics,
  TimeSeriesPoint,
  WeeklyUsersFlowPoint,
} from '/shared/types/place-analytics';

import type { MetricRow, WorldMetrics } from './metricsApi';

/**
 * Projects the analytics API's flat metric bag onto the shapes the tabs render.
 *
 * The API answers one payload per world: `metrics[name]` is a list of
 * `{ series, period, value }` rows, where `series` splits a metric (desktop vs
 * mobile) and `period` is the day or week bucket. Anything the API does not
 * carry stays `null`, which the UI already renders as "-".
 */

/** Rates arrive as fractions (`0.7026`); every percentage in the UI is 0-100. */
function toPercentage(value: number | null): number | null {
  return value === null ? null : value * 100;
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

function rowsOf(metrics: WorldMetrics['metrics'], name: string, series?: string): MetricRow[] {
  const rows = metrics[name] ?? [];
  return series === undefined ? rows : rows.filter(row => row.series === series);
}

/** A metric with no period: one value for the whole window. */
function valueOf(metrics: WorldMetrics['metrics'], name: string, series?: string): number | null {
  const [row] = rowsOf(metrics, name, series);
  return row?.value ?? null;
}

/** A metric bucketed by period, oldest first. */
function seriesOf(
  metrics: WorldMetrics['metrics'],
  name: string,
  series?: string,
  transform: (value: number) => number = value => value,
): TimeSeriesPoint[] {
  return rowsOf(metrics, name, series)
    .filter(row => row.period !== null)
    .map(row => ({ date: parsePeriod(row.period as string), value: transform(row.value) }))
    .sort((a, b) => a.date - b.date);
}

const lastValue = (points: TimeSeriesPoint[]): number | null =>
  points.length ? points[points.length - 1].value : null;

/** Change against the week before the latest one. */
function weekOverWeek(points: TimeSeriesPoint[]): number | null {
  if (points.length < 2) return null;
  const [previous, latest] = points.slice(-2);
  if (previous.value === null || latest.value === null) return null;
  return latest.value - previous.value;
}

/**
 * Weeks covered by the API's 60-day metrics, so figures shown next to them
 * cover the same window. Summing every bucket instead produced more new users
 * than unique visitors, which reads as nonsense side by side.
 */
const WEEKS_IN_60_DAYS = 9;

const sumRecent = (points: TimeSeriesPoint[], weeks: number): number | null =>
  points.length
    ? points.slice(-weeks).reduce((total, point) => total + (point.value ?? 0), 0)
    : null;

export function toOverview({ metrics }: WorldMetrics): PlaceOverviewMetrics {
  return {
    // The API counts unique visitors only — it has no repeat-visit total.
    totalVisits: null,
    uniqueVisits: valueOf(metrics, 'unique_visitors_60d'),
    newUsers: sumRecent(seriesOf(metrics, 'visitor_flow_weekly', 'new'), WEEKS_IN_60_DAYS),
    concurrentUsers: null,
    revenue: null,
    day7Retention: toPercentage(valueOf(metrics, 'd7_cohort_60d', 'blended')),
    avgPlaytime: lastValue(seriesOf(metrics, 'avg_session_minutes_weekly')),
    afkTime: null,
    desktopUsers: valueOf(metrics, 'visitors_by_platform_60d', 'desktop'),
    mobileUsers: valueOf(metrics, 'visitors_by_platform_60d', 'mobile'),
  };
}

export function toRetention({ metrics }: WorldMetrics): PlaceRetentionMetrics {
  return {
    platforms: {
      all: toPercentage(valueOf(metrics, 'd7_cohort_60d', 'blended')),
      desktop: toPercentage(valueOf(metrics, 'd7_cohort_60d', 'desktop')),
      mobile: toPercentage(valueOf(metrics, 'd7_cohort_60d', 'mobile')),
    },
    day7ByCohortWeek: seriesOf(metrics, 'retention_by_cohort_week', 'd7', value => value * 100),
    weeklyChurnRate: seriesOf(metrics, 'churn_rate_weekly', undefined, value => value * 100),
  };
}

export function toVisits({ metrics }: WorldMetrics): PlaceVisitsMetrics {
  const byWeek = new Map<number, WeeklyUsersFlowPoint>();
  const collect = (series: string, field: keyof Omit<WeeklyUsersFlowPoint, 'date'>) => {
    for (const point of seriesOf(metrics, 'visitor_flow_weekly', series)) {
      const week = byWeek.get(point.date) ?? {
        date: point.date,
        newUsers: null,
        returnedUsers: null,
        reactivatedUsers: null,
      };
      week[field] = point.value;
      byWeek.set(point.date, week);
    }
  };
  collect('new', 'newUsers');
  collect('retained', 'returnedUsers');
  collect('reactivated', 'reactivatedUsers');

  return {
    uniqueVisits: {
      all: valueOf(metrics, 'unique_visitors_60d'),
      desktop: valueOf(metrics, 'visitors_by_platform_60d', 'desktop'),
      mobile: valueOf(metrics, 'visitors_by_platform_60d', 'mobile'),
    },
    weeklyActiveUsers: seriesOf(metrics, 'wau_weekly'),
    weeklyUsersFlow: [...byWeek.values()].sort((a, b) => a.date - b.date),
  };
}

/**
 * Share of each week's active users who did something, from
 * `engagement_breadth_weekly` — `active` is the denominator for the rest.
 */
function breadthRate(metrics: WorldMetrics['metrics'], series: string): TimeSeriesPoint[] {
  const active = new Map(
    seriesOf(metrics, 'engagement_breadth_weekly', 'active').map(point => [
      point.date,
      point.value,
    ]),
  );
  return seriesOf(metrics, 'engagement_breadth_weekly', series).map(point => {
    const total = active.get(point.date);
    return {
      date: point.date,
      value: total && point.value !== null ? (point.value / total) * 100 : null,
    };
  });
}

export function toEngagement({ metrics }: WorldMetrics): PlaceEngagementMetrics {
  const daily = seriesOf(metrics, 'avg_session_minutes_weekly');
  const weekly = seriesOf(metrics, 'avg_active_minutes_weekly');

  return {
    // Per visit vs per week: the API's session average and active-minutes average.
    avgDailyPlaytime: {
      minutes: lastValue(daily),
      deltaMinutes: weekOverWeek(daily),
      weekly: daily,
    },
    avgWeeklyPlaytime: {
      minutes: lastValue(weekly),
      deltaMinutes: weekOverWeek(weekly),
      weekly,
    },
    socialInteractions: {
      weeklyTotals: {
        messagesSent: seriesOf(metrics, 'chat_messages_weekly'),
        emotesPlayed: seriesOf(metrics, 'emotes_weekly'),
        // No friendship metric in the API yet.
        newFriendships: [],
      },
      visitorRate: {
        messagesSent: breadthRate(metrics, 'chatting'),
        emotesPlayed: breadthRate(metrics, 'emoting'),
        newFriendships: [],
      },
    },
  };
}

/** The headline figures one row of the Places list shows. */
export function toSummary(
  worldMetrics: WorldMetrics,
  { name, thumbnail }: { name: string; thumbnail: string },
): PlaceAnalyticsSummary {
  const overview = toOverview(worldMetrics);
  return {
    placeId: worldMetrics.world,
    name,
    thumbnail,
    // Unique visitors, not total visits — see the column label.
    totalVisits: overview.uniqueVisits,
    newUsers: overview.newUsers,
    day7Retention: overview.day7Retention,
    revenue: overview.revenue,
    avgPlaytime: overview.avgPlaytime,
  };
}
