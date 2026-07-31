import { describe, it, expect } from 'vitest';

import { parseCoords, getRowsAndCols } from '../../src/modules/scene';

describe('parseCoords', () => {
  it('should parse a "x,y" string into numeric coordinates', () => {
    expect(parseCoords('3,-2')).toEqual({ x: 3, y: -2 });
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
