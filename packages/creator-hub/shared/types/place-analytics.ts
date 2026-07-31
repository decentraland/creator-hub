/**
 * Analytics for a published Place.
 *
 * There is no analytics API yet, so these types describe the contract the UI is
 * written against and are currently satisfied by mocked data (see
 * `renderer/src/lib/placeAnalytics.ts`).
 */

/** Headline numbers for a Place, as shown in a row of the Analytics list. */
export type PlaceAnalyticsSummary = {
  placeId: string;
  name: string;
  thumbnail: string;
  /** `null` when the Place has no data yet (rendered as "-"). */
  totalVisits: number | null;
  newUsers: number | null;
  /** Percentage, 0-100. */
  day7Retention: number | null;
  /** MANA. */
  revenue: number | null;
  /** Minutes. */
  avgPlaytime: number | null;
};

export enum PlaceAccess {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

/** Place metadata shown beside the metrics on the detail page. */
export type PlaceDetails = {
  placeId: string;
  name: string;
  thumbnail: string;
  /** Share of positive ratings, 0-100. */
  likeRate: number | null;
  access: PlaceAccess;
  /** Name of the world the scene is published in. */
  publishedIn: string;
  lastPublishedBy: { name: string; avatar: string | null } | null;
  /** Epoch milliseconds. */
  lastUpdatedAt: number | null;
};

/** The metrics behind the two cards of the Overview tab. */
export type PlaceOverviewMetrics = {
  totalVisits: number | null;
  uniqueVisits: number | null;
  newUsers: number | null;
  concurrentUsers: number | null;
  /** MANA. */
  revenue: number | null;
  /** Percentage, 0-100. */
  day7Retention: number | null;
  /** Minutes. */
  avgPlaytime: number | null;
  /** Minutes. */
  afkTime: number | null;
  desktopUsers: number | null;
  mobileUsers: number | null;
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

/** How a week's active users split between first-timers, returners and win-backs. */
export type WeeklyUsersFlowPoint = {
  /** Epoch milliseconds of the start of the week. */
  date: number;
  newUsers: number | null;
  returnedUsers: number | null;
  reactivatedUsers: number | null;
};

/** The metrics behind the Visits tab. */
export type PlaceVisitsMetrics = {
  /** Unique visitors per platform over the last 60 days, deduplicated. */
  uniqueVisits: PlatformBreakdown;
  /** Unique active users in each week. */
  weeklyActiveUsers: TimeSeriesPoint[];
  weeklyUsersFlow: WeeklyUsersFlowPoint[];
};

/** The metrics behind the Retention tab. */
export type PlaceRetentionMetrics = {
  /** 60-day rolling average retention per platform, as percentages. */
  platforms: PlatformBreakdown;
  /** Percentage of each week's new users who came back on day 7. */
  day7ByCohortWeek: TimeSeriesPoint[];
  /** Percentage of last week's active users who did not return. */
  weeklyChurnRate: TimeSeriesPoint[];
};

/** Window the detail page's metrics are computed over. */
export enum DateRange {
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_60_DAYS = 'last_60_days',
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
