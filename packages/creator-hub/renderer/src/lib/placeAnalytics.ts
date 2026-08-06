import type {
  DateRange,
  PlaceAnalyticsDetail,
  PlaceAnalyticsSummary,
  PlaceEngagementMetrics,
  PlaceRetentionMetrics,
  PlaceVisitsMetrics,
  SocialInteractionSeries,
  TimeSeriesPoint,
} from '/shared/types/place-analytics';
import { PlaceAccess } from '/shared/types/place-analytics';

import { config } from '/@/config';

import FALLBACK_THUMBNAIL from '/assets/images/scene-thumbnail-fallback.png';

import { MetricsApi, type MetricsResponseOf, type WorldMetrics } from './metricsApi';
import {
  toEngagement,
  toOverview,
  toRetention,
  toSummary,
  toVisits,
} from './placeAnalytics.adapter';
import {
  MOCK_PLACES,
  getMockDetail,
  getMockEngagement,
  getMockRetention,
  getMockVisits,
  sliceToRange,
} from './placeAnalytics.mock';

/**
 * Serve fixtures instead of calling the API. Useful without an authorized
 * wallet — every real request 403s unless the world is on the caller's
 * deploy list.
 */
const USE_MOCK = config.get('METRICS_USE_MOCK') === 'true';

/** Which fixture the mocked source resolves; `MOCK_EMPTY_PLACES` for the empty state. */
const MOCKED_PLACES: PlaceAnalyticsSummary[] = MOCK_PLACES;

/**
 * Analytics for published Places.
 *
 * The API is world-scoped (`/worlds/:world/metrics`) and answers one flat bag
 * of metrics per world, so a Place id is a world name and every tab reads from
 * the same response. Projecting that bag onto each tab's shape lives in
 * `placeAnalytics.adapter.ts`.
 */
export class PlaceAnalytics {
  private api = new MetricsApi();

  /** Unwraps a response, turning the API's error shape into a thrown error. */
  private unwrap<T>(response: MetricsResponseOf<T>): T {
    if (!response.ok) throw new Error(response.error);
    return response.data;
  }

  private async worldMetrics(placeId: string): Promise<WorldMetrics> {
    return this.unwrap(await this.api.world(placeId));
  }

  /** Places the connected wallet can see, with their headline metrics. */
  public async fetchPlaces(_address: string): Promise<PlaceAnalyticsSummary[]> {
    if (USE_MOCK) return MOCKED_PLACES;

    const { worlds } = this.unwrap(await this.api.me());

    /*
     * One request per world: the API has no bulk summary endpoint, so the list
     * is N+1. Worlds whose metrics fail are dropped rather than failing the
     * whole page.
     */
    const summaries = await Promise.all(
      worlds.map(async ({ world, name }) => {
        const response = await this.api.world(world);
        if (!response.ok) return null;
        return toSummary(response.data, {
          name: typeof name === 'string' ? name : world,
          thumbnail: FALLBACK_THUMBNAIL,
        });
      }),
    );

    return summaries.filter(summary => summary !== null);
  }

  /**
   * The detail page's metadata and Overview metrics.
   *
   * The analytics API carries no Place metadata — no thumbnail, access, rating
   * or publisher — so those stay empty until they come from the places API.
   */
  public async fetchPlaceDetail(
    _address: string,
    placeId: string,
    _dateRange: DateRange,
  ): Promise<PlaceAnalyticsDetail> {
    if (USE_MOCK) {
      const detail = getMockDetail(placeId);
      if (!detail) throw new Error(`No analytics found for place "${placeId}"`);
      return detail;
    }

    const worldMetrics = await this.worldMetrics(placeId);
    return {
      place: {
        placeId,
        name: placeId,
        thumbnail: FALLBACK_THUMBNAIL,
        likeRate: null,
        access: PlaceAccess.PUBLIC,
        publishedIn: placeId,
        lastPublishedBy: null,
        lastUpdatedAt: null,
      },
      overview: toOverview(worldMetrics),
    };
  }

  /** Retention metrics for one Place over the given date range. */
  public async fetchPlaceRetention(
    _address: string,
    placeId: string,
    dateRange: DateRange,
  ): Promise<PlaceRetentionMetrics> {
    if (USE_MOCK) {
      const retention = getMockRetention(placeId);
      if (!retention) throw new Error(`No retention data found for place "${placeId}"`);
      return {
        // Platform averages are defined as 60-day, so the range does not narrow them.
        platforms: retention.platforms,
        day7ByCohortWeek: sliceToRange(retention.day7ByCohortWeek, dateRange),
        weeklyChurnRate: sliceToRange(retention.weeklyChurnRate, dateRange),
      };
    }

    const retention = toRetention(await this.worldMetrics(placeId));
    return {
      platforms: retention.platforms,
      day7ByCohortWeek: sliceToRange(retention.day7ByCohortWeek, dateRange),
      weeklyChurnRate: sliceToRange(retention.weeklyChurnRate, dateRange),
    };
  }

  /** Visit metrics for one Place over the given date range. */
  public async fetchPlaceVisits(
    _address: string,
    placeId: string,
    dateRange: DateRange,
  ): Promise<PlaceVisitsMetrics> {
    if (USE_MOCK) {
      const visits = getMockVisits(placeId);
      if (!visits) throw new Error(`No visits data found for place "${placeId}"`);
      return {
        // "Unique Visits in the Last 60 Days" is a fixed window by definition.
        uniqueVisits: visits.uniqueVisits,
        weeklyActiveUsers: sliceToRange(visits.weeklyActiveUsers, dateRange),
        weeklyUsersFlow: sliceToRange(visits.weeklyUsersFlow, dateRange),
      };
    }

    const visits = toVisits(await this.worldMetrics(placeId));
    return {
      uniqueVisits: visits.uniqueVisits,
      weeklyActiveUsers: sliceToRange(visits.weeklyActiveUsers, dateRange),
      weeklyUsersFlow: sliceToRange(visits.weeklyUsersFlow, dateRange),
    };
  }

  /** Engagement metrics for one Place over the given date range. */
  public async fetchPlaceEngagement(
    _address: string,
    placeId: string,
    dateRange: DateRange,
  ): Promise<PlaceEngagementMetrics> {
    const engagement = USE_MOCK
      ? getMockEngagement(placeId)
      : toEngagement(await this.worldMetrics(placeId));
    if (!engagement) throw new Error(`No engagement data found for place "${placeId}"`);

    const social = (series: SocialInteractionSeries): SocialInteractionSeries => ({
      messagesSent: sliceToRange(series.messagesSent, dateRange),
      emotesPlayed: sliceToRange(series.emotesPlayed, dateRange),
      newFriendships: sliceToRange(series.newFriendships, dateRange),
    });
    const window = (points: TimeSeriesPoint[]) => sliceToRange(points, dateRange);

    return {
      avgDailyPlaytime: {
        ...engagement.avgDailyPlaytime,
        weekly: window(engagement.avgDailyPlaytime.weekly),
      },
      avgWeeklyPlaytime: {
        ...engagement.avgWeeklyPlaytime,
        weekly: window(engagement.avgWeeklyPlaytime.weekly),
      },
      socialInteractions: {
        weeklyTotals: social(engagement.socialInteractions.weeklyTotals),
        visitorRate: social(engagement.socialInteractions.visitorRate),
      },
    };
  }
}
