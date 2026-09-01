import { describe, expect, it } from 'vitest';

import type { PlaceAnalyticsSummary } from '../../../../../shared/types/place-analytics';
import { SortBy } from '../../../../../shared/types/place-analytics';
import { sortPlaces } from './utils';

function buildPlace(
  name: string,
  overrides: Partial<PlaceAnalyticsSummary> = {},
): PlaceAnalyticsSummary {
  return {
    placeId: name.toLowerCase(),
    name,
    thumbnail: 'thumbnail.png',
    totalVisits: 0,
    newUsers: 0,
    day7Retention: 0,
    revenue: 0,
    avgPlaytime: 0,
    ...overrides,
  };
}

const names = (places: PlaceAnalyticsSummary[]) => places.map($ => $.name);

describe('sortPlaces', () => {
  const bananarama = buildPlace('Bananarama', { totalVisits: 2000 });
  const halloween = buildPlace('Halloween Nightmare', { totalVisits: 127 });
  const unmonday = buildPlace('Unmonday Club', { totalVisits: null });
  const places = [halloween, unmonday, bananarama];

  describe('when sorting by name', () => {
    it('should sort A-Z', () => {
      expect(names(sortPlaces(places, '', SortBy.NAME_ASC))).toEqual([
        'Bananarama',
        'Halloween Nightmare',
        'Unmonday Club',
      ]);
    });

    it('should sort Z-A', () => {
      expect(names(sortPlaces(places, '', SortBy.NAME_DESC))).toEqual([
        'Unmonday Club',
        'Halloween Nightmare',
        'Bananarama',
      ]);
    });

    it('should not mutate the given list', () => {
      const original = [...places];
      sortPlaces(places, '', SortBy.NAME_DESC);
      expect(places).toEqual(original);
    });
  });

  describe('when sorting by most visits', () => {
    it('should sort from most to least visits', () => {
      expect(names(sortPlaces(places, '', SortBy.MOST_VISITS)).slice(0, 2)).toEqual([
        'Bananarama',
        'Halloween Nightmare',
      ]);
    });

    it('should put places with no data last', () => {
      expect(names(sortPlaces(places, '', SortBy.MOST_VISITS)).at(-1)).toBe('Unmonday Club');
    });
  });

  describe('when a search query is given', () => {
    it('should keep only places whose name contains it, ignoring case', () => {
      expect(names(sortPlaces(places, 'hallo', SortBy.NAME_ASC))).toEqual(['Halloween Nightmare']);
    });

    it('should ignore surrounding whitespace', () => {
      expect(names(sortPlaces(places, '  club  ', SortBy.NAME_ASC))).toEqual(['Unmonday Club']);
    });

    it('should return nothing when no name matches', () => {
      expect(sortPlaces(places, 'zzz', SortBy.NAME_ASC)).toEqual([]);
    });
  });

  describe('when some places are pinned to the watchlist', () => {
    it('should list pinned places first, whatever the sorting', () => {
      expect(names(sortPlaces(places, '', SortBy.NAME_DESC, ['bananarama']))).toEqual([
        'Bananarama',
        'Unmonday Club',
        'Halloween Nightmare',
      ]);
    });

    it('should sort the pinned places among themselves', () => {
      expect(
        names(sortPlaces(places, '', SortBy.NAME_ASC, ['unmonday club', 'halloween nightmare'])),
      ).toEqual(['Halloween Nightmare', 'Unmonday Club', 'Bananarama']);
    });

    it('should still respect the search query', () => {
      expect(names(sortPlaces(places, 'club', SortBy.NAME_ASC, ['bananarama']))).toEqual([
        'Unmonday Club',
      ]);
    });
  });
});
