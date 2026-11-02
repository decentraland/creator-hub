import { describe, expect, it } from 'vitest';
import {
  breaksLandPlaceContinuity,
  breaksWorldPlaceContinuity,
  countOverlappedWorldScenes,
} from './utils';

describe('breaksLandPlaceContinuity', () => {
  const existing = [{ base: '0,0', parcels: ['0,0', '0,1'] }];

  it('does not warn on a first deployment', () => {
    expect(breaksLandPlaceContinuity([], { base: '5,5', parcels: ['5,5'] })).toBe(false);
  });

  it('does not warn when nothing changes', () => {
    expect(breaksLandPlaceContinuity(existing, { base: '0,0', parcels: ['0,1', '0,0'] })).toBe(
      false,
    );
  });

  it('does not warn when only the base parcel changes', () => {
    expect(breaksLandPlaceContinuity(existing, { base: '0,1', parcels: ['0,0', '0,1'] })).toBe(
      false,
    );
  });

  it('does not warn when only the set of parcels changes', () => {
    expect(
      breaksLandPlaceContinuity(existing, { base: '0,0', parcels: ['0,0', '0,1', '0,2'] }),
    ).toBe(false);
  });

  it('warns when both the base parcel and the set of parcels change', () => {
    expect(
      breaksLandPlaceContinuity(existing, { base: '0,1', parcels: ['0,1', '0,2', '0,3'] }),
    ).toBe(true);
  });

  it('warns when any of several replaced scenes loses its place', () => {
    const scenes = [
      { base: '0,0', parcels: ['0,0'] },
      { base: '1,0', parcels: ['1,0', '1,1'] },
    ];
    expect(breaksLandPlaceContinuity(scenes, { base: '0,0', parcels: ['0,0', '1,0'] })).toBe(true);
  });
});

describe('breaksWorldPlaceContinuity', () => {
  const scenes = [{ parcels: ['0,0', '0,1'] }, { parcels: ['5,5'] }];

  it('does not warn for a world without scenes', () => {
    expect(breaksWorldPlaceContinuity([], ['0,0'])).toBe(false);
  });

  it('does not warn when overlapping exactly one scene', () => {
    expect(breaksWorldPlaceContinuity(scenes, ['0,1', '0,2'])).toBe(false);
  });

  it('warns when overlapping no scene', () => {
    expect(breaksWorldPlaceContinuity(scenes, ['9,9'])).toBe(true);
  });

  it('warns when overlapping two or more scenes', () => {
    expect(breaksWorldPlaceContinuity(scenes, ['0,1', '5,5'])).toBe(true);
  });

  it('counts a scene once however many of its parcels overlap', () => {
    expect(countOverlappedWorldScenes(scenes, ['0,0', '0,1'])).toBe(1);
  });
});
