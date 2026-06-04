import { SegmentKind } from '@dcl/asset-packs';
import type { UISegment } from '@dcl/asset-packs';

import { isValidIdentifier } from '../../../lib/sdk/operations/validators';

// Pure helpers for the mixed-content inline editor. Extracted from the
// contentEditable component so serialize / normalize / routing can be
// unit-tested without driving the DOM; the component stays a thin wiring layer.

type StoragePlan =
  | { mode: 'literal'; text: string }
  | { mode: 'single-bind'; variable: string }
  | { mode: 'mixed'; segments: UISegment[] };

// Read the editor's direct child nodes into an ordered segment list. Text nodes
// become literal segments; elements carrying `data-variable` (the chips) become
// binding segments. Anything else (stray <br>, etc.) is ignored.
export function serializeNodes(root: HTMLElement): UISegment[] {
  const out: UISegment[] = [];
  root.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push({ kind: SegmentKind.LITERAL, value: node.textContent ?? '' });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const variable = (node as HTMLElement).dataset?.variable;
      // Treat data-variable as untrusted: a foreign element (paste/drop/IME)
      // can carry an attacker-chosen value. Only accept it as a binding if it
      // matches the same identifier grammar the SDK enforces at commit time.
      // Reuses isValidIdentifier so read-time and write-time checks can't drift.
      // See docs/specs/ui-designer-mixed-content/security-review.md Medium #1.
      if (variable && isValidIdentifier(variable)) {
        out.push({ kind: SegmentKind.BINDING, value: variable });
      }
    }
  });
  return out;
}

// Merge adjacent literal segments and drop empty literals. Binding segments are
// preserved in order. May return an empty array (a fully-empty field).
export function normalizeSegments(segments: UISegment[]): UISegment[] {
  const out: UISegment[] = [];
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

// Decide which of the three storage states a normalized list maps to.
// 0 -> empty literal; 1 literal -> literal; 1 binding -> single-bind;
// otherwise -> mixed. This is what makes single<->mixed transitions lazy.
export function routeStorage(normalized: UISegment[]): StoragePlan {
  if (normalized.length === 0) return { mode: 'literal', text: '' };
  if (normalized.length === 1) {
    const only = normalized[0];
    return only.kind === SegmentKind.LITERAL
      ? { mode: 'literal', text: only.value }
      : { mode: 'single-bind', variable: only.value };
  }
  return { mode: 'mixed', segments: normalized };
}

// Seed the editor from current storage with the read precedence:
// existing mixed entry -> single whole-field binding -> static literal value.
export function seedSegments(
  rawValue: unknown,
  mixed: UISegment[] | undefined,
  boundVariable: string | undefined,
): UISegment[] {
  if (mixed && mixed.length > 0) return mixed;
  if (boundVariable) return [{ kind: SegmentKind.BINDING, value: boundVariable }];
  const text = typeof rawValue === 'string' ? rawValue : '';
  return text ? [{ kind: SegmentKind.LITERAL, value: text }] : [];
}
