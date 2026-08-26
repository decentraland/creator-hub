
import { YGO_HIDDEN, YGO_SCROLL, YGO_VISIBLE } from '../../../../lib/sdk/ui-transform-constants';

export type OverflowFlag = 'scroll' | 'clip';

export interface OverflowFlags {
  scroll: boolean;
  clip: boolean;
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
  const clip = flag === 'clip' ? on : overflowFlags(transform).clip;
  return { overflow: clip ? YGO_HIDDEN : YGO_VISIBLE };
}
