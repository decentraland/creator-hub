import type { Entity } from '@dcl/ecs';
import { SegmentKind } from '@dcl/asset-packs';

export type UINodeType = 'UiEntity' | 'Label' | 'Button' | 'Input' | 'Dropdown';

// Default design/virtual resolution for a UI. Authors can override it per UI
// (stored on the `asset-packs::UI` marker as canvasWidth/canvasHeight); this is
// the fallback for new UIs and for legacy roots created before the field existed.
// It is also the runtime virtualWidth/virtualHeight the UI scales to fit the screen.
export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

export type CanvasSegment = { kind: string; value: string };
export type CanvasBindingRow = { field: string; variable: string; segments?: CanvasSegment[] };

export interface UINode {
  entity: Entity;
  type: UINodeType;
  name: string;
  uiTransform?: unknown;
  uiBackground?: unknown;
  uiText?: unknown;
  uiInput?: unknown;
  uiDropdown?: unknown;
  bindings?: CanvasBindingRow[];
  // Only set on the root node — the per-UI design canvas size (px), sanitized
  // to a positive value with the DEFAULT_CANVAS_* fallback applied.
  canvasWidth?: number;
  canvasHeight?: number;
  children: UINode[];
}

// Compose the canvas preview for a (possibly bound) text field. `resolve` maps a
// binding expression (`state.name`) to its default value; when it returns a value
// the preview shows it (`Hello: John`), otherwise the binding falls back to a
// `[state.name]` placeholder (a marker with no default, or an unresolved expr).
// Mixed-content rows compose literal text with each binding's resolved/placeholder
// value; a whole-field binding resolves the single expr; else the static value.
export function previewBoundText(
  bindings: CanvasBindingRow[] | undefined,
  fieldKey: string,
  staticValue: string,
  resolve?: (expr: string) => string | undefined,
): string {
  const row = bindings?.find(b => b.field === fieldKey);
  if (!row) return staticValue;
  const preview = (expr: string): string => {
    const r = resolve?.(expr);
    return r !== undefined ? r : `[${expr}]`;
  };
  if (row.segments && row.segments.length > 0) {
    return row.segments
      .map(s => (s.kind === SegmentKind.BINDING ? preview(s.value) : s.value))
      .join('');
  }
  if (row.variable) return preview(row.variable);
  return staticValue;
}

// A bag of the SDK component definitions a sibling-ordering read needs. The
// code-mode editor derives sibling order from JSX source order, so this is used
// only by the classic `rightOf`-chain operations layer (reorderUISibling) and
// its tests — orderSiblings is pure (reads only UiTransform.rightOf) and writes
// nothing, so it stays here as the shared ordering invariant.
export interface ComponentBag {
  UiTransform: any;
  UiBackground?: any;
  UiText?: any;
  UiInput?: any;
  UiDropdown?: any;
  Name?: any;
  UIBindings?: any;
  UI?: any;
}

// Order a sibling list by its `rightOf` linked chain (SDK7 UI sibling order):
// each node points at the sibling it renders after; 0/dangling/self = head.
// DFS from heads through claimants keeps ties (several nodes claiming one slot
// — e.g. legacy all-zero chains) in stable creation order, and the final
// defensive pass appends cycle leftovers so nodes never vanish from the list.
export function orderSiblings(list: Entity[], bag: ComponentBag): Entity[] {
  if (list.length < 2) return list;
  const inSet = new Set<number>(list as unknown as number[]);
  const claimants = new Map<number, Entity[]>(); // rightOf → followers (creation order)
  const heads: Entity[] = [];
  for (const entity of list) {
    const r: number = bag.UiTransform.getOrNull(entity)?.rightOf ?? 0;
    if (r !== 0 && inSet.has(r) && r !== (entity as unknown as number)) {
      const arr = claimants.get(r) ?? [];
      arr.push(entity);
      claimants.set(r, arr);
    } else {
      heads.push(entity);
    }
  }
  const ordered: Entity[] = [];
  const seen = new Set<Entity>();
  const visit = (entity: Entity) => {
    if (seen.has(entity)) return;
    seen.add(entity);
    ordered.push(entity);
    for (const follower of claimants.get(entity as unknown as number) ?? []) visit(follower);
  };
  for (const head of heads) visit(head);
  for (const entity of list) visit(entity); // cycle leftovers, defensive
  return ordered;
}
