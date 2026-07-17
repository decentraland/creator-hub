export type DropType = 'before' | 'after' | 'inside';

export enum ClickType {
  CLICK = 'click',
  CONTEXT_MENU = 'contextmenu',
}

export function calculateDropType(y: number, rect: DOMRect, allowBefore = false): DropType {
  const threshold = Math.round(rect.height / 3);
  // `before` is opt-in (allowBefore): most trees only need inside/after, but a
  // precise insert-at-position (e.g. dropping a new widget into the UI tree)
  // needs the top-third `before` zone to land ahead of the first sibling.
  if (allowBefore && rect.top + threshold > y) return 'before';
  if (rect.bottom - threshold < y) return 'after';
  return 'inside';
}
