import { describe, expect, it } from 'vitest';

import { formatCycleLabel, formatCycleStartDay } from './utils';

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

describe('formatCycleStartDay', () => {
  describe('when the locale is English', () => {
    it.each([
      ['2026-11-01T00:00:00Z', 'November 1st'],
      ['2026-11-02T00:00:00Z', 'November 2nd'],
      ['2026-11-03T00:00:00Z', 'November 3rd'],
      ['2026-11-11T00:00:00Z', 'November 11th'],
      ['2026-11-15T00:00:00Z', 'November 15th'],
      ['2026-11-22T00:00:00Z', 'November 22nd'],
    ])('should spell %s as a long month and an ordinal day', (start_at, label) => {
      expect(formatCycleStartDay({ start_at }, 'en')).toBe(label);
    });

    it('should read the day in UTC', () => {
      expect(formatCycleStartDay({ start_at: '2026-11-15T23:30:00Z' }, 'en')).toBe('November 15th');
    });
  });

  describe.each([
    ['es', '15 de noviembre'],
    ['zh', '11月15日'],
  ])('when the locale is %s', (locale, label) => {
    it('should format the day in that locale', () => {
      expect(formatCycleStartDay({ start_at: '2026-11-15T00:00:00Z' }, locale)).toBe(label);
    });
  });
});
