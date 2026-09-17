import { describe, expect, it, vi } from 'vitest';

// These formatters read their unit suffix from the catalogue; the interpolated
// value is what is under test here.
vi.mock('/@/modules/store/translation/utils', () => ({
  t: (key: string, values?: Record<string, unknown>) =>
    key === 'analytics.list.minutes' ? `${values?.value} min` : key,
}));

import {
  NO_VALUE,
  formatCount,
  formatDateTime,
  formatDecimal,
  formatExportDate,
  formatMinutes,
  formatPercentage,
  getDeltaDirection,
  getRetentionColor,
} from './utils';

describe('formatCount', () => {
  it('should keep small counts exact', () => {
    expect(formatCount(127)).toBe('127');
  });

  it('should shorten large counts', () => {
    expect(formatCount(2000)).toBe('2K');
    expect(formatCount(1470)).toBe('1.47K');
  });

  it('should render missing data as a dash', () => {
    expect(formatCount(null)).toBe(NO_VALUE);
  });

  it('should keep a real zero distinct from missing data', () => {
    expect(formatCount(0)).toBe('0');
  });
});

describe('formatDecimal', () => {
  it('should keep up to two decimals', () => {
    expect(formatDecimal(106.7)).toBe('106.7');
    expect(formatDecimal(56)).toBe('56');
  });

  it('should keep a fractional concurrent-user average readable', () => {
    expect(formatDecimal(1.330414)).toBe('1.33');
  });

  it('should render missing data as a dash', () => {
    expect(formatDecimal(null)).toBe(NO_VALUE);
  });
});

describe('formatMinutes', () => {
  it('should round, since minutes are converted from seconds and carry full float precision', () => {
    // 241.34893 seconds / 60
    expect(formatMinutes(4.022482166666666)).toBe('4.02 min');
    expect(formatMinutes(18.65641928333333)).toBe('18.66 min');
  });

  it('should keep a whole number whole', () => {
    expect(formatMinutes(5)).toBe('5 min');
  });

  it('should render missing data as a dash', () => {
    expect(formatMinutes(null)).toBe(NO_VALUE);
  });
});

describe('formatExportDate', () => {
  it('should render the export stamp as a plain date', () => {
    expect(formatExportDate('2026-08-12T00:17:01.099Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should render an unusable stamp as a dash rather than "Invalid Date"', () => {
    expect(formatExportDate('')).toBe(NO_VALUE);
    expect(formatExportDate('not-a-date')).toBe(NO_VALUE);
  });
});

describe('formatPercentage', () => {
  it('should append a percent sign', () => {
    expect(formatPercentage(35)).toBe('35%');
    expect(formatPercentage(10.25)).toBe('10.25%');
  });

  it('should render missing data as a dash', () => {
    expect(formatPercentage(null)).toBe(NO_VALUE);
  });
});

describe('formatDateTime', () => {
  it('should render the date and time of the given moment', () => {
    // Built in local time so the expectation holds in any timezone.
    const moment = new Date(2026, 11, 7, 17, 26).getTime();
    expect(formatDateTime(moment)).toBe('12/07/2026 • 5:26 PM');
  });

  it('should render missing data as a dash', () => {
    expect(formatDateTime(null)).toBe(NO_VALUE);
  });
});

describe('getRetentionColor', () => {
  it('should read as positive at or above the Day 7 benchmark', () => {
    expect(getRetentionColor(35)).toBe('success.main');
    expect(getRetentionColor(20)).toBe('success.main');
  });

  it('should read as negative below the benchmark', () => {
    expect(getRetentionColor(12)).toBe('error.main');
  });

  it('should not colour missing data', () => {
    expect(getRetentionColor(null)).toBeUndefined();
  });
});

describe('getDeltaDirection', () => {
  it('should read a rise as up', () => {
    expect(getDeltaDirection(6.6)).toBe('up');
  });

  it('should read a fall as down', () => {
    expect(getDeltaDirection(-3.4)).toBe('down');
  });

  it('should treat no change and missing data as flat, so no arrow is drawn', () => {
    expect(getDeltaDirection(0)).toBe('flat');
    expect(getDeltaDirection(null)).toBe('flat');
  });
});
