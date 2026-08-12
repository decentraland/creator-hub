import type { ManagedProject } from '/shared/types/manage';
import type { Land } from '/@/lib/land';

import FALLBACK_THUMBNAIL from '/assets/images/scene-thumbnail-fallback.png';

import type { AnalyticsPlace } from './analyticsLocations';
import { collectAnalyticsPlaces } from './analyticsLocations';
import { devPlaces } from './placeAnalytics.dev';
import type { LocationMetrics } from './metricsApi';
import { fetchMetrics } from './metricsApi';

/** One request's worth of analytics: the export it came from, and a row per place. */
export type AnalyticsSnapshot = {
  /** The warehouse's export stamp — an "as of" date, not our load time. */
  exportedAt: string;
  /** Parallel to `places`, positionally. */
  places: AnalyticsPlace[];
  metricsByPlaceId: Record<string, LocationMetrics>;
};

/**
 * Analytics for every scene the signed-in wallet owns or collaborates on.
 *
 * One batched request answers the list and every tab of the detail page, so this
 * runs once and each projection reads from the same snapshot.
 */
export async function fetchAnalytics(
  projects: ManagedProject[],
  lands: Land[],
): Promise<AnalyticsSnapshot> {
  const places = devPlaces() ?? (await collectAnalyticsPlaces(projects, lands, FALLBACK_THUMBNAIL));

  if (places.length === 0) {
    // No scenes to ask about. Sending an empty list is a 400, and the page has an
    // empty state for exactly this.
    return { exportedAt: '', places: [], metricsByPlaceId: {} };
  }

  const batch = await fetchMetrics(places.map(place => place.location));

  return {
    exportedAt: batch.exported_at,
    places,
    metricsByPlaceId: Object.fromEntries(
      places.map((place, index) => [place.placeId, batch.locations[index]]),
    ),
  };
}
