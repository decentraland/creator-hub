import type { Entity } from '@dcl/ecs';

import type { CodeUINode } from './code/types';

export type UINodeType = 'UiEntity' | 'Label' | 'Button' | 'Input' | 'Dropdown';

// Discriminator for a mixed-content segment (literal text interleaved with
// variable bindings) in a text field. Editor-local: the persisted form is the
// spliced template literal in source, so no runtime enum is involved.
export enum SegmentKind {
  LITERAL = 'literal',
  BINDING = 'binding',
}

// Fallback design/virtual resolution, used until src/ui/index.tsx's
// `{ virtualWidth, virtualHeight }` is read (code/aggregator.ts `readVirtualSize`
// → the code store's `virtualSize`, which is what the canvas stage frames).
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
  children: UINode[];
}

// What a node reads as in the UI. `<UiEntity>` is one JSX tag for two widgets:
// with a background texture it's an Image, otherwise a Container. Every other
// type displays as itself. Callers handle opaque/component-ref/platform nodes
// before classifying.
export type WidgetKind = Exclude<UINodeType, 'UiEntity'> | 'Container' | 'Image';

export function classifyNode(node: Pick<UINode, 'type' | 'uiBackground'>): WidgetKind {
  if (node.type !== 'UiEntity') return node.type;
  const texture = (node.uiBackground as { texture?: unknown } | undefined)?.texture;
  return texture ? 'Image' : 'Container';
}

// The entities of a shift-click range: the slice of the tree's VISIBLE row
// order (pre-order, honoring the tree's own child/collapse view via
// `getChildren`/`isOpen`) between the anchor and the clicked row. Ordered so
// the clicked row lands LAST — it becomes the selection's panel target. When
// the anchor is gone (collapsed away / removed), just the clicked row.
export function visibleRange(
  root: UINode,
  getChildren: (n: UINode) => UINode[],
  isOpen: (n: UINode) => boolean,
  anchor: Entity,
  target: Entity,
): Entity[] {
  const rows: Entity[] = [];
  const walk = (n: UINode): void => {
    rows.push(n.entity);
    if (isOpen(n)) getChildren(n).forEach(walk);
  };
  walk(root);
  const from = rows.indexOf(anchor);
  const to = rows.indexOf(target);
  if (to === -1) return [];
  if (from === -1) return [target];
  const slice = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
  return from <= to ? slice : slice.reverse();
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

// A UiEntity wrapping exactly one component-ref (and nothing else) is the
// positioning wrapper `spliceInsertComponent` emits. The tree collapses it into a
// single "component" row: the wrapper stays in source (it carries the instance's
// layout), but the editor presents wrapper+ref as ONE node. Anything with extra
// children renders normally.
export function soleComponentRef(n: UINode): CodeUINode | null {
  if (n.children.length !== 1) return null;
  const child = n.children[0] as CodeUINode;
  return child.componentRef ? child : null;
}

// Plain-text row label. The tree's getLabel may return a NODE (a dimmed platform
// branch), so filtering needs the string form separately.
export function nodeLabelText(n: UINode): string {
  const ref = soleComponentRef(n);
  if (ref) return ref.componentRef?.name ?? ref.name;
  const cn = n as CodeUINode;
  return cn.opaque || cn.platformVariant
    ? n.name || `${n.type} ${String(n.entity)}`
    : classifyNode(n);
}

// A node survives a tree filter when it matches OR any descendant does, so the
// path down to a match stays navigable rather than the match appearing orphaned.
// `term` must already be lower-cased and trimmed by the caller.
export function matchesFilter(n: UINode, term: string): boolean {
  if (nodeLabelText(n).toLowerCase().includes(term)) return true;
  return n.children.some(c => matchesFilter(c, term));
}
