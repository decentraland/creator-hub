import type {
  PlatformBreakdown,
  PlaceRetentionMetrics,
  TimeSeriesPoint,
} from '/shared/types/place-analytics';

import { hashBetween } from './hash';

/**
 * The two Creator Fund metrics Analytics does not carry yet, MOCKED.
 *
 * - New players: players on their first day in Decentraland, credited to the
 *   scene they played most that day (paid-ads installs excluded).
 * - D3 retention: share of those new players back on D1–D3.
 *
 * Both are derived from the place's real numbers so they move with them: new
 * players as a share of visits, D3 as a share of D7 — 74–86%, the range the
 * fund's Retention Window tab measured across five cycles. A place with no
 * base number gets no mocked one either, so "-" still means "no data".
 */

const NEW_PLAYER_SHARE: [number, number] = [0.12, 0.3];
const D3_OF_D7: [number, number] = [0.74, 0.86];

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function mockNewPlayers(placeId: string, totalVisits: number | null): number | null {
  if (totalVisits === null) return null;
  return Math.round(totalVisits * hashBetween(`${placeId}:new`, ...NEW_PLAYER_SHARE));
}

export function mockDay3Retention(seed: string, day7Retention: number | null): number | null {
  if (day7Retention === null) return null;
  return roundTo(day7Retention * hashBetween(`${seed}:d3`, ...D3_OF_D7), 1);
}

export type PlaceFundMetrics = {
  newPlayers: number | null;
  /** Percentage, 0-100. */
  day3Retention: number | null;
};

export function placeFundMetrics(
  placeId: string,
  { totalVisits, day7Retention }: { totalVisits: number | null; day7Retention: number | null },
): PlaceFundMetrics {
  return {
    newPlayers: mockNewPlayers(placeId, totalVisits),
    day3Retention: mockDay3Retention(placeId, day7Retention),
  };
}

export type PlaceDay3Retention = {
  platforms: PlatformBreakdown;
  byCohortWeek: TimeSeriesPoint[];
};

/** Day 3 counterparts of the Retention tab's Day 7 platforms and cohort series. */
export function placeDay3Retention(
  placeId: string,
  retention: PlaceRetentionMetrics,
): PlaceDay3Retention {
  return {
    platforms: {
      all: mockDay3Retention(placeId, retention.platforms.all),
      desktop: mockDay3Retention(`${placeId}:desktop`, retention.platforms.desktop),
      mobile: mockDay3Retention(`${placeId}:mobile`, retention.platforms.mobile),
    },
    byCohortWeek: retention.day7ByCohortWeek.map(point => ({
      date: point.date,
      value: mockDay3Retention(`${placeId}:${point.date}`, point.value),
    })),
  };
}

/**
 * The creator's totals across places: new players add up, D3 retention is
 * weighted by each place's new players (a 2-player scene at 50% must not count
 * as much as a 200-player one at 20%).
 */
export function creatorFundMetrics(places: PlaceFundMetrics[]): PlaceFundMetrics {
  const counted = places.filter(
    (place): place is { newPlayers: number; day3Retention: number | null } =>
      place.newPlayers !== null,
  );
  if (counted.length === 0) return { newPlayers: null, day3Retention: null };

  const newPlayers = counted.reduce((sum, place) => sum + place.newPlayers, 0);
  const withRetention = counted.filter(place => place.day3Retention !== null);
  const weight = withRetention.reduce((sum, place) => sum + place.newPlayers, 0);
  const day3Retention =
    weight > 0
      ? roundTo(
          withRetention.reduce(
            (sum, place) => sum + (place.day3Retention ?? 0) * place.newPlayers,
            0,
          ) / weight,
          1,
        )
      : null;

  return { newPlayers, day3Retention };
}

export type CreatorCycleMetrics = {
  newPlayers: number;
  returners: number;
  /** Percentage, 0-100. */
  day3Retention: number;
  /** Hours of AFK-free play by counted players. */
  countedPlaytimeHours: number;
};

/** The running cycle's creator totals on the Creator Fund page, from counted players only. */
export function creatorCycleMetrics(address: string, cycleId: string): CreatorCycleMetrics {
  const seed = `${address.toLowerCase()}:${cycleId}`;
  const newPlayers = Math.round(hashBetween(`${seed}:new`, 24, 420));
  const returners = Math.round(newPlayers * hashBetween(`${seed}:back`, 0.14, 0.32));
  return {
    newPlayers,
    returners,
    day3Retention: roundTo((returners / newPlayers) * 100, 1),
    countedPlaytimeHours: Math.round(hashBetween(`${seed}:play`, 40, 1800)),
  };
}
