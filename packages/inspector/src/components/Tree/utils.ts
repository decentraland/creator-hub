export type DropType = 'before' | 'after' | 'inside';

export enum ClickType {
  CLICK = 'click',
  CONTEXT_MENU = 'contextmenu',
}

export function calculateDropType(y: number, rect: DOMRect, allowBefore = false): DropType {
  const threshold = Math.round(rect.height / 3);
  if (allowBefore && rect.top + threshold > y) return 'before';
  if (rect.bottom - threshold < y) return 'after';
  return 'inside';
}
