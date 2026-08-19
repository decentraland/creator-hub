import { describe, expect, it } from 'vitest';

import type { DeviceKind, SafeRect } from './safe-areas';
import { DEFAULT_SCREENS, SAFE_AREAS, SCREEN_PRESETS } from './safe-areas';

const DEVICES: DeviceKind[] = ['desktop', 'mobile'];

const overlaps = (a: SafeRect, b: SafeRect) =>
  a.x[0] < b.x[1] && b.x[0] < a.x[1] && a.y[0] < b.y[1] && b.y[0] < a.y[1];

describe.each(DEVICES)('the %s safe area', device => {
  const spec = SAFE_AREAS[device];

  it('should keep every rect inside the screen and non-degenerate', () => {
    for (const rect of [...spec.regions, spec.safeZone]) {
      for (const [lo, hi] of [rect.x, rect.y]) {
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(1);
        expect(lo).toBeLessThan(hi);
      }
    }
  });

  // The bands are translucent shading, so an overlap reads as a darker patch
  // that looks like a distinct region the docs never described.
  it('should not overlap its own regions', () => {
    for (const [i, a] of spec.regions.entries()) {
      for (const b of spec.regions.slice(i + 1)) {
        expect({ a: a.label, b: b.label, overlaps: overlaps(a, b) }).toEqual({
          a: a.label,
          b: b.label,
          overlaps: false,
        });
      }
    }
  });

  it('should keep the safe zone clear of everything reserved', () => {
    for (const region of spec.regions.filter(r => r.severity === 'reserved')) {
      expect({ label: region.label, overlaps: overlaps(region, spec.safeZone) }).toEqual({
        label: region.label,
        overlaps: false,
      });
    }
  });
});

// docs.decentraland.org/creator/build-for-mobile/develop/safe-area — the center
// safe zone table (x 0.30–0.75, y 0.08–0.92 at the 1600×720 landscape reference).
describe('the mobile safe zone', () => {
  it('should match the published center band', () => {
    expect(SAFE_AREAS.mobile.safeZone).toEqual({ x: [0.3, 0.75], y: [0.08, 0.92] });
  });
});

// The same page carves a usable gap out of the right 25%, between the top-right
// profile cluster and the bottom-right interaction button. Shading it as
// forbidden — which a solid right band does — hides real estate the docs hand
// creators for icons and counters.
describe('the mobile right-side gap', () => {
  const gap = SAFE_AREAS.mobile.regions.find(r => r.severity === 'limited');

  it('should be offered as limited rather than reserved', () => {
    expect(gap).toBeDefined();
    expect(gap?.x).toEqual([0.75, 1]);
    expect(gap?.y).toEqual([0.22, 0.5]);
  });
});

// docs.decentraland.org/creator/scenes-sdk7/designing-the-experience/ux-ui-guide
// documents exactly one desktop region: the left 25%. Anything finer would be
// invented, so the spec pins the count as well as the value.
describe('the desktop safe area', () => {
  it('should reserve the left quarter and nothing else', () => {
    expect(SAFE_AREAS.desktop.regions).toHaveLength(1);
    expect(SAFE_AREAS.desktop.regions[0].x).toEqual([0, 0.25]);
    expect(SAFE_AREAS.desktop.safeZone).toEqual({ x: [0.25, 1], y: [0, 1] });
  });
});

describe.each(DEVICES)('the %s screen presets', device => {
  const presets = SCREEN_PRESETS[device];

  it('should all be positive and distinctly identified', () => {
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
    expect(new Set(presets.map(p => p.id)).size).toBe(presets.length);
  });

  // The default has to BE a preset, or the picker opens showing nothing selected.
  it('should include the default screen', () => {
    const { width, height } = DEFAULT_SCREENS[device];
    expect(presets.some(p => p.width === width && p.height === height)).toBe(true);
  });
});

// The published mobile safe-area fractions are derived at 1600×720 landscape, so
// that resolution has to stay on the list and stay the default — the region model
// is only exactly right there.
describe('the mobile default screen', () => {
  it('should be the documented 1600x720 landscape reference', () => {
    expect(DEFAULT_SCREENS.mobile).toEqual({ width: 1600, height: 720 });
  });
});
