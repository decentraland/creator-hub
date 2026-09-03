/**
 * Analytics for a published scene, as projected from the creators-data API.
 *
 * The API answers a flat bag of `{ series, period, value }` rows per location;
 * these are the shapes the tabs render. See `renderer/src/lib/placeAnalytics.adapter.ts`.
 *
 * Several fields the UI once showed have no metric behind them any more. They are
 * commented out rather than deleted, next to the metric they are waiting on, so
 * restoring one is uncommenting it here, in the adapter and in the tab.
 */

/** Headline numbers for a scene, as shown in a row of the Analytics list. */
export type PlaceAnalyticsSummary = {
  placeId: string;
  name: string;
  thumbnail: string;
  /** `null` when the scene has no data for this metric (rendered as "-"). */
  totalVisits: number | null;
  /** Percentage, 0-100. */
  day7Retention: number | null;
  /** Minutes. */
  avgPlaytime: number | null;
  concurrentUsers: number | null;
  /** True when the API returned no metrics at all for this scene. */
  hasNoData: boolean;
  // newUsers: awaiting a first-time-visitor metric.
  // revenue: awaiting a revenue metric (MANA).
};

export enum PlaceAccess {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

/** Scene metadata shown beside the metrics on the detail page. */
export type PlaceDetails = {
  placeId: string;
  name: string;
  thumbnail: string;
  /** Share of positive ratings, 0-100. */
  likeRate: number | null;
  access: PlaceAccess;
  /** Where the scene is published: the world's name, or "Genesis City". */
  publishedIn: string;
  /** Where to jump in — a Genesis City scene is reached by position, not realm. */
  location: { world?: string; x: number; y: number };
  lastPublishedBy: { name: string; avatar: string | null } | null;
  /** Epoch milliseconds of the last deploy. */
  lastUpdatedAt: number | null;
};

/** The metrics behind the two cards of the Overview tab. */
export type PlaceOverviewMetrics = {
  /** Visits, not visitors — `unique_visits_*`. */
  totalVisits: number | null;
  /** Distinct wallets — `unique_visitors_*`. */
  uniqueVisits: number | null;
  concurrentUsers: number | null;
  peakConcurrentUsers: number | null;
  /** Percentage, 0-100. */
  day7Retention: number | null;
  /** Minutes. */
  avgPlaytime: number | null;
  /** Minutes. */
  afkTime: number | null;
  desktopUsers: number | null;
  mobileUsers: number | null;
  // newUsers: awaiting a first-time-visitor metric.
  // revenue: awaiting a revenue metric (MANA).
};

export type PlaceAnalyticsDetail = {
  place: PlaceDetails;
  overview: PlaceOverviewMetrics;
};

/** One point of a weekly series. */
export type TimeSeriesPoint = {
  /** Epoch milliseconds of the start of the week. */
  date: number;
  /** `null` for a week with no data, which the charts leave as a gap. */
  value: number | null;
};

/** A metric compared across the platforms users play on; the unit is the metric's. */
export type PlatformBreakdown = {
  all: number | null;
  desktop: number | null;
  mobile: number | null;
};

/** The metrics behind the Visits tab. */
export type PlaceVisitsMetrics = {
  /** Visits per platform over the selected window. */
  uniqueVisits: PlatformBreakdown;
  /** Distinct wallets in each week — `unique_visitors_weekly`. */
  weeklyActiveUsers: TimeSeriesPoint[];
  // weeklyUsersFlow: awaiting a new/returning/reactivated breakdown.
};

/** The metrics behind the Retention tab. */
export type PlaceRetentionMetrics = {
  /** Day-7 retention per platform over the selected window, as percentages. */
  platforms: PlatformBreakdown;
  /** Day-7 retention of each week's cohort, as percentages. */
  day7ByCohortWeek: TimeSeriesPoint[];
  // weeklyChurnRate: awaiting a churn metric. 1 - d7 retention is not churn.
};

/** The metrics behind the Engagement tab. */
export type PlaceEngagementMetrics = {
  /** Minutes, over the selected window. */
  avgPlaytime: number | null;
  /** Minutes per user, over the selected window. */
  afkTime: number | null;
  /** Share of each week's visitors who engaged socially, as percentages. */
  sociallyEngaged: TimeSeriesPoint[];
  // avgDailyPlaytime / avgWeeklyPlaytime: awaiting a weekly playtime metric.
  //   Only trailing-window scalars exist, so neither a series nor a
  //   week-over-week delta can be computed.
  // socialInteractions: awaiting per-action metrics (messages, emotes,
  //   friendships). `socially_engaged_ratio_weekly` is one ratio with no
  //   breakdown, and is projected onto `sociallyEngaged` above.
};

/**
 * Trailing window the scalar metrics are read over.
 *
 * The value is the metric-name suffix, so a projection composes the name
 * directly (`unique_visitors_${window}`). It is not a date filter: 30d and 60d
 * are separate metrics, and the weekly series always carry their full 16 weeks.
 */
export enum MetricsWindow {
  LAST_30_DAYS = '30d',
  LAST_60_DAYS = '60d',
}

export enum SortBy {
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  MOST_VISITS = 'most_visits',
}

/**
 * Day 7 retention the list considers healthy, from the "20% Day 7 KR" benchmark
 * drawn on the Retention chart. At or above it the value reads as positive.
 */
export const DAY_7_RETENTION_BENCHMARK = 20;
