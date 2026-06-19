// Anchor presets, kept deliberately simple: clicking a preset places the node at
// a concrete ABSOLUTE pixel position computed from the node + parent size. No
// percent insets, no auto margins, no persistent "anchor" state — so a centered
// node is *truly* centered and dragging afterwards behaves like any other
// absolute node (plain Top/Left px). The active cell is derived by comparing the
// current Top/Left against the 9 computed positions.
//
// YGUnit numerics (erased const enum — hard-coded with comments): 0 undefined,
// 1 point(px).
const YGU_UNDEFINED = 0;
const YGU_POINT = 1;
const POSITION_ABSOLUTE = 1; // YGPositionType.YGPT_ABSOLUTE

type Edge = 'Top' | 'Right' | 'Bottom' | 'Left';
const EDGES: Edge[] = ['Top', 'Right', 'Bottom', 'Left'];

export type AnchorV = 'top' | 'middle' | 'bottom';
export type AnchorH = 'left' | 'center' | 'right';
export type AnchorPreset = `${AnchorV}-${AnchorH}`;

export interface Size {
  width: number;
  height: number;
}

// Grid order (row-major: top row, middle row, bottom row).
export const ANCHOR_PRESETS: AnchorPreset[] = [
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

// Target Top/Left (logical px) for a preset given the node + parent box.
function targetTopLeft(
  preset: AnchorPreset,
  elem: Size,
  parent: Size,
): { top: number; left: number } {
  const [v, h] = preset.split('-') as [AnchorV, AnchorH];
  const top =
    v === 'top'
      ? 0
      : v === 'bottom'
        ? parent.height - elem.height
        : (parent.height - elem.height) / 2;
  const left =
    h === 'left' ? 0 : h === 'right' ? parent.width - elem.width : (parent.width - elem.width) / 2;
  return { top, left };
}

// Build the UiTransform patch that places the node at `preset`. Switches it to
// Absolute and writes concrete Top/Left px, clearing Right/Bottom + any margins
// so nothing stale survives a preset switch.
export function presetToPatch(
  preset: AnchorPreset,
  elem: Size,
  parent: Size,
): Record<string, unknown> {
  const { top, left } = targetTopLeft(preset, elem, parent);
  const patch: Record<string, unknown> = { positionType: POSITION_ABSOLUTE };
  for (const e of EDGES) {
    patch[`position${e}`] = 0;
    patch[`position${e}Unit`] = YGU_UNDEFINED;
    patch[`margin${e}`] = 0;
    patch[`margin${e}Unit`] = YGU_POINT;
  }
  patch.positionTop = Math.round(top);
  patch.positionTopUnit = YGU_POINT;
  patch.positionLeft = Math.round(left);
  patch.positionLeftUnit = YGU_POINT;
  return patch;
}

// Highlight the preset whose computed position matches the node's current Top/Left
// (within a rounding tolerance), or null when it doesn't sit on a preset (e.g.
// after a freehand drag) or isn't absolutely positioned.
export function patchToPreset(
  t: Record<string, unknown>,
  elem: Size,
  parent: Size,
): AnchorPreset | null {
  if ((t.positionType as number | undefined) !== POSITION_ABSOLUTE) return null;
  if ((t.positionTopUnit as number | undefined) !== YGU_POINT) return null;
  if ((t.positionLeftUnit as number | undefined) !== YGU_POINT) return null;
  const top = (t.positionTop as number | undefined) ?? 0;
  const left = (t.positionLeft as number | undefined) ?? 0;
  const tol = 1.5;
  const near = (a: number, b: number) => Math.abs(a - b) <= tol;

  for (const preset of ANCHOR_PRESETS) {
    const target = targetTopLeft(preset, elem, parent);
    if (near(top, target.top) && near(left, target.left)) return preset;
  }
  return null;
}
