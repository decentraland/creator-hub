import type { Cycle } from '/shared/types/creator-fund';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formats a cycle as `Oct 1 - Oct 15, 2026` in UTC days.
 * @param cycle - its `end_at` is exclusive, so the label ends the day before.
 * @param locale - a BCP 47 locale for the month and day names.
 */
export function formatCycleLabel(cycle: Pick<Cycle, 'start_at' | 'end_at'>, locale: string) {
  const start = new Date(cycle.start_at);
  const end = new Date(new Date(cycle.end_at).getTime() - DAY_MS);
  const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dayWithYear = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const from = sameYear ? day.format(start) : dayWithYear.format(start);
  return `${from} - ${dayWithYear.format(end)}`;
}

/**
 * Formats a cycle as `Oct 1 - Oct 15`: the cycle label without its year.
 * @param cycle - its `end_at` is exclusive, so the label ends the day before.
 * @param locale - a BCP 47 locale for the month and day names.
 */
export function formatCycleDays(cycle: Pick<Cycle, 'start_at' | 'end_at'>, locale: string) {
  const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const end = new Date(new Date(cycle.end_at).getTime() - DAY_MS);
  return `${day.format(new Date(cycle.start_at))} - ${day.format(end)}`;
}
