import { describe, expect, it } from 'vitest';

import type { LandScene } from '/@/modules/store/management/utils';
import { SortBy } from '/shared/types/manage';

import { selectScenes, slugify } from './scenes';

const scene = (id: string, title: string, timestamp: number, base: string): LandScene => ({
  id,
  title,
  base,
  parcels: [base],
  timestamp,
  thumbnail: '',
});

const scenes = [
  scene('b', 'Scene B', 3000, '20,20'),
  scene('a', 'Scene A', 1000, '96,15'),
  scene('c', 'Scene C', 2000, '22,20'),
];

describe('selectScenes', () => {
  describe('when sorting by last updated', () => {
    it('should put the newest deployment first', () => {
      expect(selectScenes(scenes, { sortBy: SortBy.LATEST, query: '' }).map(s => s.id)).toEqual([
        'b',
        'c',
        'a',
      ]);
    });
  });

  describe('when sorting by name', () => {
    it('should order them A to Z', () => {
      expect(selectScenes(scenes, { sortBy: SortBy.NAME, query: '' }).map(s => s.id)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });
  });

  describe('when searching', () => {
    it('should match the title, ignoring case, or the coordinates', () => {
      expect(
        selectScenes(scenes, { sortBy: SortBy.NAME, query: 'scene a' }).map(s => s.id),
      ).toEqual(['a']);
      expect(selectScenes(scenes, { sortBy: SortBy.NAME, query: '22, 20' }).map(s => s.id)).toEqual(
        ['c'],
      );
    });
  });
});

describe('slugify', () => {
  it('should make a file-safe name, falling back to "scene"', () => {
    expect(slugify('My Scene: Plaza!')).toBe('my-scene-plaza');
    expect(slugify('***')).toBe('scene');
  });
});
