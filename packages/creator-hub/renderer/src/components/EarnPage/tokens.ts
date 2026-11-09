type TypeToken =
  | 'display-semi'
  | 'h2-semi'
  | 'h3-semi'
  | 'h4-semi'
  | 'h5-semi'
  | 'h5-regular'
  | 'h6-semi'
  | 'h6-semi-caps'
  | 'h6-regular'
  | 'h7-semi'
  | 'h7-semi-caps'
  | 'h7-regular'
  | 'h8-semi'
  | 'h8-regular';

/** Inter with optical sizing off; MUI's Tab and Chip default to Roboto and form controls reset optical sizing. */
export const fontFace = {
  fontFamily: 'var(--font-family)',
  fontOpticalSizing: 'none' as const,
};

/** A `theme.css` type token in Inter at `line-height: normal`, as Figma renders it. */
export const typeToken = (name: TypeToken) => ({
  ...fontFace,
  fontSize: `var(--type-${name}-size)`,
  fontWeight: `var(--type-${name}-weight)`,
  lineHeight: 'normal',
  letterSpacing: `var(--type-${name}-letter-spacing)`,
});

/** The 2px `--palette-info-light` keyboard focus ring. */
export const focusRing = {
  '&:focus-visible': {
    outline: '2px solid var(--palette-info-light)',
    outlineOffset: 2,
  },
};
