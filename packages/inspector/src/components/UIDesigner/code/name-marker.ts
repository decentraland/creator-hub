/**
 * The `@ui-name` marker carries a node's user-facing NAME. It lives as a comment
 * inside the element's opening tag because no attribute is type-legal: react-ecs'
 * `EntityPropTypes` exposes only uiTransform/uiBackground/key and the listeners,
 * so `name="X"` would stop the scene compiling — and `key` is off limits (a
 * changed key unmounts the fiber and recursively destroys the entity subtree).
 * Inside the opening tag it also travels with the element through `moveElement`,
 * which cuts the element verbatim by span.
 *
 * Dependency-free (pure spans + strings) so it is trivially unit-testable and
 * shared by the parse and emit halves. Same ceiling as component-marker: the
 * match is anchored to the comment form, so only a string literal that itself
 * contains both delimiters could false-match.
 */

import type { Edit } from './emit-adapter';
import { uniqueName } from './root-naming';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

const MARKER_RE = /\/\*\s*@ui-name\s+([^*]*?)\s*\*\//;
const MARKER_RE_ALL = new RegExp(MARKER_RE.source, 'g');

/**
 * Strip what would break out of the comment (`*`, `/`) and flatten whitespace.
 * Returns '' when nothing usable is left, which callers read as "no name".
 */
export function sanitizeNodeName(input: string): string {
  return (input || '')
    .replace(/[*/\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** The marker's source text — the one place its format is spelled out. */
export function nameMarkerText(name: string): string {
  return `/* @ui-name ${sanitizeNodeName(name)} */`;
}

function openingOf(el: AstNode): AstNode {
  return (el.openingElement as AstNode | undefined) ?? el;
}

/** The node's `@ui-name`, or undefined when it carries no marker. */
export function readNodeName(source: string, el: AstNode): string | undefined {
  const open = openingOf(el);
  const found = MARKER_RE.exec(source.slice(open.start, open.end));
  const name = found ? sanitizeNodeName(found[1]) : '';
  return name || undefined;
}

/**
 * Edits to make `name` the node's marker — inserting, replacing, or (for an
 * empty name) removing it. Idempotent: [] when already in that state.
 *
 * Removal absorbs the whitespace on BOTH sides into a single separator, so the
 * tag returns to its unnamed form whatever spacing it was authored with —
 * deleting only the comment's own span would leave `<X  y>` or, for a marker
 * authored without a leading space, splice the tag name into the next attribute.
 */
export function nodeNameEdit(el: AstNode, source: string, name: string): Edit[] {
  const open = openingOf(el);
  const text = source.slice(open.start, open.end);
  const found = MARKER_RE.exec(text);
  const next = sanitizeNodeName(name);

  if (!found) {
    if (!next) return [];
    const at = open.name.end as number;
    return [{ start: at, end: at, text: ` ${nameMarkerText(next)}` }];
  }
  if (sanitizeNodeName(found[1]) === next) return [];

  const from = found.index;
  const to = from + found[0].length;
  if (next) return [{ start: open.start + from, end: open.start + to, text: nameMarkerText(next) }];

  const before = /\s*$/.exec(text.slice(0, from))![0].length;
  const after = /^\s*/.exec(text.slice(to))![0].length;
  return [{ start: open.start + from - before, end: open.start + to + after, text: ' ' }];
}

/** Seed a freshly generated element's JSX with `name`'s marker. */
export function withNodeName(jsx: string, name: string): string {
  return jsx.replace(/^<\w+/, tag => `${tag} ${nameMarkerText(name)}`);
}

/**
 * Give every marker in a verbatim copy of a subtree a free name, so duplicating
 * a node can't produce colliding names. Trailing digits are treated as the
 * suffix, so a copy of `Panel1` is `Panel2` rather than `Panel11`.
 */
export function renumberNodeNames(raw: string, taken: readonly string[]): string {
  const names = [...taken];
  return raw.replace(MARKER_RE_ALL, (_whole, current: string) => {
    const name = sanitizeNodeName(current);
    const next = uniqueName(name.replace(/\d+$/, '') || name, names);
    names.push(next);
    return nameMarkerText(next);
  });
}
