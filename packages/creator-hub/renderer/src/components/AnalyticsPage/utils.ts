import { DAY_7_RETENTION_BENCHMARK } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

/** Shown wherever a Place has not collected a metric yet. */
export const NO_VALUE = '-';

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  // Two decimals so 1,470 reads 1.47K; whole thousands still read 2K.
  maximumFractionDigits: 2,
});

const decimalNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Large counts read as "2K", small ones stay exact. */
export function formatCount(value: number | null) {
  return value === null ? NO_VALUE : compactNumber.format(value);
}

/** Concurrent users are fractional averages, so they keep their decimals. */
export function formatDecimal(value: number | null) {
  return value === null ? NO_VALUE : decimalNumber.format(value);
}

// formatRevenue: awaiting a revenue metric. `formatDecimal` covers the same shape.

export function formatPercentage(value: number | null) {
  return value === null ? NO_VALUE : `${decimalNumber.format(value)}%`;
}

/**
 * Minutes are derived from a seconds metric, so the raw value carries full float
 * precision — "4.022482166666666 min" without rounding it here.
 */
export function formatMinutes(value: number | null) {
  return value === null ? NO_VALUE : t('analytics.list.minutes', { value: formatDecimal(value) });
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

/** Renders as "12/07/2026 • 5:26 PM". */
export function formatDateTime(value: number | null) {
  if (value === null) return NO_VALUE;
  const date = new Date(value);
  return `${dateFormat.format(date)} • ${timeFormat.format(date)}`;
}

/** The export stamp, as a plain date — the time of day it ran is not meaningful. */
export function formatExportDate(exportedAt: string) {
  const date = new Date(exportedAt);
  return Number.isNaN(date.getTime()) ? NO_VALUE : dateFormat.format(date);
}

/**
 * Which way a change points. Every metric that uses this — playtime so far —
 * is one where more is better, so "up" is styled as positive.
 */
export function getDeltaDirection(value: number | null): 'up' | 'down' | 'flat' {
  if (value === null || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}

/** Renders as "6.6 min vs. last week", without the sign — the arrow carries it. */
export function formatMinutesDelta(value: number | null) {
  if (value === null) return NO_VALUE;
  return t('analytics.detail.engagement.delta', { value: decimalNumber.format(Math.abs(value)) });
}

/** Retention below the Day 7 benchmark is called out as negative. */
export function getRetentionColor(value: number | null) {
  if (value === null) return undefined;
  return value >= DAY_7_RETENTION_BENCHMARK ? 'success.main' : 'error.main';
}
