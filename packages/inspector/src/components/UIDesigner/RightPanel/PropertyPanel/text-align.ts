/** The Text group's "Alignment" pair: two 3-cell selectors over the single `textAlign` enum. */

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

/** How the two selectors read a `textAlign` value; an unset or out-of-range value reads as the in-world default. */
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
