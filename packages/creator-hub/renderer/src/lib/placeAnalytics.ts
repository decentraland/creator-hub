import type {
  DateRange,
  PlaceAnalyticsDetail,
  PlaceAnalyticsSummary,
  PlaceRetentionMetrics,
} from '/shared/types/place-analytics';

import { MOCK_PLACES, getMockDetail, getMockRetention } from './placeAnalytics.mock';

/**
 * Which fixture the mocked API resolves. Swap for `MOCK_EMPTY_PLACES` to work on
 * the empty state while the real endpoint does not exist.
 */
const MOCKED_PLACES: PlaceAnalyticsSummary[] = MOCK_PLACES;

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

  /**
   * Everything the detail page shows for one Place: its metadata and the
   * metrics for the given date range. The mocked data ignores `dateRange`, so
   * changing the range does not change the numbers yet.
   */
  public async fetchPlaceDetail(
    _address: string,
    placeId: string,
    _dateRange: DateRange,
  ): Promise<PlaceAnalyticsDetail> {
    // TODO: replace with a request to the analytics API once it exists.
    const detail = getMockDetail(placeId);
    if (!detail) throw new Error(`No analytics found for place "${placeId}"`);
    return detail;
  }

  /** Retention metrics for one Place over the given date range. */
  public async fetchPlaceRetention(
    _address: string,
    placeId: string,
    _dateRange: DateRange,
  ): Promise<PlaceRetentionMetrics> {
    // TODO: replace with a request to the analytics API once it exists.
    const retention = getMockRetention(placeId);
    if (!retention) throw new Error(`No retention data found for place "${placeId}"`);
    return retention;
  }
}
