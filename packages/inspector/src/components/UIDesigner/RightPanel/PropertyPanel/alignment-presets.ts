type Pos = 'start' | 'center' | 'end';

export type AlignmentV = 'top' | 'middle' | 'bottom';
export type AlignmentH = 'left' | 'center' | 'right';
export type Alignment = `${AlignmentV}-${AlignmentH}`;

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

const JUSTIFY: Record<Pos, number> = { start: 0, center: 1, end: 2 };
const ALIGN: Record<Pos, number> = { start: 1, center: 2, end: 3 };

const posFrom = (table: Record<Pos, number>, value: number): Pos | null =>
  (Object.keys(table) as Pos[]).find(p => table[p] === value) ?? null;

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

/** Whether the 9-way picker faithfully represents the node's current alignment (one of the 9 cells, or neither prop authored). */
export function alignmentIsRepresentable(transform: Record<string, unknown> | null): boolean {
  const t = transform ?? {};
  if (t.justifyContent === undefined && t.alignItems === undefined) return true;
  return patchToAlignment(t, (t.flexDirection as number | undefined) ?? 0) !== null;
}
