import { Color3, Vector3 } from '@babylonjs/core';
import type { PlaneConfig } from './types';

// Axis colors — modern palette matching Unity/Blender conventions
export const AXIS_RED = new Color3(0.93, 0.27, 0.27); // X — warm coral red
export const AXIS_GREEN = new Color3(0.29, 0.82, 0.44); // Y — fresh lime green
export const AXIS_BLUE = new Color3(0.24, 0.6, 0.98); // Z — sky blue

// Hover — white reads as universally "active" and avoids color clash with any axis
export const YELLOW_HOVER_COLOR = new Color3(1, 1, 1);
export const YELLOW_HOVER_EMISSIVE = new Color3(0.9, 0.9, 0.9);

// Inactive — cool mid-grey with a slight blue tint
export const GREY_INACTIVE_COLOR = new Color3(0.6, 0.62, 0.68);

// Plane colors — semi-transparent tint matching the constrained axis pair
const PLANE_XY_DIFFUSE = new Color3(0.24, 0.6, 0.98); // XY plane → blue (Z axis)
const PLANE_XY_EMISSIVE = new Color3(0.18, 0.48, 0.78);
const PLANE_XZ_DIFFUSE = new Color3(0.29, 0.82, 0.44); // XZ plane → green (Y axis)
const PLANE_XZ_EMISSIVE = new Color3(0.22, 0.65, 0.34);
const PLANE_YZ_DIFFUSE = new Color3(0.93, 0.27, 0.27); // YZ plane → red (X axis)
const PLANE_YZ_EMISSIVE = new Color3(0.74, 0.2, 0.2);

// Alpha constants
export const FADE_ALPHA = 0.5;
export const FULL_ALPHA = 1.0;

// Plane geometry constants
const PLANE_SIZE = 0.022;
const PLANE_THICKNESS = 0.001;
const PLANE_OFFSET = 0.04;

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
