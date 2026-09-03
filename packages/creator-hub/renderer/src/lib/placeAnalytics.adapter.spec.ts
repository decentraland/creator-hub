import { describe, expect, it } from 'vitest';

import { MetricsWindow } from '../../../shared/types/place-analytics';

import BATCH from '../../tests/fixtures-metrics-batch.json';
import type { LocationMetrics } from './metricsApi';
import {
  METRIC_NAMES,
  SINGLE_SERIES_METRICS,
  hasNoData,
  toEngagement,
  toOverview,
  toRetention,
  toSummary,
  toVisits,
} from './placeAnalytics.adapter';

const locations = BATCH.locations as unknown as LocationMetrics[];

/** A world scene carrying all 19 metrics. */
const FULL = locations[0];
/** A world scene carrying 10 of 19 — the common case, not an edge case. */
const PARTIAL = locations[1];
/** A Genesis City scene carrying all 17. */
const GENESIS_CITY = locations[2];
/** Unauthorized, or no rows in today's export — deliberately indistinguishable. */
const EMPTY = locations[3];

const { LAST_30_DAYS, LAST_60_DAYS } = MetricsWindow;

describe('the metric name registry', () => {
  it('should list exactly the 19 metrics the service exports', () => {
    expect(METRIC_NAMES).toHaveLength(19);
    expect([...METRIC_NAMES].sort()).toEqual(
      [...Object.keys(FULL.metrics), ...Object.keys(GENESIS_CITY.metrics)]
        .filter((name, index, all) => all.indexOf(name) === index)
        .sort(),
    );
  });

  it('should mark as single-series exactly the metrics whose rows carry no series', () => {
    const withoutSeries = METRIC_NAMES.filter(name =>
      FULL.metrics[name].every(row => row.series === null),
    );

    expect([...SINGLE_SERIES_METRICS].sort()).toEqual(withoutSeries.sort());
    expect(SINGLE_SERIES_METRICS).toHaveLength(5);
  });

  it('should split every other metric three ways', () => {
    const split = METRIC_NAMES.filter(name => !SINGLE_SERIES_METRICS.includes(name as never));

    for (const name of split) {
      expect([...new Set(FULL.metrics[name].map(row => row.series))].sort()).toEqual([
        'all',
        'desktop',
        'mobile',
      ]);
    }
  });

  it('should give the three weekly metrics a Monday period and the rest none', () => {
    for (const name of METRIC_NAMES) {
      const periods = FULL.metrics[name].map(row => row.period);
      if (name.endsWith('_weekly')) {
        expect(new Set(periods).size).toBe(8);
        for (const period of periods) {
          expect(new Date(`${period}T00:00:00Z`).getUTCDay()).toBe(1);
        }
      } else {
        expect(periods).toEqual(periods.map(() => null));
      }
    }
  });
});

