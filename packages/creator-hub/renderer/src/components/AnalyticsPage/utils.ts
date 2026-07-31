import { DAY_7_RETENTION_BENCHMARK } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

/** Shown wherever a Place has not collected a metric yet. */
export const NO_VALUE = '-';

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const decimalNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Large counts read as "2K", small ones stay exact. */
export function formatCount(value: number | null) {
  return value === null ? NO_VALUE : compactNumber.format(value);
}

export function formatRevenue(value: number | null) {
  return value === null ? NO_VALUE : decimalNumber.format(value);
}

export function formatPercentage(value: number | null) {
  return value === null ? NO_VALUE : `${decimalNumber.format(value)}%`;
}

export function formatMinutes(value: number | null) {
  return value === null ? NO_VALUE : t('analytics.list.minutes', { value });
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

/** Retention below the Day 7 benchmark is called out as negative. */
export function getRetentionColor(value: number | null) {
  if (value === null) return undefined;
  return value >= DAY_7_RETENTION_BENCHMARK ? 'success.main' : 'error.main';
}
