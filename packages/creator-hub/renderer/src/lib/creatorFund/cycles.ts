import type { Cycle } from './contract';
import { PROGRAM } from './program';

/**
 * Creator Fund cycles: half-months in UTC (1st–15th, 16th–end of month).
 *
 * Mocked from the calendar rather than `GET /cycles`, which only lists cycles
 * the anti-bot pipeline has published.
 */

/** The first beta cycle the payout pipeline ran on. */
const FIRST_CYCLE_START = Date.UTC(2026, 7, 1);

/** How many closed cycles the POC shows. */
const HISTORY_LENGTH = 5;

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

function cycleContaining(time: number) {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const firstHalf = date.getUTCDate() <= 15;
  const start = Date.UTC(year, month, firstHalf ? 1 : 16);
  // Day 0 of the next month is the last day of this one.
  const end = firstHalf ? Date.UTC(year, month, 15) : Date.UTC(year, month + 1, 0);
  return { start, end };
}

function toCycle({ start, end }: { start: number; end: number }): Cycle {
  const startDate = isoDate(start);
  const endDate = isoDate(end);
  return {
    id: `${startDate}_${endDate}`,
    start_date: startDate,
    end_date: endDate,
    min_players: PROGRAM.minPlayers,
    published_at: new Date(end + 3 * 24 * 60 * 60 * 1000).toISOString(),
    places: 0,
    qualified_places: 0,
  };
}

/** The cycle running at `now`. */
export function currentCycle(now = Date.now()): Cycle {
  return toCycle(cycleContaining(now));
}

/** Closed cycles before `now`, newest first, never before the beta started. */
export function closedCycles(now = Date.now(), count = HISTORY_LENGTH): Cycle[] {
  const cycles: Cycle[] = [];
  let { start } = cycleContaining(now);
  while (cycles.length < count) {
    const previous = cycleContaining(start - 1);
    if (previous.start < FIRST_CYCLE_START) break;
    cycles.push(toCycle(previous));
    start = previous.start;
  }
  return cycles;
}

export const CURRENT_CYCLE = currentCycle();
export const CLOSED_CYCLES = closedCycles();
