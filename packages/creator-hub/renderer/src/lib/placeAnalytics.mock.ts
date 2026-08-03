import type {
  DateRange,
  PlaceAnalyticsDetail,
  PlaceAnalyticsSummary,
  PlaceEngagementMetrics,
  PlaceRetentionMetrics,
  PlaceVisitsMetrics,
  TimeSeriesPoint,
  WeeklyUsersFlowPoint,
} from '/shared/types/place-analytics';
import { PlaceAccess } from '/shared/types/place-analytics';

import THUMBNAIL from '/assets/images/scene-thumbnail-fallback.png';

/** A creator with no published Places, or with Places that have no data yet. */
export const MOCK_EMPTY_PLACES: PlaceAnalyticsSummary[] = [];

/** The rows from the designs, including a Place that has not collected data yet. */
export const MOCK_PLACES: PlaceAnalyticsSummary[] = [
  {
    placeId: 'bananarama',
    name: 'Bananarama',
    thumbnail: THUMBNAIL,
    totalVisits: 2000,
    newUsers: 10,
    day7Retention: 35,
    revenue: 106.7,
    avgPlaytime: 95,
  },
  {
    placeId: 'halloween-nightmare',
    name: 'Halloween Nightmare',
    thumbnail: THUMBNAIL,
    totalVisits: 127,
    newUsers: 3,
    day7Retention: 12,
    revenue: 56,
    avgPlaytime: 20,
  },
  {
    placeId: 'unmonday-club',
    name: 'Unmonday Club',
    thumbnail: THUMBNAIL,
    totalVisits: null,
    newUsers: null,
    day7Retention: null,
    revenue: null,
    avgPlaytime: null,
  },
];

/** The designs' "Last Update": 12/07/2026 5:26 PM, local time wherever it runs. */
const LAST_UPDATED_AT = new Date(2026, 11, 7, 17, 26).getTime();

const MOCK_DETAILS: Record<string, PlaceAnalyticsDetail> = {
  bananarama: {
    place: {
      placeId: 'bananarama',
      name: 'Bananarama',
      thumbnail: THUMBNAIL,
      likeRate: 87,
      access: PlaceAccess.PRIVATE,
      publishedIn: 'bananarama.dcl.eth',
      lastPublishedBy: { name: 'UserName', avatar: null },
      lastUpdatedAt: LAST_UPDATED_AT,
    },
    overview: {
      totalVisits: 2000,
      uniqueVisits: 324,
      newUsers: 10,
      concurrentUsers: 124,
      revenue: 106.7,
      day7Retention: 35,
      avgPlaytime: 95,
      afkTime: 12,
      desktopUsers: 124,
      mobileUsers: 14,
    },
  },
  'halloween-nightmare': {
    place: {
      placeId: 'halloween-nightmare',
      name: 'Halloween Nightmare',
      thumbnail: THUMBNAIL,
      likeRate: 64,
      access: PlaceAccess.PUBLIC,
      publishedIn: 'nightmare.dcl.eth',
      lastPublishedBy: { name: 'UserName', avatar: null },
      lastUpdatedAt: LAST_UPDATED_AT,
    },
    overview: {
      totalVisits: 127,
      uniqueVisits: 98,
      newUsers: 3,
      concurrentUsers: 6,
      revenue: 56,
      day7Retention: 12,
      avgPlaytime: 20,
      afkTime: 4,
      desktopUsers: 88,
      mobileUsers: 10,
    },
  },
  /** A Place that is live but has not collected any data yet. */
  'unmonday-club': {
    place: {
      placeId: 'unmonday-club',
      name: 'Unmonday Club',
      thumbnail: THUMBNAIL,
      likeRate: null,
      access: PlaceAccess.PUBLIC,
      publishedIn: 'unmonday.dcl.eth',
      lastPublishedBy: { name: 'UserName', avatar: null },
      lastUpdatedAt: LAST_UPDATED_AT,
    },
    overview: {
      totalVisits: null,
      uniqueVisits: null,
      newUsers: null,
      concurrentUsers: null,
      revenue: null,
      day7Retention: null,
      avgPlaytime: null,
      afkTime: null,
      desktopUsers: null,
      mobileUsers: null,
    },
  },
};

