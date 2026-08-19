// The Layout "Alignment" control: one 9-way vertical x horizontal picker over
// `justifyContent` (main axis) + `alignItems` (cross axis).
//
// Which prop owns which SCREEN axis depends on `flexDirection`: for a row the
// main axis is horizontal, for a column it is vertical, and the two `*-reverse`
// directions run the main axis backwards so start/end swap. Resolving that here
// is what stops the control lying — "Top left" has to mean top left in all four
// directions, not just `row`.
//
// A state outside the 9 cells (space-between, stretch, a bound value, nothing
// authored) has no cell: `patchToAlignment` returns null and the panel shows
// "Default", whose own patch clears both props back to the Yoga defaults.
// `Justify content` / `Align items` stay individually reachable as their own
// rows for everything this control cannot express.

type Pos = 'start' | 'center' | 'end';

export type AlignmentV = 'top' | 'middle' | 'bottom';
export type AlignmentH = 'left' | 'center' | 'right';
export type Alignment = `${AlignmentV}-${AlignmentH}`;

// Row-major, so the list doubles as the dropdown order.
export const ALIGNMENTS: Alignment[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const V_POS: Record<AlignmentV, Pos> = { top: 'start', middle: 'center', bottom: 'end' };
const H_POS: Record<AlignmentH, Pos> = { left: 'start', center: 'center', right: 'end' };
const V_FROM_POS: Record<Pos, AlignmentV> = { start: 'top', center: 'middle', end: 'bottom' };
const H_FROM_POS: Record<Pos, AlignmentH> = { start: 'left', center: 'center', end: 'right' };

// YGJustify: only the three edge/centre values map to a cell — space-between /
// -around / -evenly distribute rather than align.
const JUSTIFY: Record<Pos, number> = { start: 0, center: 1, end: 2 };
// YGAlign: 0 auto, 4 stretch, 5 baseline and the space-* values have no cell.
const ALIGN: Record<Pos, number> = { start: 1, center: 2, end: 3 };

const posFrom = (table: Record<Pos, number>, value: number): Pos | null =>
  (Object.keys(table) as Pos[]).find(p => table[p] === value) ?? null;

// YGFlexDirection: 0 row, 1 column, 2 column-reverse, 3 row-reverse.
const mainIsVertical = (flexDirection: number) => flexDirection === 1 || flexDirection === 2;
const mainIsReversed = (flexDirection: number) => flexDirection === 2 || flexDirection === 3;

const flip = (p: Pos): Pos => (p === 'start' ? 'end' : p === 'end' ? 'start' : 'center');

/** The `justifyContent` + `alignItems` pair that puts content at `alignment`. */
export function alignmentToPatch(
  alignment: Alignment,
  flexDirection: number,
): Record<string, unknown> {
  const [v, h] = alignment.split('-') as [AlignmentV, AlignmentH];
  const vertical = V_POS[v];
  const horizontal = H_POS[h];
  const main = mainIsVertical(flexDirection) ? vertical : horizontal;
  const cross = mainIsVertical(flexDirection) ? horizontal : vertical;
  return {
    justifyContent: JUSTIFY[mainIsReversed(flexDirection) ? flip(main) : main],
    alignItems: ALIGN[cross],
  };
}

/** The cell a UiTransform reads as, or null when it sits outside the 9. */
export function patchToAlignment(
  transform: Record<string, unknown> | null,
  flexDirection: number,
): Alignment | null {
  const t = transform ?? {};
  const justify = t.justifyContent as number | undefined;
  const align = t.alignItems as number | undefined;
  if (justify === undefined || align === undefined) return null;
  const rawMain = posFrom(JUSTIFY, justify);
  const cross = posFrom(ALIGN, align);
  if (!rawMain || !cross) return null;
  const main = mainIsReversed(flexDirection) ? flip(rawMain) : rawMain;
  const vertical = mainIsVertical(flexDirection) ? main : cross;
  const horizontal = mainIsVertical(flexDirection) ? cross : main;
  return `${V_FROM_POS[vertical]}-${H_FROM_POS[horizontal]}`;
}

/** Back to the Yoga defaults — the panel's "Default" option. */
export function clearAlignmentPatch(): Record<string, unknown> {
  return { justifyContent: undefined, alignItems: undefined };
}

/**
 * Whether the 9-way picker faithfully represents the node's current alignment, and
 * so whether the raw `Justify content` / `Align items` rows should stay out of the
 * way. Representable = one of the 9 cells, or neither prop authored (which the
 * picker shows as "Default"). Everything else — one prop set without the other, a
 * distributing `justifyContent`, an `auto`/`stretch`/`baseline` `alignItems` — has
 * no cell, so the raw rows are the only honest way to show it.
 */
export function alignmentIsRepresentable(transform: Record<string, unknown> | null): boolean {
  const t = transform ?? {};
  if (t.justifyContent === undefined && t.alignItems === undefined) return true;
  return patchToAlignment(t, (t.flexDirection as number | undefined) ?? 0) !== null;
}
