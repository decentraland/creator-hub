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
