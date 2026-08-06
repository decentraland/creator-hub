import { describe, expect, it } from 'vitest';

import PAYLOAD from '../../tests/fixtures-world-metrics.json';
import type { WorldMetrics } from './metricsApi';
import {
  toEngagement,
  toOverview,
  toRetention,
  toSummary,
  toVisits,
} from './placeAnalytics.adapter';

/**
 * A payload captured from the analytics service running on its own fixtures, so
 * the shapes here (fractional rates, `null` series, ISO periods) are the real
 * ones rather than an invention.
 */

const WORLD = PAYLOAD as unknown as WorldMetrics;

/** The last week in the fixture, as local midnight. */
const LAST_WEEK = new Date(2026, 6, 27).getTime();

describe('toOverview', () => {
  it('should read the whole-window figures', () => {
    const overview = toOverview(WORLD);
    expect(overview.uniqueVisits).toBe(87);
    expect(overview.desktopUsers).toBe(59);
    expect(overview.mobileUsers).toBe(29);
  });

  it('should turn the fractional retention rate into a percentage', () => {
    // 0.0656 in the payload.
    expect(toOverview(WORLD).day7Retention).toBeCloseTo(6.56, 5);
  });

  it('should total new users over the same 60 days the unique count covers', () => {
    const weekly = PAYLOAD.metrics.visitor_flow_weekly
      .filter(row => row.series === 'new')
      .sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const lastNine = weekly.slice(-9).reduce((total, row) => total + row.value, 0);

    expect(toOverview(WORLD).newUsers).toBe(lastNine);
    // Comparable to the unique visitor count it sits beside, not a 16-week total.
    expect(toOverview(WORLD).newUsers).toBeLessThan(
      weekly.reduce((total, row) => total + row.value, 0),
    );
  });

  it('should leave metrics the API does not carry empty', () => {
    const overview = toOverview(WORLD);
    expect(overview.totalVisits).toBeNull();
    expect(overview.concurrentUsers).toBeNull();
    expect(overview.revenue).toBeNull();
    expect(overview.afkTime).toBeNull();
  });
});

describe('toRetention', () => {
  it('should split the 60-day average by platform, as percentages', () => {
    const { platforms } = toRetention(WORLD);
    expect(platforms.all).toBeCloseTo(6.56, 5);
    expect(platforms.desktop).toBeGreaterThan(0);
    expect(platforms.mobile).toBeGreaterThan(0);
  });

  it('should keep only the d7 series of the cohort metric', () => {
    const { day7ByCohortWeek } = toRetention(WORLD);
    const d7Rows = PAYLOAD.metrics.retention_by_cohort_week.filter(row => row.series === 'd7');
    expect(day7ByCohortWeek).toHaveLength(d7Rows.length);
  });

  it('should scale churn to a percentage', () => {
    const { weeklyChurnRate } = toRetention(WORLD);
    // 0.7026 in the last week of the payload.
    expect(weeklyChurnRate.at(-1)).toEqual({ date: LAST_WEEK, value: 70.26 });
  });

  it('should order the weeks oldest first', () => {
    const dates = toRetention(WORLD).weeklyChurnRate.map(point => point.date);
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});

describe('toVisits', () => {
  it('should pivot the three flow series into one point per week', () => {
    const { weeklyUsersFlow } = toVisits(WORLD);
    const weeks = new Set(
      PAYLOAD.metrics.visitor_flow_weekly.filter(row => row.period).map(row => row.period),
    );
    expect(weeklyUsersFlow).toHaveLength(weeks.size);

    const last = weeklyUsersFlow.at(-1)!;
    expect(last.newUsers).not.toBeNull();
    expect(last.returnedUsers).not.toBeNull();
    expect(last.reactivatedUsers).not.toBeNull();
  });

  it('should map "retained" onto returned users', () => {
    const retained = PAYLOAD.metrics.visitor_flow_weekly.find(
      row => row.series === 'retained' && row.period === '2026-07-27',
    )!;
    const last = toVisits(WORLD).weeklyUsersFlow.at(-1)!;
    expect(last.returnedUsers).toBe(retained.value);
  });
});

describe('toEngagement', () => {
  it('should take playtime from the session and active-minute averages', () => {
    const { avgDailyPlaytime, avgWeeklyPlaytime } = toEngagement(WORLD);
    expect(avgDailyPlaytime.minutes).toBe(9.2);
    expect(avgWeeklyPlaytime.minutes).toBe(6);
  });

  it('should read the delta against the previous week', () => {
    // 9.2 this week against 8.8 the week before.
    expect(toEngagement(WORLD).avgDailyPlaytime.deltaMinutes).toBeCloseTo(0.4, 5);
  });

  it('should express social interactions as a share of that week active users', () => {
    const { visitorRate } = toEngagement(WORLD).socialInteractions;
    // 3 chatting out of 20 active in the last week.
    expect(visitorRate.messagesSent.at(-1)).toEqual({ date: LAST_WEEK, value: 15 });
  });

  it('should leave friendships empty, since the API has no such metric', () => {
    const { weeklyTotals, visitorRate } = toEngagement(WORLD).socialInteractions;
    expect(weeklyTotals.newFriendships).toEqual([]);
    expect(visitorRate.newFriendships).toEqual([]);
  });
});

describe('toSummary', () => {
  it('should build a list row from the world payload', () => {
    const summary = toSummary(WORLD, { name: 'Alien Scrapyard', thumbnail: 'thumb.png' });
    expect(summary).toMatchObject({
      placeId: PAYLOAD.world,
      name: 'Alien Scrapyard',
      totalVisits: 87,
    });
    expect(summary.day7Retention).toBeCloseTo(6.56, 5);
  });
});
