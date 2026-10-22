import { describe, expect, it } from 'vitest';

import { creatorFundMetrics, placeDay3Retention, placeFundMetrics } from './metrics';

describe('placeFundMetrics', () => {
  describe('when the place has no visits or retention data', () => {
    it('should leave both metrics empty instead of inventing them', () => {
      expect(placeFundMetrics('land:1,1', { totalVisits: null, day7Retention: null })).toEqual({
        newPlayers: null,
        day3Retention: null,
      });
    });
  });

  describe('when the place has data', () => {
    it('should keep D3 retention within 74-86% of D7', () => {
      const { day3Retention } = placeFundMetrics('world:foo.dcl.eth@0,0', {
        totalVisits: 1000,
        day7Retention: 30,
      });

      expect(day3Retention).toBeGreaterThanOrEqual(30 * 0.74 - 0.1);
      expect(day3Retention).toBeLessThanOrEqual(30 * 0.86 + 0.1);
    });

    it('should answer the same for the same place every time', () => {
      const input = { totalVisits: 500, day7Retention: 20 };

      expect(placeFundMetrics('land:3,4', input)).toEqual(placeFundMetrics('land:3,4', input));
    });
  });
});

describe('placeDay3Retention', () => {
  describe('when a cohort week has no data', () => {
    it('should keep the gap rather than fill it', () => {
      const day3 = placeDay3Retention('land:0,0', {
        platforms: { all: 20, desktop: null, mobile: 25 },
        day7ByCohortWeek: [
          { date: 1, value: 20 },
          { date: 2, value: null },
        ],
      });

      expect(day3.platforms.desktop).toBeNull();
      expect(day3.byCohortWeek[1]).toEqual({ date: 2, value: null });
    });
  });
});

describe('creatorFundMetrics', () => {
  describe('when places bring different numbers of new players', () => {
    it('should weight D3 retention by each place’s new players', () => {
      const totals = creatorFundMetrics([
        { newPlayers: 200, day3Retention: 20 },
        { newPlayers: 2, day3Retention: 50 },
      ]);

      expect(totals.newPlayers).toBe(202);
      expect(totals.day3Retention).toBeCloseTo(20.3, 1);
    });
  });

  describe('when no place has data', () => {
    it('should answer empty', () => {
      expect(creatorFundMetrics([{ newPlayers: null, day3Retention: null }])).toEqual({
        newPlayers: null,
        day3Retention: null,
      });
    });
  });
});
