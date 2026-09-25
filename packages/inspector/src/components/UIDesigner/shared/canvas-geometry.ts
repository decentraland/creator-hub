import { YGU_POINT } from '../../../lib/sdk/ui-transform-constants';

import type { DeviceKind, ScreenSize } from './safe-areas';
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_CANVAS_WIDTH,
} from './tree-model';

export type RootTransform = Record<string, number | undefined>;

export type CanvasGeometryInput = {
  mobileHudSelected: boolean;
  platform: DeviceKind;
  screens: Record<DeviceKind, ScreenSize>;
  rootTransform: RootTransform | undefined;
};

export type CanvasGeometry = {
  device: DeviceKind;
  screen: ScreenSize;
  fixedRoot: boolean;
  canvasWidth: number;
  canvasHeight: number;
  frameWidth: number;
  frameHeight: number;
  fitScale: number;
};

/** Canvas framing for the UI Designer: the design resolution, the screen frame and the fit factor. */
export function computeCanvasGeometry({
  mobileHudSelected,
  platform,
  screens,
  rootTransform,
}: CanvasGeometryInput): CanvasGeometry {
  const device: DeviceKind = mobileHudSelected ? 'mobile' : platform;
  const screen = screens[device];

  const rootT = rootTransform ?? {};
  const rootFixedW = rootT.widthUnit === YGU_POINT ? rootT.width : undefined;
  const rootFixedH = rootT.heightUnit === YGU_POINT ? rootT.height : undefined;
  const fixedRoot = !mobileHudSelected && rootFixedW !== undefined && rootFixedH !== undefined;

  const canvasWidth = fixedRoot
    ? (rootFixedW as number)
    : device === 'mobile'
      ? MOBILE_CANVAS_WIDTH
      : DEFAULT_CANVAS_WIDTH;
  const canvasHeight = fixedRoot
    ? (rootFixedH as number)
    : device === 'mobile'
      ? MOBILE_CANVAS_HEIGHT
      : DEFAULT_CANVAS_HEIGHT;

  const frameWidth = fixedRoot ? canvasWidth : screen.width;
  const frameHeight = fixedRoot ? canvasHeight : screen.height;

  const fitScale = fixedRoot ? 1 : Math.min(frameWidth / canvasWidth, frameHeight / canvasHeight);

  return {
    device,
    screen,
    fixedRoot,
    canvasWidth,
    canvasHeight,
    frameWidth,
    frameHeight,
    fitScale,
  };
}
