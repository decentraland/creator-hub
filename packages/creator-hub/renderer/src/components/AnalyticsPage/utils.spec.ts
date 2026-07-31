import { describe, expect, it } from 'vitest';

import {
  NO_VALUE,
  formatCount,
  formatDateTime,
  formatPercentage,
  formatRevenue,
  getRetentionColor,
} from './utils';

describe('formatCount', () => {
  it('should keep small counts exact', () => {
    expect(formatCount(127)).toBe('127');
  });

  it('should shorten large counts', () => {
    expect(formatCount(2000)).toBe('2K');
    expect(formatCount(1470)).toBe('1.5K');
  });

  it('should render missing data as a dash', () => {
    expect(formatCount(null)).toBe(NO_VALUE);
  });

  it('should keep a real zero distinct from missing data', () => {
    expect(formatCount(0)).toBe('0');
  });
});

describe('formatRevenue', () => {
  it('should keep up to two decimals', () => {
    expect(formatRevenue(106.7)).toBe('106.7');
    expect(formatRevenue(56)).toBe('56');
  });

  it('should render missing data as a dash', () => {
    expect(formatRevenue(null)).toBe(NO_VALUE);
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
