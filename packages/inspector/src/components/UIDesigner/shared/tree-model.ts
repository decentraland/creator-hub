import type { Entity } from '@dcl/ecs';

import type { CodeUINode } from '../code/types';

export type UINodeType = 'UiEntity' | 'Label' | 'Button' | 'Input' | 'Dropdown';

/** Discriminator for a mixed-content text segment: literal text vs a variable binding. */
export enum SegmentKind {
  LITERAL = 'literal',
  BINDING = 'binding',
}

/** The design resolution the editor canvas frames against; react-ecs defaults the in-world value per device. */
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

/** What a node reads as in the UI (UiEntity splits into Container / Image). */
export type WidgetKind = Exclude<UINodeType, 'UiEntity'> | 'Container' | 'Image';

export function classifyNode(node: Pick<UINode, 'type' | 'uiBackground'>): WidgetKind {
  if (node.type !== 'UiEntity') return node.type;
  const texture = (node.uiBackground as { texture?: unknown } | undefined)?.texture;
  return texture ? 'Image' : 'Container';
}

/** The entities of a shift-click range, in visible pre-order, with the clicked row last. */
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

/** Compose the canvas preview for a (possibly bound) text field. */
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

/** The sole component-ref child of a positioning-wrapper UiEntity, or null. */
export function soleComponentRef(n: UINode): CodeUINode | null {
  if (n.children.length !== 1) return null;
  const child = n.children[0] as CodeUINode;
  return child.componentRef ? child : null;
}

/** Plain-text row label for a node. */
export function nodeLabelText(n: UINode): string {
  const ref = soleComponentRef(n);
  if (ref) return ref.componentRef?.name ?? ref.name;
  const cn = n as CodeUINode;
  if (cn.uiName) return cn.uiName;
  return cn.opaque || cn.platformVariant
    ? n.name || `${n.type} ${String(n.entity)}`
    : classifyNode(n);
}

/** Whether a node or any descendant matches an already lower-cased, trimmed term. */
export function matchesFilter(n: UINode, term: string): boolean {
  if (nodeLabelText(n).toLowerCase().includes(term)) return true;
  return n.children.some(c => matchesFilter(c, term));
}