export function getMockDetail(placeId: string): PlaceAnalyticsDetail | undefined {
  return MOCK_DETAILS[placeId];
}

/** Weeks of the charts in the designs: Mar 16 2026 onwards, one point per week. */
const FIRST_WEEK = new Date(2026, 2, 16).getTime();
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

function weekly(values: Array<number | null>): TimeSeriesPoint[] {
  return values.map((value, index) => ({ date: FIRST_WEEK + index * ONE_WEEK, value }));
}

const MOCK_RETENTION: Record<string, PlaceRetentionMetrics> = {
  bananarama: {
    platforms: { all: 10.2, desktop: 11.1, mobile: 9.1 },
    day7ByCohortWeek: weekly([
      12.8, 18.5, 15.1, 13.2, 10.9, 9.4, 10.6, 11.8, 25.1, 27, 29.2, 22.4, 14.5,
    ]),
    weeklyChurnRate: weekly([
      31.2, 79.1, 54.3, 78.6, 41.2, 71.4, 49.1, 63.2, 41.4, 78.9, 68.2, 88.1, 72.3, 70.4,
    ]),
  },
  'halloween-nightmare': {
    platforms: { all: 4.8, desktop: 5.2, mobile: 3.9 },
    day7ByCohortWeek: weekly([8.1, 6.4, 9.7, 5.2, 7.8, 4.9, 6.1, 5.5, 7.2, 6.8, 5.1, 4.4, 6.2]),
    weeklyChurnRate: weekly([
      62.1, 84.3, 71.2, 88.4, 76.5, 91.2, 80.1, 85.6, 74.3, 89.7, 82.4, 90.1, 86.2, 87.5,
    ]),
  },
  /** Live, but nothing measured yet — the charts render their empty state. */
  'unmonday-club': {
    platforms: { all: null, desktop: null, mobile: null },
    day7ByCohortWeek: [],
    weeklyChurnRate: [],
  },
};

export function getMockRetention(placeId: string): PlaceRetentionMetrics | undefined {
  return MOCK_RETENTION[placeId];
}

function weeklyFlow(
  rows: Array<[number | null, number | null, number | null]>,
): WeeklyUsersFlowPoint[] {
  return rows.map(([newUsers, returnedUsers, reactivatedUsers], index) => ({
    date: FIRST_WEEK + index * ONE_WEEK,
    newUsers,
    returnedUsers,
    reactivatedUsers,
  }));
}

const MOCK_VISITS: Record<string, PlaceVisitsMetrics> = {
  bananarama: {
    uniqueVisits: { all: 127, desktop: 127, mobile: 125 },
    weeklyActiveUsers: weekly([48, 74, 61, 96, 132, 118, 87, 154, 141, 109, 96, 128, 112]),
    weeklyUsersFlow: weeklyFlow([
      [38, 12, 8],
      [57, 21, 24],
      [36, 141, 32],
      [8, 92, 172],
      [59, 24, 15],
      [6, 137, 96],
      [46, 14, 8],
      [12, 28, 22],
      [58, 22, 18],
      [50, 32, 48],
      [12, 24, 14],
      [38, 18, 6],
      [40, 16, 8],
    ]),
  },
  'halloween-nightmare': {
    uniqueVisits: { all: 42, desktop: 31, mobile: 14 },
    weeklyActiveUsers: weekly([12, 18, 9, 22, 14, 8, 16, 11, 19, 7, 13, 10, 15]),
    weeklyUsersFlow: weeklyFlow([
      [8, 3, 1],
      [11, 5, 2],
      [4, 4, 1],
      [12, 7, 3],
      [6, 6, 2],
      [3, 4, 1],
      [9, 5, 2],
      [5, 4, 2],
      [10, 6, 3],
      [2, 4, 1],
      [7, 4, 2],
      [4, 5, 1],
      [8, 5, 2],
    ]),
  },
  /** Live, but nothing measured yet — the charts render their empty state. */
  'unmonday-club': {
    uniqueVisits: { all: null, desktop: null, mobile: null },
    weeklyActiveUsers: [],
    weeklyUsersFlow: [],
  },
};

export function getMockVisits(placeId: string): PlaceVisitsMetrics | undefined {
  return MOCK_VISITS[placeId];
}

