// The Layout "Scroll Overflow" / "Clip Content" pair: two checkboxes over the
// single `overflow` enum.
//
// The enum's three values are not independent — scrolling implies clipping, and
// there is no "scroll without clipping" — so the two boxes are not two bits.
// Clip is FORCED on (and disabled) while Scroll is on, which is what makes the
// pair total: both off = visible, clip only = hidden, scroll = scroll. All three
// values stay reachable, so nothing needs the raw enum row as an escape hatch.

import { YGO_HIDDEN, YGO_SCROLL, YGO_VISIBLE } from '../../../../lib/sdk/ui-transform-constants';

export type OverflowFlag = 'scroll' | 'clip';

export interface OverflowFlags {
  scroll: boolean;
  clip: boolean;
  // Clipping is implied by scrolling, so its box is checked but not editable.
  clipLocked: boolean;
}

/** How the two checkboxes read a UiTransform. An unset prop is Yoga's visible. */
export function overflowFlags(transform: Record<string, unknown> | null): OverflowFlags {
  const value = ((transform ?? {}).overflow as number | undefined) ?? YGO_VISIBLE;
  const scroll = value === YGO_SCROLL;
  return { scroll, clip: scroll || value === YGO_HIDDEN, clipLocked: scroll };
}

/**
 * The patch for toggling one box. Unticking Scroll leaves Clip ticked (hidden,
 * not visible): the enum holds one value, so there is nowhere to remember what
 * clipping was before scrolling started, and the state the boxes were SHOWING is
 * the only honest thing to step down to. Its box is right there to untick.
 *
 * The value is always written explicitly, never removed as "back to the default":
 * an interaction override layer reads an absent key as "inherit from Default", so
 * a removal there would keep the inherited overflow while the boxes showed it
 * cleared.
 */
export function overflowPatch(
  flag: OverflowFlag,
  on: boolean,
  transform: Record<string, unknown> | null,
): Record<string, unknown> {
  if (flag === 'scroll' && on) return { overflow: YGO_SCROLL };
  // Both remaining cases resolve to the clipping the boxes are left showing:
  // Clip's own box (its box is disabled while scrolling, so `on` is the whole
  // story) or, for Scroll going off, the ticked Clip that scrolling implied.
  const clip = flag === 'clip' ? on : overflowFlags(transform).clip;
  return { overflow: clip ? YGO_HIDDEN : YGO_VISIBLE };
}
