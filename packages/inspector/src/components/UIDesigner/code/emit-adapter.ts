import type { CodeUINode } from './types';

// ---------------------------------------------------------------------------
// Emit adapter: turns a visual edit into the MINIMAL text change against the
// source buffer, located via the backing AST node's byte spans. We never
// reprint the file — only splice the exact region — so user formatting,
// comments, and unrepresentable code outside the edit are preserved verbatim.
// ---------------------------------------------------------------------------

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

// A minimal text replacement: replace source[start, end) with `text`.
export interface Edit {
  start: number;
  end: number;
  text: string;
}

// Apply edits to a source string. Edits must be non-overlapping; we apply them
// back-to-front so earlier offsets stay valid.
export function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  let prevStart = Infinity;
  for (const e of sorted) {
    if (e.end > prevStart) throw new Error('applyEdits: overlapping edits');
    if (e.start > e.end) throw new Error('applyEdits: inverted edit');
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    prevStart = e.start;
  }
  return out;
}

function unparen(node: AstNode): AstNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression;
  return n;
}

function keyName(key: AstNode): string {
  return key.type === 'Identifier' ? key.name : String(key.value);
}

function findAttr(el: AstNode, name: string): AstNode | undefined {
  return (el.openingElement?.attributes ?? []).find(
    (a: AstNode) => a.type === 'JSXAttribute' && a.name?.name === name,
  );
}

// Serialize a JS value to its TSX source form. Plain objects emit as react-ecs
// style object literals (`{ top: 0, left: 0 }`, unquoted keys) rather than JSON
// so spliced values match hand-authored code.
function serializeValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return emitObject(v as Record<string, unknown>);
  }
  return JSON.stringify(v);
}

