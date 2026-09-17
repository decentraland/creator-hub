import { describe, it, expect } from 'vitest';
import type { Scene } from '@dcl/schemas';

import { parseCoords, getRowsAndCols, sanitizeScene } from '../../src/modules/scene';

describe('parseCoords', () => {
  it('should parse a "x,y" string into numeric coordinates', () => {
    expect(parseCoords('3,-2')).toEqual({ x: 3, y: -2 });
  });
});

describe('sanitizeScene', () => {
  function getScene(scene: unknown): Scene {
    return { main: 'bin/index.js', scene } as Scene;
  }

  describe('when the scene has valid parcels and base', () => {
    it('should return them unchanged', () => {
      const scene = getScene({ parcels: ['0,0', '0,1'], base: '0,0' });
      expect(sanitizeScene(scene).scene).toEqual({ parcels: ['0,0', '0,1'], base: '0,0' });
    });
  });

  describe('when the parcels have the wrong type', () => {
    it('should drop numeric parcels and fall back to the base parcel', () => {
      const scene = getScene({ parcels: [0, 0], base: '0,0' });
      expect(sanitizeScene(scene).scene).toEqual({ parcels: ['0,0'], base: '0,0' });
    });

    it('should keep the valid parcels and drop the invalid ones', () => {
      const scene = getScene({ parcels: ['1,1', 0, 'not-a-parcel'], base: '1,1' });
      expect(sanitizeScene(scene).scene).toEqual({ parcels: ['1,1'], base: '1,1' });
    });
  });

  describe('when the parcels are empty', () => {
    it('should fall back to a single parcel at the base coordinates', () => {
      const scene = getScene({ parcels: [], base: '2,3' });
      expect(sanitizeScene(scene).scene).toEqual({ parcels: ['2,3'], base: '2,3' });
    });
  });

  describe('when the base is invalid', () => {
    it('should fall back to the first valid parcel', () => {
      const scene = getScene({ parcels: ['5,5'], base: 7 });
      expect(sanitizeScene(scene).scene).toEqual({ parcels: ['5,5'], base: '5,5' });
    });
  });

  describe('when the scene section is missing entirely', () => {
    it('should default to a single parcel at 0,0', () => {
      const scene = getScene(undefined);
      expect(sanitizeScene(scene).scene).toEqual({ parcels: ['0,0'], base: '0,0' });
    });
  });
});

describe('getRowsAndCols', () => {
  it('should return zero rows and cols for an empty list of parcels', () => {
    expect(getRowsAndCols([])).toEqual({ rows: 0, cols: 0 });
  });

  it('should return 1x1 for a single parcel', () => {
    expect(getRowsAndCols([{ x: 0, y: 0 }])).toEqual({ rows: 1, cols: 1 });
  });

  it('should compute the bounding box for parcels within a single quadrant', () => {
    const parcels = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 2, y: 3 },
    ];
    expect(getRowsAndCols(parcels)).toEqual({ rows: 3, cols: 3 });
  });

  it('should compute the correct bounding box when coordinates cross zero', () => {
    // regression test for decentraland/creator-hub#1351: a scene spanning
    // x: -3..3 (span 7) and y: -4..9 (span 14) was miscalculated as 3x6 (18)
    // because of `Math.abs(max) - Math.abs(min)` instead of `max - min`.
    const coords = [
      '-1,-4',
      '0,-4',
      '1,-4',
      '-1,-3',
      '0,-3',
      '1,-3',
      '-3,-2',
      '-2,-2',
      '-1,-2',
      '0,-2',
      '1,-2',
      '2,-2',
      '3,-2',
      '-3,-1',
      '-2,-1',
      '-1,-1',
      '0,-1',
      '1,-1',
      '2,-1',
      '3,-1',
      '-3,0',
      '-2,0',
      '-1,0',
      '0,0',
      '1,0',
      '2,0',
      '3,0',
      '-3,1',
      '-2,1',
      '-1,1',
      '0,1',
      '1,1',
      '2,1',
      '3,1',
      '-2,2',
      '-1,2',
      '0,2',
      '1,2',
      '2,2',
      '-2,3',
      '-1,3',
      '0,3',
      '1,3',
      '2,3',
      '-2,4',
      '-1,4',
      '0,4',
      '1,4',
      '2,4',
      '-2,5',
      '2,5',
      '-2,6',
      '2,6',
      '-2,7',
      '2,7',
      '-2,8',
      '-1,8',
      '0,8',
      '1,8',
      '2,8',
      '0,9',
      '-1,5',
      '0,5',
      '1,5',
      '-1,6',
      '0,6',
      '1,6',
      '-1,7',
      '0,7',
      '1,7',
    ];

    expect(coords).toHaveLength(70);

    const parcels = coords.map(parseCoords);
    expect(getRowsAndCols(parcels)).toEqual({ rows: 7, cols: 14 });
  });
});