describe('toOverview', () => {
  describe('when a metric is split by platform', () => {
    it('should read the "all" series, not the sum of desktop and mobile', () => {
      const rows = FULL.metrics.unique_visitors_60d;
      const all = rows.find(row => row.series === 'all')!.value;
      const desktop = rows.find(row => row.series === 'desktop')!.value;
      const mobile = rows.find(row => row.series === 'mobile')!.value;

      const overview = toOverview(FULL, LAST_60_DAYS);

      expect(overview.uniqueVisits).toBe(all);
      expect(overview.uniqueVisits).not.toBe(desktop + mobile);
      expect(overview.desktopUsers).toBe(desktop);
      expect(overview.mobileUsers).toBe(mobile);
    });

    it('should not read whichever row happens to come first', () => {
      const reordered: LocationMetrics = {
        ...FULL,
        metrics: {
          ...FULL.metrics,
          unique_visitors_60d: [...FULL.metrics.unique_visitors_60d].reverse(),
        },
      };

      expect(toOverview(reordered, LAST_60_DAYS).uniqueVisits).toBe(
        toOverview(FULL, LAST_60_DAYS).uniqueVisits,
      );
    });
  });

  describe('when a metric carries no series', () => {
    it('should read its single row', () => {
      const [row] = FULL.metrics.concurrent_users_avg_60d;

      expect(toOverview(FULL, LAST_60_DAYS).concurrentUsers).toBe(row.value);
      expect(row.series).toBeNull();
    });

    it('should keep concurrent users fractional', () => {
      expect(toOverview(FULL, LAST_60_DAYS).concurrentUsers).not.toBe(
        Math.round(toOverview(FULL, LAST_60_DAYS).concurrentUsers!),
      );
    });

    it('should read peak separately from average', () => {
      const overview = toOverview(FULL, LAST_60_DAYS);

      expect(overview.peakConcurrentUsers).toBe(FULL.metrics.concurrent_users_peak_60d[0].value);
      expect(overview.peakConcurrentUsers).not.toBe(overview.concurrentUsers);
    });
  });

  describe('when the window changes', () => {
    it('should read a different metric rather than filtering one', () => {
      const thirty = toOverview(FULL, LAST_30_DAYS);
      const sixty = toOverview(FULL, LAST_60_DAYS);

      expect(thirty.uniqueVisits).toBe(
        FULL.metrics.unique_visitors_30d.find(row => row.series === 'all')!.value,
      );
      expect(sixty.uniqueVisits).toBe(
        FULL.metrics.unique_visitors_60d.find(row => row.series === 'all')!.value,
      );
      expect(thirty.uniqueVisits).not.toBe(sixty.uniqueVisits);
    });
  });

  describe('when converting units', () => {
    it('should read playtime as minutes, from a metric measured in seconds', () => {
      const seconds = FULL.metrics.median_playtime_seconds_60d.find(
        row => row.series === 'all',
      )!.value;

      expect(toOverview(FULL, LAST_60_DAYS).medianPlaytime).toBeCloseTo(seconds / 60, 6);
      expect(seconds).toBeGreaterThan(60);
    });

    it('should read the median playtime, not the average one', () => {
      const averageSeconds = FULL.metrics.avg_playtime_seconds_60d.find(
        row => row.series === 'all',
      )!.value;

      expect(toOverview(FULL, LAST_60_DAYS).medianPlaytime).not.toBeCloseTo(averageSeconds / 60, 6);
    });

    it('should read AFK time as minutes too', () => {
      const seconds = FULL.metrics.avg_afk_seconds_per_user_60d.find(
        row => row.series === 'all',
      )!.value;

      expect(toOverview(FULL, LAST_60_DAYS).afkTime).toBeCloseTo(seconds / 60, 6);
    });

    it('should read a retention rate as a percentage', () => {
      const rate = FULL.metrics.d7_retention_rate_60d.find(row => row.series === 'all')!.value;

      expect(rate).toBeLessThanOrEqual(1);
      expect(toOverview(FULL, LAST_60_DAYS).day7Retention).toBeCloseTo(rate * 100, 6);
    });

    it('should keep visits and visitors as the distinct metrics they are', () => {
      const overview = toOverview(FULL, LAST_60_DAYS);

      expect(overview.totalVisits).toBe(
        FULL.metrics.unique_visits_60d.find(row => row.series === 'all')!.value,
      );
      expect(overview.totalVisits).not.toBe(overview.uniqueVisits);
    });
  });

  describe('when the location carries only some of the metrics', () => {
    it('should render what is there and leave the rest null', () => {
      const overview = toOverview(PARTIAL, LAST_60_DAYS);

      expect(overview.uniqueVisits).not.toBeNull();
      expect(overview.medianPlaytime).not.toBeNull();
      expect(overview.day7Retention).toBeNull();
      expect(overview.concurrentUsers).toBeNull();
    });
  });

  describe('when the location carries no metrics at all', () => {
    it('should return nulls rather than throwing', () => {
      const overview = toOverview(EMPTY, LAST_60_DAYS);

      expect(Object.values(overview).every(value => value === null)).toBe(true);
    });
  });
});