const MOCK_ENGAGEMENT: Record<string, PlaceEngagementMetrics> = {
  bananarama: {
    avgDailyPlaytime: {
      minutes: 25,
      deltaMinutes: 6.6,
      weekly: weekly([19, 20.5, 19.4, 30, 15.2, 28.4, 16.1, 22.3, 18.6, 13.1, 14.8, 17.2, 25]),
    },
    avgWeeklyPlaytime: {
      minutes: 29,
      deltaMinutes: 2.9,
      weekly: weekly([20.4, 21.1, 20.6, 15.8, 21.3, 22.6, 14.2, 20.1, 21.8, 23.4, 22.1, 25.6, 29]),
    },
    socialInteractions: {
      weeklyTotals: {
        messagesSent: weekly([620, 540, 470, 610, 660, 980, 720, 500, 520, 400]),
        emotesPlayed: weekly([1340, 1210, 1120, 1310, 1400, 1250, 1180, 1360, 1510, 1470]),
        newFriendships: weekly([180, 240, 210, 190, 230, 170, 200, 240, 120, 50]),
      },
      visitorRate: {
        messagesSent: weekly([48, 44, 41, 45, 47, 62, 51, 42, 38, 31]),
        emotesPlayed: weekly([88, 84, 86, 79, 94, 82, 87, 89, 91, 95]),
        newFriendships: weekly([26, 21, 18, 24, 19, 27, 20, 22, 24, 25]),
      },
    },
  },
  'halloween-nightmare': {
    avgDailyPlaytime: {
      minutes: 12,
      deltaMinutes: -3.4,
      weekly: weekly([18.2, 16.4, 15.1, 17.3, 14.8, 13.2, 15.6, 12.9, 14.1, 13.6, 12.4, 15.4, 12]),
    },
    avgWeeklyPlaytime: {
      minutes: 16,
      deltaMinutes: -1.2,
      weekly: weekly([22.1, 20.4, 19.8, 21.2, 18.6, 17.9, 19.1, 16.8, 18.2, 17.2, 16.4, 17.2, 16]),
    },
    socialInteractions: {
      weeklyTotals: {
        messagesSent: weekly([84, 62, 71, 58, 66, 49, 55, 61, 48, 42]),
        emotesPlayed: weekly([210, 184, 196, 172, 188, 164, 178, 158, 166, 148]),
        newFriendships: weekly([18, 14, 21, 12, 16, 9, 13, 15, 8, 6]),
      },
      visitorRate: {
        messagesSent: weekly([32, 28, 31, 26, 29, 22, 25, 27, 21, 19]),
        emotesPlayed: weekly([64, 58, 61, 55, 59, 52, 56, 51, 54, 48]),
        newFriendships: weekly([12, 9, 14, 8, 11, 6, 9, 10, 5, 4]),
      },
    },
  },
  /** Live, but nothing measured yet — the charts render their empty state. */
  'unmonday-club': {
    avgDailyPlaytime: { minutes: null, deltaMinutes: null, weekly: [] },
    avgWeeklyPlaytime: { minutes: null, deltaMinutes: null, weekly: [] },
    socialInteractions: {
      weeklyTotals: { messagesSent: [], emotesPlayed: [], newFriendships: [] },
      visitorRate: { messagesSent: [], emotesPlayed: [], newFriendships: [] },
    },
  },
};

export function getMockEngagement(placeId: string): PlaceEngagementMetrics | undefined {
  return MOCK_ENGAGEMENT[placeId];
}

/**
 * How many trailing weeks each range keeps, for the mocked weekly series.
 *
 * A real API would also change the bucketing (daily buckets for a 7-day range,
 * say); these fixtures are weekly throughout, so the shortest range keeps two
 * points rather than collapsing a line chart to a single dot.
 */
const WEEKS_IN_RANGE: Record<DateRange, number> = {
  last_7_days: 2,
  last_30_days: 5,
  last_60_days: 9,
};

/** Keeps the trailing part of a weekly series that the range covers. */
export function sliceToRange<T>(points: T[], dateRange: DateRange): T[] {
  return points.slice(-WEEKS_IN_RANGE[dateRange]);
}
