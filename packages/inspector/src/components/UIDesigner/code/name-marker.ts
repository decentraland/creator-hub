/** The `@ui-name` marker carries a node's user-facing name as a comment inside the element's opening tag. */

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

/** Strip what would break out of the comment (`*`, `/`) and flatten whitespace; '' means no usable name. */
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

/** Edits to make `name` the node's marker — inserting, replacing, or (for an empty name) removing it; idempotent. */
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

/** Give every marker in a verbatim copy of a subtree a free name, so duplicating a node can't produce colliding names. */
export function renumberNodeNames(raw: string, taken: readonly string[]): string {
  const names = [...taken];
  return raw.replace(MARKER_RE_ALL, (_whole, current: string) => {
    const name = sanitizeNodeName(current);
    const next = uniqueName(name.replace(/\d+$/, '') || name, names);
    names.push(next);
    return nameMarkerText(next);
  });
}
