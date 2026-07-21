import { SegmentKind } from '../tree-model';
import type { CanvasSegment } from '../tree-model';

// Pure helpers for the mixed-content inline editor. Extracted from the
// contentEditable component so serialize / normalize can be unit-tested without
// driving the DOM; the component stays a thin wiring layer. Segments use the
// shared CanvasSegment shape (`kind: 'literal' | 'binding'`); SegmentKind's
// string values ('literal'/'binding') seed the `kind`.

// A binding segment carries a code expression (`score` or `state.score`) that is
// interpolated verbatim into a `${…}` template-literal slot on write, so it must
// be a bare identifier or a single-level member access — nothing with operators,
// calls, whitespace, or braces that could break out of the template. This is the
// contentEditable trust boundary (a foreign paste/drop could inject an arbitrary
// data-variable). See MixedContentField onPaste/onDrop.
const SAFE_BINDING_EXPR = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)?$/;
export function isSafeBindingExpr(expr: string): boolean {
  return SAFE_BINDING_EXPR.test(expr);
}

// Read the editor's direct child nodes into an ordered segment list. Text nodes
// become literal segments; elements carrying `data-variable` (the chips) become
// binding segments. Anything else (stray <br>, etc.) is ignored.
export function serializeNodes(root: HTMLElement): CanvasSegment[] {
  const out: CanvasSegment[] = [];
  root.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push({ kind: SegmentKind.LITERAL, value: node.textContent ?? '' });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const variable = (node as HTMLElement).dataset?.variable;
      // Treat data-variable as untrusted: a foreign element (paste/drop/IME) can
      // carry an attacker-chosen value that would be spliced verbatim into a
      // `${…}` slot. Only accept a safe binding expression (identifier or
      // single-level member) — the same grammar the emit path relies on.
      if (variable && isSafeBindingExpr(variable)) {
        out.push({ kind: SegmentKind.BINDING, value: variable });
      }
    }
  });
  return out;
}

// Merge adjacent literal segments and drop empty literals. Binding segments are
// preserved in order. May return an empty array (a fully-empty field).
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

// Seed the editor from current storage with the read precedence:
// existing mixed entry -> single whole-field binding -> static literal value.
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
