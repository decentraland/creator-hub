import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';

import { MOCK_EMPTY_PLACES } from './placeAnalytics.mock';

/**
 * Which fixture the mocked API resolves. Swap for `MOCK_PLACES` to work on the
 * populated list while the real endpoint does not exist.
 */
const MOCKED_PLACES: PlaceAnalyticsSummary[] = MOCK_EMPTY_PLACES;

/**
 * Analytics data source for published Places.
 *
 * The analytics API is not available yet, so every method resolves mocked data.
 * When it lands, replace the method bodies with real requests — the return
 * shapes are the contract the UI already consumes.
 */
export class PlaceAnalytics {
  /** Places owned by `address`, with their headline metrics. */
  public async fetchPlaces(_address: string): Promise<PlaceAnalyticsSummary[]> {
    // TODO: replace with a request to the analytics API once it exists.
    return MOCKED_PLACES;
  }
}
