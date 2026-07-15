import type { Entity } from '@dcl/ecs';

export type UINodeType = 'UiEntity' | 'Label' | 'Button' | 'Input' | 'Dropdown';

// Discriminator for a mixed-content segment (literal text interleaved with
// variable bindings) in a text field. Editor-local: the persisted form is the
// spliced template literal in source, so no runtime enum is involved.
export enum SegmentKind {
  LITERAL = 'literal',
  BINDING = 'binding',
}

// Default design/virtual resolution for a UI — the editor canvas stage size.
// Code-mode does not persist a per-UI canvas size yet (TODO(M5): read it from
// the setUiRenderer call or a manifest), so every root uses this fallback.
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
