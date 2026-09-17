import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';
import { SortBy } from '/shared/types/place-analytics';

/** Places with no data yet sort last, whichever metric is being sorted on. */
function byMetricDesc(a: number | null, b: number | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compare(a: PlaceAnalyticsSummary, b: PlaceAnalyticsSummary, sortBy: SortBy) {
  switch (sortBy) {
    case SortBy.NAME_DESC:
      return b.name.localeCompare(a.name);
    case SortBy.MOST_VISITS:
      return byMetricDesc(a.totalVisits, b.totalVisits);
    case SortBy.NAME_ASC:
    default:
      return a.name.localeCompare(b.name);
  }
}

/** Filters by name, then sorts, keeping watchlisted places at the top. */
export function sortPlaces(
  places: PlaceAnalyticsSummary[],
  searchQuery: string,
  sortBy: SortBy,
  pinnedPlaceIds: string[] = [],
) {
  const query = searchQuery.trim().toLowerCase();
  const matching = query
    ? places.filter(place => place.name.toLowerCase().includes(query))
    : places;

  const isPinned = (place: PlaceAnalyticsSummary) => pinnedPlaceIds.includes(place.placeId);

  return [...matching].sort((a, b) => {
    if (isPinned(a) !== isPinned(b)) return isPinned(a) ? -1 : 1;
    return compare(a, b, sortBy);
  });
}
