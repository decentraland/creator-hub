import { SegmentKind } from '../../../shared/tree-model';
import type { CanvasSegment } from '../../../shared/tree-model';

const SAFE_BINDING_EXPR = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)?$/;
export function isSafeBindingExpr(expr: string): boolean {
  return SAFE_BINDING_EXPR.test(expr);
}

/** Read the editor's direct child nodes into an ordered segment list. */
export function serializeNodes(root: HTMLElement): CanvasSegment[] {
  const out: CanvasSegment[] = [];
  root.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push({ kind: SegmentKind.LITERAL, value: node.textContent ?? '' });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const variable = (node as HTMLElement).dataset?.variable;
      if (variable && isSafeBindingExpr(variable)) {
        out.push({ kind: SegmentKind.BINDING, value: variable });
      }
    }
  });
  return out;
}

/** Merge adjacent literal segments and drop empty literals, preserving binding order. */
export function normalizeSegments(segments: CanvasSegment[]): CanvasSegment[] {
  const out: CanvasSegment[] = [];
  for (const seg of segments) {
    if (seg.kind === SegmentKind.LITERAL) {
      if (seg.value === '') continue;
      const last = out[out.length - 1];
      if (last && last.kind === SegmentKind.LITERAL) {
        last.value += seg.value;
      } else {
        out.push({ kind: SegmentKind.LITERAL, value: seg.value });
      }
    } else {
      out.push({ kind: SegmentKind.BINDING, value: seg.value });
    }
  }
  return out;
}

/** Seed the editor from storage: existing mixed entry, else whole-field binding, else static literal. */
export function seedSegments(
  rawValue: unknown,
  mixed: CanvasSegment[] | undefined,
  boundVariable: string | undefined,
): CanvasSegment[] {
  if (mixed && mixed.length > 0) return mixed;
  if (boundVariable) return [{ kind: SegmentKind.BINDING, value: boundVariable }];
  const text = typeof rawValue === 'string' ? rawValue : '';
  return text ? [{ kind: SegmentKind.LITERAL, value: text }] : [];
}
