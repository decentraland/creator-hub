/**
 * The Text group's "Alignment" pair: two 3-cell selectors over the single
 * `textAlign` enum.
 *
 * `TextAlignMode` packs both axes into one 9-value enum ordered vertical-major
 * (top-left … bottom-right), so the two selectors are just its two digits in
 * base 3. Every value stays reachable from the pair, which is why the raw enum
 * row is gone rather than merely hidden.
 */

export const TEXT_ALIGN_MODES = {
  vertical: ['top', 'middle', 'bottom'],
  horizontal: ['left', 'center', 'right'],
} as const;

export type TextAlignVertical = (typeof TEXT_ALIGN_MODES.vertical)[number];
export type TextAlignHorizontal = (typeof TEXT_ALIGN_MODES.horizontal)[number];

export interface TextAlignPair {
  vertical: TextAlignVertical;
  horizontal: TextAlignHorizontal;
}

/** TAM_MIDDLE_CENTER — what UiText/UiInput/UiDropdown render with the prop unset. */
export const DEFAULT_TEXT_ALIGN = 4;

/**
 * How the two selectors read a `textAlign` value. An unset prop — or one a
 * hand-authored file put outside the enum's range — reads as the in-world
 * default, so the selectors always have exactly one cell lit.
 */
export function splitTextAlign(mode: number | undefined): TextAlignPair {
  const value = Number.isInteger(mode) && mode! >= 0 && mode! <= 8 ? mode! : DEFAULT_TEXT_ALIGN;
  return {
    vertical: TEXT_ALIGN_MODES.vertical[Math.floor(value / 3)],
    horizontal: TEXT_ALIGN_MODES.horizontal[value % 3],
  };
}

/** The `textAlign` value for a pair of selected cells. Inverse of `splitTextAlign`. */
export function textAlignMode({ vertical, horizontal }: TextAlignPair): number {
  return (
    TEXT_ALIGN_MODES.vertical.indexOf(vertical) * 3 +
    TEXT_ALIGN_MODES.horizontal.indexOf(horizontal)
  );
}
