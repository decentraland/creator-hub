import { Color3, Vector3 } from '@babylonjs/core';
import type { PlaneConfig } from './types';

// Color constants
export const GREY_INACTIVE_COLOR = new Color3(0.8, 0.8, 0.8);
export const YELLOW_HOVER_COLOR = new Color3(1, 1, 0);
export const YELLOW_HOVER_EMISSIVE = new Color3(0.8, 0.8, 0);
export const AXIS_RED = new Color3(1, 0, 0);
export const AXIS_GREEN = new Color3(0, 1, 0);
export const AXIS_BLUE = new Color3(0, 0, 1);

// Plane colors (Blender style)
const PLANE_XY_DIFFUSE = new Color3(0, 0, 1);
const PLANE_XY_EMISSIVE = new Color3(0, 0, 0.8);
const PLANE_XZ_DIFFUSE = new Color3(0, 1, 0);
const PLANE_XZ_EMISSIVE = new Color3(0, 0.8, 0);
const PLANE_YZ_DIFFUSE = new Color3(1, 0, 0);
const PLANE_YZ_EMISSIVE = new Color3(0.8, 0, 0);

// Alpha constants
export const FADE_ALPHA = 0.5;
export const FULL_ALPHA = 1.0;

// Plane geometry constants
const PLANE_SIZE = 0.03;
const PLANE_THICKNESS = 0.001;
const PLANE_OFFSET = 0.09;

export const PLANE_CONFIGS: PlaneConfig[] = [
  {
    type: 'XY',
    dimensions: [PLANE_SIZE, PLANE_SIZE, PLANE_THICKNESS],
    position: new Vector3(PLANE_OFFSET, PLANE_OFFSET, 0),
    diffuse: PLANE_XY_DIFFUSE,
    emissive: PLANE_XY_EMISSIVE,
  },
  {
    type: 'XZ',
    dimensions: [PLANE_SIZE, PLANE_THICKNESS, PLANE_SIZE],
    position: new Vector3(PLANE_OFFSET, 0, PLANE_OFFSET),
    diffuse: PLANE_XZ_DIFFUSE,
    emissive: PLANE_XZ_EMISSIVE,
  },
  {
    type: 'YZ',
    dimensions: [PLANE_THICKNESS, PLANE_SIZE, PLANE_SIZE],
    position: new Vector3(0, PLANE_OFFSET, PLANE_OFFSET),
    diffuse: PLANE_YZ_DIFFUSE,
    emissive: PLANE_YZ_EMISSIVE,
  },
];
