import { describe, expect, it } from 'vitest';
import {
  breaksLandPlaceContinuity,
  countOverlappedWorldScenes,
  getWorldPlaceContinuityBreak,
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

describe('getWorldPlaceContinuityBreak', () => {
  const scenes = [{ parcels: ['0,0', '0,1'] }, { parcels: ['5,5'] }];

  it('does not warn for a world without scenes', () => {
    expect(getWorldPlaceContinuityBreak([], ['0,0'], true)).toBeNull();
    expect(getWorldPlaceContinuityBreak([], ['0,0'], false)).toBeNull();
  });

  describe('multi-scene mode', () => {
    it('does not warn when overlapping exactly one scene', () => {
      expect(getWorldPlaceContinuityBreak(scenes, ['0,1', '0,2'], true)).toBeNull();
    });

    it('does not warn when overlapping no scene, since nothing is disabled', () => {
      expect(getWorldPlaceContinuityBreak(scenes, ['9,9'], true)).toBeNull();
    });

    it('warns of a merge when overlapping two or more scenes', () => {
      expect(getWorldPlaceContinuityBreak(scenes, ['0,1', '5,5'], true)).toBe('merge');
    });
  });

  describe('single-scene mode', () => {
    it("does not warn when replacing the world's only scene", () => {
      expect(
        getWorldPlaceContinuityBreak([{ parcels: ['0,0'] }], ['0,0', '1,0'], false),
      ).toBeNull();
    });

    it('warns that the world is replaced when the placement overlaps no scene', () => {
      expect(getWorldPlaceContinuityBreak([{ parcels: ['5,5'] }], ['0,0'], false)).toBe(
        'replace-world',
      );
    });

    it('warns that the world is replaced when other scenes would be undeployed', () => {
      expect(getWorldPlaceContinuityBreak(scenes, ['0,0'], false)).toBe('replace-world');
    });

    it('warns of a merge when overlapping two or more scenes', () => {
      expect(getWorldPlaceContinuityBreak(scenes, ['0,0', '5,5'], false)).toBe('merge');
    });
  });
});

describe('countOverlappedWorldScenes', () => {
  it('counts a scene once however many of its parcels overlap', () => {
    expect(countOverlappedWorldScenes([{ parcels: ['0,0', '0,1'] }], ['0,0', '0,1'])).toBe(1);
  });
});
