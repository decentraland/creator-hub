import { describe, expect, it } from 'vitest';

import { formatCycleDays, formatCycleLabel } from './utils';

const cycle = (start_at: string, end_at: string) => ({ start_at, end_at });

describe('formatCycleLabel', () => {
  describe('when the cycle ends at midnight of the next day', () => {
    it('should label the last included day, since end_at is exclusive', () => {
      expect(formatCycleLabel(cycle('2026-10-01T00:00:00Z', '2026-10-16T00:00:00Z'), 'en-US')).toBe(
        'Oct 1 - Oct 15, 2026',
      );
    });

    it('should step back into the previous month when end_at is the 1st', () => {
      expect(formatCycleLabel(cycle('2026-10-16T00:00:00Z', '2026-11-01T00:00:00Z'), 'en-US')).toBe(
        'Oct 16 - Oct 31, 2026',
      );
    });
  });

  describe('when the cycle spans two months', () => {
    it('should name both months', () => {
      expect(formatCycleLabel(cycle('2026-10-20T00:00:00Z', '2026-11-04T00:00:00Z'), 'en-US')).toBe(
        'Oct 20 - Nov 3, 2026',
      );
    });
  });

  describe('when the cycle spans two years', () => {
    it('should name both years', () => {
      expect(formatCycleLabel(cycle('2026-12-20T00:00:00Z', '2027-01-04T00:00:00Z'), 'en-US')).toBe(
        'Dec 20, 2026 - Jan 3, 2027',
      );
    });
  });

  describe('when the locale is not English', () => {
    it('should format the days in that locale', () => {
      expect(formatCycleLabel(cycle('2026-10-01T00:00:00Z', '2026-10-16T00:00:00Z'), 'es')).toBe(
        '1 oct - 15 oct 2026',
      );
    });
  });
});

describe('formatCycleDays', () => {
  describe('when the cycle is within one year', () => {
    it('should label its days without the year', () => {
      expect(formatCycleDays(cycle('2026-10-01T00:00:00Z', '2026-10-16T00:00:00Z'), 'en-US')).toBe(
        'Oct 1 - Oct 15',
      );
    });
  });

  describe('when the cycle spans two years', () => {
    it('should still leave the years out', () => {
      expect(formatCycleDays(cycle('2026-12-20T00:00:00Z', '2027-01-04T00:00:00Z'), 'en-US')).toBe(
        'Dec 20 - Jan 3',
      );
    });
  });
});
