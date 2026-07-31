import type { PlaceAnalyticsDetail, PlaceAnalyticsSummary } from '/shared/types/place-analytics';
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
      publishedIn: 'worldname',
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