// Serialize a plain object to an object-literal source form: { a: 1, b: "x" }.
function emitObject(o: Record<string, unknown>): string {
  const parts = Object.entries(o).map(([k, v]) => {
    const val =
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? emitObject(v as Record<string, unknown>)
        : serializeValue(v);
    return `${k}: ${val}`;
  });
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

// Set a single field inside an object-literal prop (e.g. uiTransform.width).
// Handles all four cases: field exists (replace value), field missing (insert
// into object), object empty, or the attribute/prop absent entirely (add it).
export function setObjectField(
  el: AstNode,
  attrName: string,
  fieldName: string,
  value: unknown,
): Edit[] {
  const literal = serializeValue(value);
  const attr = findAttr(el, attrName);

  // Attribute absent → add `attrName={{ fieldName: literal }}` after the tag name.
  if (!attr) {
    const at = el.openingElement.name.end;
    return [{ start: at, end: at, text: ` ${attrName}={{ ${fieldName}: ${literal} }}` }];
  }

  const container = attr.value;
  // Attribute value isn't a `{ ... }` expression container → own it.
  if (!container || container.type !== 'JSXExpressionContainer') {
    return [
      { start: attr.start, end: attr.end, text: `${attrName}={{ ${fieldName}: ${literal} }}` },
    ];
  }

  const obj = unparen(container.expression);
  // Expression isn't an object literal (dynamic) → replace it with one.
  if (obj.type !== 'ObjectExpression') {
    return [
      {
        start: container.expression.start,
        end: container.expression.end,
        text: `{ ${fieldName}: ${literal} }`,
      },
    ];
  }

  const prop = (obj.properties ?? []).find(
    (p: AstNode) => p.type === 'Property' && !p.computed && keyName(p.key) === fieldName,
  );
  // Field exists → replace just its value span (the tight, common case).
  if (prop) {
    return [{ start: prop.value.start, end: prop.value.end, text: literal }];
  }

  // Field missing → insert into the object.
  const props = (obj.properties ?? []) as AstNode[];
  if (props.length > 0) {
    const last = props[props.length - 1];
    return [{ start: last.end, end: last.end, text: `, ${fieldName}: ${literal}` }];
  }
  // Empty object literal `{}`.
  return [{ start: obj.start + 1, end: obj.end - 1, text: ` ${fieldName}: ${literal} ` }];
}

// Emit a new JSX element from a code-mode node (used when adding a child).
export function emitElement(
  node: Pick<CodeUINode, 'type' | 'uiTransform' | 'uiBackground' | 'uiText'>,
): string {
  const props: string[] = [];
  if (node.uiTransform)
    props.push(`uiTransform={${emitObject(node.uiTransform as Record<string, unknown>)}}`);
  if (node.uiBackground)
    props.push(`uiBackground={${emitObject(node.uiBackground as Record<string, unknown>)}}`);
  if (node.type === 'Label' && node.uiText) {
    const t = node.uiText as Record<string, unknown>;
    if (t.value !== undefined) props.push(`value=${serializeValue(t.value)}`);
    if (t.fontSize !== undefined) props.push(`fontSize={${serializeValue(t.fontSize)}}`);
  }
  return `<${node.type}${props.length ? ' ' + props.join(' ') : ''} />`;
}

// Whitespace at the start of the line containing `pos`.
function lineIndent(source: string, pos: number): string {
  const lineStart = source.lastIndexOf('\n', pos - 1) + 1;
  const m = source.slice(lineStart, pos).match(/^\s*/);
  return m ? m[0] : '';
}

// Insert a child JSX snippet into a parent element. If the parent has a closing
// tag we insert before it (matching its indentation); if it's self-closing we
// convert `<X ... />` into `<X ...>child</X>`.
export function insertChild(parentEl: AstNode, source: string, childJsx: string): Edit[] {
  const closing = parentEl.closingElement as AstNode | undefined;
  if (closing) {
    const at = closing.start;
    const indent = lineIndent(source, at);
    return [{ start: at, end: at, text: `${childJsx}\n${indent}` }];
  }
  // Self-closing → convert. Replace the trailing `/>` with `>child</Tag>`.
  const open = parentEl.openingElement as AstNode;
  const tag = open.name?.name ?? 'UiEntity';
  const slashGt = source.lastIndexOf('/>', open.end);
  const at = slashGt >= 0 ? slashGt : open.end - 2;
  return [{ start: at, end: open.end, text: `>\n  ${childJsx}\n</${tag}>` }];
}

// Set or add a top-level JSX attribute — for element props that aren't nested
// in an object (e.g. a Label's `value` / `fontSize` / `color`). Strings use the
// `="..."` form; numbers/booleans/objects use `={...}`. Replaces the whole
// attribute when it already exists (robust to a form change).
export function setAttribute(el: AstNode, name: string, value: unknown): Edit[] {
  const isString = typeof value === 'string';
  const inner = isString
    ? JSON.stringify(value)
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : emitObject(value as Record<string, unknown>);
  const attrText = isString ? `${name}=${inner}` : `${name}={${inner}}`;

  const attr = findAttr(el, name);
  if (!attr) {
    const at = el.openingElement.name.end;
    return [{ start: at, end: at, text: ` ${attrText}` }];
  }
  return [{ start: attr.start, end: attr.end, text: attrText }];
}

// Set a top-level attribute to a raw JS expression (a binding), e.g.
// `value={score}` or `onMouseDown={onClick}`. Unlike setAttribute, `expr` is
// emitted verbatim inside the braces (not quoted/serialized).
export function setAttributeExpr(el: AstNode, name: string, expr: string): Edit[] {
  const attrText = `${name}={${expr}}`;
  const attr = findAttr(el, name);
  if (!attr) {
    const at = el.openingElement.name.end;
    return [{ start: at, end: at, text: ` ${attrText}` }];
  }
  return [{ start: attr.start, end: attr.end, text: attrText }];
}

// Remove an element (or opaque node) by deleting its exact span.
export function removeNode(el: AstNode): Edit[] {
  return [{ start: el.start, end: el.end, text: '' }];
}

// Move an element's exact source to a new location: delete it from its current
// span and re-insert it verbatim at `insertAt` (the code equivalent of a
// sibling reorder). The two edits are non-overlapping as long as `insertAt` lies
// outside the element's own span (guaranteed for reorder to a sibling). A
// separating newline keeps the result parseable; exact indentation is left to a
// formatter.
export function moveElement(source: string, el: AstNode, insertAt: number): Edit[] {
  const raw = source.slice(el.start, el.end);
  // Inserting after the element's old position → lead with a newline; before → trail.
  const text = insertAt >= el.end ? `\n${raw}` : `${raw}\n`;
  return [
    { start: el.start, end: el.end, text: '' },
    { start: insertAt, end: insertAt, text },
  ];
}

// Offset just after the last import declaration (or 0) — insertion point for a
// new top-level declaration such as a `/** @ui-bind */` variable.
export function afterImports(program: { body?: AstNode[] }): number {
  let at = 0;
  for (const stmt of program.body ?? []) {
    if (stmt.type === 'ImportDeclaration') at = stmt.end;
    else break;
  }
  return at;
}
