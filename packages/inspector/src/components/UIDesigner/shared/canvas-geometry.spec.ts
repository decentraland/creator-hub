import { describe, expect, it } from 'vitest';

import { YGU_POINT } from '../../../lib/sdk/ui-transform-constants';

import { computeCanvasGeometry, type RootTransform } from './canvas-geometry';
import { DEFAULT_SCREENS } from './safe-areas';
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_CANVAS_WIDTH,
} from './tree-model';

const PERCENT_UNIT = 2;

const fixedRootTransform = (width: number, height: number): RootTransform => ({
  width,
  height,
  widthUnit: YGU_POINT,
  heightUnit: YGU_POINT,
});

const fluidRootTransform: RootTransform = {
  width: 100,
  height: 100,
  widthUnit: PERCENT_UNIT,
  heightUnit: PERCENT_UNIT,
};

const geometry = (overrides: Partial<Parameters<typeof computeCanvasGeometry>[0]> = {}) =>
  computeCanvasGeometry({
    mobileHudSelected: false,
    platform: 'desktop',
    screens: DEFAULT_SCREENS,
    rootTransform: fluidRootTransform,
    ...overrides,
  });

describe('computeCanvasGeometry', () => {
  describe('when the mobile HUD is selected', () => {
    it('should frame it with the mobile screen even though a fixed-size root is active', () => {
      const result = geometry({
        mobileHudSelected: true,
        rootTransform: fixedRootTransform(512, 256),
      });

      expect(result.fixedRoot).toBe(false);
      expect(result.frameWidth).toBe(DEFAULT_SCREENS.mobile.width);
      expect(result.frameHeight).toBe(DEFAULT_SCREENS.mobile.height);
      expect(result.canvasWidth).toBe(MOBILE_CANVAS_WIDTH);
      expect(result.canvasHeight).toBe(MOBILE_CANVAS_HEIGHT);
    });

    it('should frame it identically whichever fixed-size root the creator came from', () => {
      const fromSmall = geometry({
        mobileHudSelected: true,
        rootTransform: fixedRootTransform(512, 256),
      });
      const fromLarge = geometry({
        mobileHudSelected: true,
        rootTransform: fixedRootTransform(1280, 900),
      });

      expect(fromSmall).toEqual(fromLarge);
    });

    it('should use the mobile device regardless of the selected platform', () => {
      const result = geometry({ mobileHudSelected: true, platform: 'desktop' });

      expect(result.device).toBe('mobile');
      expect(result.screen).toEqual(DEFAULT_SCREENS.mobile);
    });
  });

  describe('when a fixed-size root is active and the mobile HUD is not selected', () => {
    it('should frame the canvas with the root size and stop fitting', () => {
      const result = geometry({ rootTransform: fixedRootTransform(512, 256) });

      expect(result.fixedRoot).toBe(true);
      expect(result.canvasWidth).toBe(512);
      expect(result.canvasHeight).toBe(256);
      expect(result.frameWidth).toBe(512);
      expect(result.frameHeight).toBe(256);
      expect(result.fitScale).toBe(1);
    });

    it('should stay fluid when only one axis is a fixed point length', () => {
      const result = geometry({
        rootTransform: { width: 512, widthUnit: YGU_POINT, height: 100, heightUnit: PERCENT_UNIT },
      });

      expect(result.fixedRoot).toBe(false);
      expect(result.canvasWidth).toBe(DEFAULT_CANVAS_WIDTH);
    });
  });

  describe('when the root is fluid', () => {
    it('should frame desktop against the desktop design resolution', () => {
      const result = geometry({ platform: 'desktop' });

      expect(result.canvasWidth).toBe(DEFAULT_CANVAS_WIDTH);
      expect(result.canvasHeight).toBe(DEFAULT_CANVAS_HEIGHT);
      expect(result.fitScale).toBe(1);
    });

    it('should letterbox to the narrower axis when the screen aspect differs', () => {
      const result = geometry({
        platform: 'desktop',
        screens: { ...DEFAULT_SCREENS, desktop: { width: 2560, height: 1080 } },
      });

      expect(result.fitScale).toBe(1080 / DEFAULT_CANVAS_HEIGHT);
    });

    it('should tolerate a root with no transform at all', () => {
      const result = geometry({ rootTransform: undefined });

      expect(result.fixedRoot).toBe(false);
      expect(result.canvasWidth).toBe(DEFAULT_CANVAS_WIDTH);
    });
  });
});