describe('toVisits', () => {
  it('should read the weekly series as the full window the export holds', () => {
    const visits = toVisits(GENESIS_CITY, LAST_60_DAYS);

    expect(visits.weeklyActiveUsers).toHaveLength(8);
  });

  it('should order the weeks oldest first', () => {
    const dates = toVisits(GENESIS_CITY, LAST_60_DAYS).weeklyActiveUsers.map(point => point.date);

    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it('should take only the "all" series into the weekly line', () => {
    const visits = toVisits(FULL, LAST_60_DAYS);
    const firstWeek = FULL.metrics.unique_visitors_weekly.filter(
      row => row.period === '2026-06-15',
    );

    expect(visits.weeklyActiveUsers[0].value).toBe(
      firstWeek.find(row => row.series === 'all')!.value,
    );
  });

  it('should label a week as its own local day', () => {
    const [first] = toVisits(FULL, LAST_60_DAYS).weeklyActiveUsers;

    expect(new Date(first.date).getDate()).toBe(15);
  });

  it('should split the platform figures for the selected window', () => {
    const visits = toVisits(FULL, LAST_30_DAYS);
    const rows = FULL.metrics.unique_visits_30d;

    expect(visits.uniqueVisits.all).toBe(rows.find(row => row.series === 'all')!.value);
    expect(visits.uniqueVisits.desktop).toBe(rows.find(row => row.series === 'desktop')!.value);
    expect(visits.uniqueVisits.mobile).toBe(rows.find(row => row.series === 'mobile')!.value);
  });

  it('should return an empty series for a location with no metrics', () => {
    expect(toVisits(EMPTY, LAST_60_DAYS).weeklyActiveUsers).toEqual([]);
  });
});

describe('toRetention', () => {
  it('should read each platform as a percentage', () => {
    const retention = toRetention(FULL, LAST_60_DAYS);
    const rows = FULL.metrics.d7_retention_rate_60d;

    expect(retention.platforms.all).toBeCloseTo(rows.find(r => r.series === 'all')!.value * 100, 6);
    expect(retention.platforms.desktop).toBeCloseTo(
      rows.find(r => r.series === 'desktop')!.value * 100,
      6,
    );
  });

  it('should read the weekly cohort series as percentages, one point per exported week', () => {
    const { day7ByCohortWeek } = toRetention(FULL, LAST_60_DAYS);

    expect(day7ByCohortWeek).toHaveLength(8);
    for (const point of day7ByCohortWeek) {
      expect(point.value).toBeLessThanOrEqual(100);
    }
    expect(day7ByCohortWeek[0].value).toBeCloseTo(
      FULL.metrics.d7_retention_rate_weekly.find(
        row => row.period === '2026-06-15' && row.series === 'all',
      )!.value * 100,
      6,
    );
  });

  it('should leave a location without retention metrics empty', () => {
    const retention = toRetention(PARTIAL, LAST_60_DAYS);

    expect(retention.platforms.all).toBeNull();
    expect(retention.day7ByCohortWeek).toEqual([]);
  });
});

describe('toEngagement', () => {
  it('should read playtime and AFK as minutes for the selected window', () => {
    const engagement = toEngagement(FULL, LAST_30_DAYS);

    expect(engagement.medianPlaytime).toBeCloseTo(
      FULL.metrics.median_playtime_seconds_30d.find(row => row.series === 'all')!.value / 60,
      6,
    );
    expect(engagement.afkTime).toBeCloseTo(
      FULL.metrics.avg_afk_seconds_per_user_30d.find(row => row.series === 'all')!.value / 60,
      6,
    );
  });

  it('should read the socially engaged ratio as a weekly percentage', () => {
    const { sociallyEngaged } = toEngagement(FULL, LAST_60_DAYS);

    expect(sociallyEngaged).toHaveLength(8);
    expect(sociallyEngaged[0].value).toBeCloseTo(
      FULL.metrics.socially_engaged_ratio_weekly[0].value * 100,
      6,
    );
    for (const point of sociallyEngaged) {
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });

  it('should leave a location with no engagement metrics empty', () => {
    const engagement = toEngagement(EMPTY, LAST_60_DAYS);

    expect(engagement.medianPlaytime).toBeNull();
    expect(engagement.sociallyEngaged).toEqual([]);
  });
});

describe('hasNoData', () => {
  it('should be true only when the API returned no metrics at all', () => {
    expect(hasNoData(EMPTY)).toBe(true);
    expect(hasNoData(PARTIAL)).toBe(false);
    expect(hasNoData(FULL)).toBe(false);
  });
});

describe('toSummary', () => {
  const meta = { name: 'Cozy Farm', thumbnail: 'thumb.png', placeId: 'world:cozyfarm.dcl.eth@0,0' };

  it('should show visits, not visitors, in the total visits column', () => {
    const summary = toSummary(FULL, LAST_60_DAYS, meta);

    expect(summary.totalVisits).toBe(
      FULL.metrics.unique_visits_60d.find(row => row.series === 'all')!.value,
    );
  });

  it('should carry the identity it was given rather than deriving one', () => {
    const summary = toSummary(GENESIS_CITY, LAST_60_DAYS, meta);

    expect(summary.placeId).toBe(meta.placeId);
    expect(summary.name).toBe(meta.name);
  });

  it('should flag a location with no metrics so the row can say so', () => {
    expect(toSummary(EMPTY, LAST_60_DAYS, meta).hasNoData).toBe(true);
    expect(toSummary(FULL, LAST_60_DAYS, meta).hasNoData).toBe(false);
  });
});
