import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';

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
