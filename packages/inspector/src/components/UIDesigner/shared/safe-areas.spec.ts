import { describe, expect, it } from 'vitest';

import type { DeviceKind, SafeRect } from './safe-areas';
import { DEFAULT_SCREENS, SAFE_AREAS, SCREEN_PRESETS } from './safe-areas';

const DEVICES: DeviceKind[] = ['desktop', 'mobile'];
const width = (r: SafeRect) => r.x[1] - r.x[0];
const contains = (outer: SafeRect, inner: SafeRect) =>
  inner.x[0] >= outer.x[0] &&
  inner.x[1] <= outer.x[1] &&
  inner.y[0] >= outer.y[0] &&
  inner.y[1] <= outer.y[1];

describe.each(DEVICES)('the %s safe area', device => {
  const spec = SAFE_AREAS[device];

  it('should keep both areas inside the screen and non-degenerate', () => {
    for (const rect of [spec.screenInsetArea, spec.interactableArea]) {
      for (const [lo, hi] of [rect.x, rect.y]) {
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(1);
        expect(lo).toBeLessThan(hi);
      }
    }
  });

  it('should nest the interactable area inside the screen inset area', () => {
    expect(contains(spec.screenInsetArea, spec.interactableArea)).toBe(true);
  });

  it('should place every HUD guide inside the screen', () => {
    for (const g of spec.hud) {
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x).toBeLessThanOrEqual(1);
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.y).toBeLessThanOrEqual(1);
      expect(g.size).toBeGreaterThan(0);
    }
  });
});

describe('the mobile reference numbers', () => {
  it('should give an ~86% screen-inset width and ~65% interactable width', () => {
    expect(width(SAFE_AREAS.mobile.screenInsetArea)).toBeCloseTo(0.862, 2);
    expect(width(SAFE_AREAS.mobile.interactableArea)).toBeCloseTo(0.651, 2);
  });
});

describe('the desktop reference numbers', () => {
  it('should reserve the left quarter and inset nothing at the device level', () => {
    expect(SAFE_AREAS.desktop.screenInsetArea).toEqual({ x: [0, 1], y: [0, 1] });
    expect(SAFE_AREAS.desktop.interactableArea).toEqual({ x: [0.25, 1], y: [0, 1] });
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

  it('should include the default screen', () => {
    const { width: w, height: h } = DEFAULT_SCREENS[device];
    expect(presets.some(p => p.width === w && p.height === h)).toBe(true);
  });
});

describe('the mobile default screen', () => {
  it('should be the documented 1600x720 landscape reference', () => {
    expect(DEFAULT_SCREENS.mobile).toEqual({ width: 1600, height: 720 });
  });
});
