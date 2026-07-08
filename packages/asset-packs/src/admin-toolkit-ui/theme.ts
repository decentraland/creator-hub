import { Color4 } from '@dcl/sdk/math';

// Design tokens for the admin toolkit, matching the "Admin Tools" Figma
// (file bAg8znsO6A5Bi4k3QBCaaO). react-ecs has no CSS variables, shadows, or
// text-transform; elevation is expressed by layering the near-black surfaces.

function withAlpha(hex: string, alpha: number): Color4 {
  const color = Color4.fromHexString(hex);
  return Color4.create(color.r, color.g, color.b, alpha);
}

const COLORS = {
  // brand
  primary: Color4.fromHexString('#FF2D55'),
  primaryHover: Color4.fromHexString('#FF4569'),
  primaryPressed: Color4.fromHexString('#F70038'),

  // surfaces
  panel: Color4.fromHexString('#16161E'),
  surface: Color4.fromHexString('#22222C'),
  surfaceElevated: Color4.fromHexString('#22222C'),
  surfaceHover: Color4.fromHexString('#2A2A36'),

  // text
  textPrimary: Color4.White(),
  textSecondary: Color4.fromHexString('#8A8A99'),
  textTertiary: Color4.fromHexString('#D0D0DA'),
  textDisabled: withAlpha('#8A8A99', 0.5),
  textOnPrimary: Color4.White(),
  textOnLight: Color4.fromHexString('#16161E'),

  // borders & dividers
  border: Color4.fromHexString('#32323E'),
  borderSubtle: Color4.fromHexString('#32323E'),
  outline: Color4.fromHexString('#3C3C4A'),
  divider: Color4.fromHexString('#2A2A36'),

  // semantic
  success: Color4.fromHexString('#4ADE80'),
  successHover: Color4.fromHexString('#3BCB70'),
  successBg: withAlpha('#4ADE80', 0.12),
  info: Color4.fromHexString('#8F9AFF'),
  infoBg: withAlpha('#8F9AFF', 0.14),
  danger: Color4.fromHexString('#FF5C7C'),
  dangerHover: Color4.fromHexString('#FF4569'),
  dangerOverlay: withAlpha('#FF2D55', 0.14),
  warning: Color4.fromHexString('#FE9C2A'),

  // tinted icon-badge backgrounds
  badgeMagenta: withAlpha('#FF2D55', 0.14),
  badgeBlue: withAlpha('#8F9AFF', 0.14),

  // inputs
  inputBackground: Color4.fromHexString('#22222C'),
  inputText: Color4.White(),
  inputPlaceholder: Color4.fromHexString('#8A8A99'),
  inputBorder: Color4.fromHexString('#32323E'),

  disabledBackground: Color4.fromHexString('#32323E'),
  transparent: Color4.create(0, 0, 0, 0),
  white: Color4.White(),
  black: Color4.Black(),
} as const;

// Type scale (Inter). Figma uses 12–15px on a 400px panel; the toolkit renders
// on a 1920x1080 virtual canvas so px map ~1:1 at 1080p.
const TYPE = {
  title: 15,
  subtitle: 15,
  header: 14,
  body: 13,
  label: 12,
  caption: 12,
  small: 11,
  button: 13,
} as const;

const SPACING = {
  xxs: 3,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  xxl: 18,
} as const;

const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 99,
} as const;

export { COLORS, RADIUS, SPACING, TYPE, withAlpha };
