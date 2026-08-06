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

// A pre-serialized source fragment. serializeValue emits its text VERBATIM
// instead of quoting it, so an object-literal field can hold a raw expression —
// a variable binding (`state.score`), an event thunk, a template literal — the
// same things a JSX attribute expresses with `attr={…}`.
export class RawExpr {
  constructor(readonly text: string) {}
}

export const raw = (text: string): RawExpr => new RawExpr(text);

// Serialize a JS value to its TSX source form. Plain objects emit as react-ecs
// style object literals (`{ top: 0, left: 0 }`, unquoted keys) rather than JSON
// so spliced values match hand-authored code.
function serializeValue(v: unknown): string {
  if (v instanceof RawExpr) return v.text;
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
      v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof RawExpr)
        ? emitObject(v as Record<string, unknown>)
        : serializeValue(v);
    return `${k}: ${val}`;
  });
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

// Set a single field inside an object-literal prop (e.g. uiTransform.width).
export function setObjectField(
  el: AstNode,
  attrName: string,
  fieldName: string,
  value: unknown,
): Edit[] {
  return setObjectFields(el, attrName, { [fieldName]: value });
}

// Set MULTIPLE fields inside an object-literal prop in one AST pass. A single
// call composes correctly where repeated setObjectField calls against the same
// (stale) AST would not: two "attribute absent" inserts would emit a duplicate
// attribute (one field silently lost), and two "empty object" splices would
// emit adjacent fields with no separating comma (refused edit). Handles all
// four container cases: attribute absent (add it), non-object value (own it),
// field exists (replace its value span), field missing (insert). A field whose
// value is `undefined` is REMOVED from the object (used when a panel edit
// unsets a value, e.g. switching back to in-flow clears position edges).
export function setObjectFields(
  el: AstNode,
  attrName: string,
  fields: Record<string, unknown>,
): Edit[] {
  const setEntries = Object.entries(fields).filter(([, v]) => v !== undefined);
  const attr = findAttr(el, attrName);

  // Attribute absent → add `attrName={{ a: 1, b: 2 }}` after the tag name.
  if (!attr) {
    if (setEntries.length === 0) return [];
    const at = el.openingElement.name.end;
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [{ start: at, end: at, text: ` ${attrName}={{ ${body} }}` }];
  }

  const container = attr.value;
  // Attribute value isn't a `{ ... }` expression container → own it.
  if (!container || container.type !== 'JSXExpressionContainer') {
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [{ start: attr.start, end: attr.end, text: `${attrName}={{ ${body} }}` }];
  }

  const obj = unparen(container.expression);
  // Expression isn't an object literal (dynamic) → replace it with one.
  // (Callers guard dynamic nodes before getting here; this is the last resort.)
  if (obj.type !== 'ObjectExpression') {
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [
      { start: container.expression.start, end: container.expression.end, text: `{ ${body} }` },
    ];
  }

  return setFieldsInObject(obj, fields);
}

const fieldText = (k: string, v: unknown) => `${k}: ${serializeValue(v)}`;

// Set fields directly inside an ObjectExpression. Shared core of
// setObjectFields (JSX-attribute container) and setObjectProperty (nested
// object-literal container) — the four container cases differ per caller, but
// the property-level insert/replace/remove bookkeeping below is identical.
export function setFieldsInObject(obj: AstNode, fields: Record<string, unknown>): Edit[] {
  const entries = Object.entries(fields);
  const props = (obj.properties ?? []) as AstNode[];
  const propFor = (name: string): AstNode | undefined =>
    props.find(p => p.type === 'Property' && !p.computed && keyName(p.key) === name);

  const edits: Edit[] = [];
  const toInsert: string[] = [];
  const removeIdx = new Set<number>();
  for (const [k, v] of entries) {
    const prop = propFor(k);
    if (v === undefined) {
      if (prop) removeIdx.add(props.indexOf(prop));
      continue;
    }
    if (prop) {
      // Field exists → replace just its value span (the tight, common case).
      edits.push({ start: prop.value.start, end: prop.value.end, text: serializeValue(v) });
    } else {
      toInsert.push(fieldText(k, v));
    }
  }
  // Removals: coalesce maximal runs of adjacent removed properties into one
  // edit each so the separating commas are absorbed without overlap.
  for (let i = 0; i < props.length; i++) {
    if (!removeIdx.has(i)) continue;
    let j = i;
    while (j + 1 < props.length && removeIdx.has(j + 1)) j++;
    if (j + 1 < props.length)
      edits.push({ start: props[i].start, end: props[j + 1].start, text: '' });
    else if (i > 0) edits.push({ start: props[i - 1].end, end: props[j].end, text: '' });
    else edits.push({ start: obj.start + 1, end: obj.end - 1, text: '' });
    i = j;
  }
  if (toInsert.length > 0) {
    // Anchor the insert after the last SURVIVING property so it can't land
    // inside a removal span.
    let anchor = -1;
    for (let i = props.length - 1; i >= 0; i--) {
      if (!removeIdx.has(i)) {
        anchor = i;
        break;
      }
    }
    if (anchor >= 0) {
      edits.push({
        start: props[anchor].end,
        end: props[anchor].end,
        text: `, ${toInsert.join(', ')}`,
      });
    } else if (props.length > 0) {
      // Everything removed → the removal edit already cleared the interior;
      // re-insert inside the braces just before the closing one.
      edits.push({ start: obj.end - 1, end: obj.end - 1, text: ` ${toInsert.join(', ')} ` });
    } else {
      // Empty object literal `{}`.
      edits.push({ start: obj.start + 1, end: obj.end - 1, text: ` ${toInsert.join(', ')} ` });
    }
  }
  return edits;
}

function propertyNamed(obj: AstNode, name: string): AstNode | undefined {
  return ((obj.properties ?? []) as AstNode[]).find(
    p => p.type === 'Property' && !p.computed && keyName(p.key) === name,
  );
}

// Partially patch a NESTED object-literal property: `setObjectProperty(stateObj,
// 'uiBackground', { color })` touches only `color`, leaving sibling fields
// (`texture`, `textureMode`, …) byte-for-byte. The object-literal analog of
// setObjectFields — used for prop bags that live inside an object (an
// interaction state's styles) rather than on a JSX attribute.
export function setObjectProperty(
  obj: AstNode,
  propName: string,
  fields: Record<string, unknown>,
): Edit[] {
  const setEntries = Object.entries(fields).filter(([, v]) => v !== undefined);
  const prop = propertyNamed(obj, propName);

  // Property absent → insert it whole; serializeValue/emitObject recurse, so the
  // nested bag serializes as `propName: { a: 1, b: { … } }`.
  if (!prop) {
    if (setEntries.length === 0) return [];
    return setFieldsInObject(obj, { [propName]: Object.fromEntries(setEntries) });
  }

  const value = unparen(prop.value as AstNode);
  if (value.type !== 'ObjectExpression') {
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [{ start: value.start, end: value.end, text: `{ ${body} }` }];
  }
  return setFieldsInObject(value, fields);
}

// Remove one whole property from an object literal, absorbing an adjacent
// delimiter so no dangling comma is left. Mirrors state-convention's
// list-element removal. No-op when the property is absent.
export function removeObjectProperty(obj: AstNode, propName: string): Edit[] {
  const props = (obj.properties ?? []) as AstNode[];
  const i = props.findIndex(
    p => p.type === 'Property' && !p.computed && keyName(p.key) === propName,
  );
  if (i < 0) return [];
  if (props.length === 1) return [{ start: obj.start + 1, end: obj.end - 1, text: '' }];
  if (i > 0) return [{ start: props[i - 1].end, end: props[i].end, text: '' }];
  return [{ start: props[i].start, end: props[i + 1].start, text: '' }];
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
    if (t.value !== undefined) props.push(jsxStringAttr('value', String(t.value)));
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

// Insert a NEW element as a sibling of `targetEl`, before or after it, matching
// the target's indentation. Used by the tree's drop-at-position (a palette widget
// dropped in the top/bottom third of a row lands before/after that sibling).
export function insertSibling(
  targetEl: AstNode,
  source: string,
  childJsx: string,
  position: 'before' | 'after',
): Edit[] {
  const indent = lineIndent(source, targetEl.start);
  if (position === 'before') {
    return [{ start: targetEl.start, end: targetEl.start, text: `${childJsx}\n${indent}` }];
  }
  return [{ start: targetEl.end, end: targetEl.end, text: `\n${indent}${childJsx}` }];
}

// Set (or insert) the JSX a component returns — places the FIRST element into an
// empty root. Handles `return <existing/>` (replace the argument), `return` /
// `return;` (insert the argument after the keyword), and a body with no return
// at all (insert one before the closing brace). `fnNode` is the component
// function node (parse-adapter.findComponentFn); its `.body` must be a block.
export function setReturnJsx(fnNode: AstNode, source: string, childJsx: string): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  const stmts = (body.body ?? []) as AstNode[];
  const ret = stmts.find(s => s.type === 'ReturnStatement');
  const indent = lineIndent(source, (ret ?? body).start);
  const wrapped = `(\n${indent}  ${childJsx}\n${indent})`;
  if (ret) {
    const arg = ret.argument as AstNode | undefined;
    if (arg) return [{ start: arg.start, end: arg.end, text: wrapped }];
    // Bare `return` / `return;` — insert the argument right after the keyword.
    const at = source.indexOf('return', ret.start) + 'return'.length;
    return [{ start: at, end: at, text: ` ${wrapped}` }];
  }
  // No return statement — insert one just before the block's closing brace.
  const at = body.end - 1;
  return [{ start: at, end: at, text: `${indent}  return ${wrapped}\n${indent}` }];
}

// Inverse of setReturnJsx: strip the returned argument so the component keeps a
// bare `return` — the canonical empty-root shape (generateRootComponent), which
// loadAndParse recognizes as a valid empty GUI. Deleting only the element's own
// span (removeNode) would leave `return ()`, a syntax error, so the whole
// return statement is replaced. Empty when nothing is returned, or when the
// body isn't a block (a concise arrow has no `return` to keep).
export function removeReturnJsx(fnNode: AstNode): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  const stmts = (body.body ?? []) as AstNode[];
  const ret = stmts.find(s => s.type === 'ReturnStatement');
  if (!ret || !ret.argument) return [];
  return [{ start: ret.start, end: ret.end, text: 'return' }];
}

// Insert a statement into a component's body, just before its `return`. Used to
// place a `const x = useInteraction({…})` declaration where the returned JSX can
// reference it. Concise-body arrows (`() => <jsx/>`) have no block to splice
// into, so the caller must convert them first (see toBlockBody); this returns []
// for them rather than emitting an unparseable edit.
export function insertStatementBeforeReturn(
  fnNode: AstNode,
  source: string,
  statement: string,
): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  const stmts = (body.body ?? []) as AstNode[];
  const ret = stmts.find(s => s.type === 'ReturnStatement');
  const at = ret ? ret.start : body.end - 1;
  const indent = lineIndent(source, at);
  return [{ start: at, end: at, text: `${statement}\n${indent}` }];
}

// Convert a concise-body arrow (`() => <jsx/>` / `() => (<jsx/>)`) into a block
// body (`() => { return <jsx/> }`) so statements can be inserted before the
// return. Empty when the body is already a block.
export function toBlockBody(fnNode: AstNode, source: string): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type === 'BlockStatement') return [];
  const indent = lineIndent(source, fnNode.start);
  const raw = source.slice(body.start, body.end);
  return [
    {
      start: body.start,
      end: body.end,
      text: `{\n${indent}  return ${raw}\n${indent}}`,
    },
  ];
}

// A JSX plain attribute string (`value="…"`) does NOT process escape
// sequences — the literal runs to the next quote, so a `"` in the value emits
// invalid JSX ("Unterminated string") and a `\n` reads back as a literal
// backslash-n. Only the escape-free case is safe as a plain attribute; any
// value needing escapes is emitted as a JS string literal inside braces
// (`value={"…"}`), where escapes ARE processed.
function jsxStringAttr(name: string, value: string): string {
  const json = JSON.stringify(value);
  if (json === `"${value}"`) return `${name}=${json}`;
  return `${name}={${json}}`;
}

// Set or add a top-level JSX attribute — for element props that aren't nested
// in an object (e.g. a Label's `value` / `fontSize` / `color`). Escape-free
// strings use the `="..."` form (strings needing escapes use `={"..."}` — see
// jsxStringAttr); numbers/booleans/objects use `={...}`. Replaces the whole
// attribute when it already exists (robust to a form change).
export function setAttribute(el: AstNode, name: string, value: unknown): Edit[] {
  const attrText =
    typeof value === 'string'
      ? jsxStringAttr(name, value)
      : typeof value === 'number' || typeof value === 'boolean'
        ? `${name}={${String(value)}}`
        : `${name}={${serializeValue(value)}}`;

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

// Remove a top-level JSX attribute entirely (e.g. unbind a field back to
// unset). Absorbs one leading whitespace char so `<X a b />` → `<X b />` rather
// than leaving a double space. No-op when the attribute isn't present.
export function removeAttribute(el: AstNode, source: string, name: string): Edit[] {
  const attr = findAttr(el, name);
  if (!attr) return [];
  let start = attr.start;
  if (start > 0 && /\s/.test(source[start - 1])) start -= 1;
  return [{ start, end: attr.end, text: '' }];
}

// A whole patch of top-level attributes in one pass: an `undefined` value removes
// its attribute (a panel Remove / −), anything else writes or replaces it. One
// call per patch — separate passes against the same stale element would compute
// their insertion points from pre-edit offsets.
export function setAttributes(
  el: AstNode,
  source: string,
  fields: Record<string, unknown>,
): Edit[] {
  const edits: Edit[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) edits.push(...removeAttribute(el, source, name));
    else edits.push(...setAttribute(el, name, value));
  }
  return edits;
}

// Set a top-level attribute to a mixed-content template literal built from
// ordered segments (literal text + variable expressions), e.g.
// `value={`Score: ${state.score}`}`. An all-literal list collapses to a plain
// string attribute (`value="Score: 0"`); a single binding collapses to a bare
// expression (`value={state.score}`) — matching how a hand-author would write it.
export function setAttributeSegments(
  el: AstNode,
  name: string,
  segments: { kind: string; value: string }[],
): Edit[] {
  const hasBinding = segments.some(s => s.kind === 'binding');
  if (!hasBinding) {
    const text = segments.map(s => s.value).join('');
    return setAttribute(el, name, text);
  }
  if (segments.length === 1) {
    // Single binding → bare expression.
    return setAttributeExpr(el, name, segments[0].value);
  }
  return setAttributeExpr(el, name, templateLiteralText(segments));
}

// A template literal built from mixed-content segments. Backtick / `${` /
// backslash in literal parts are escaped so author text can't break out.
function templateLiteralText(segments: { kind: string; value: string }[]): string {
  const body = segments
    .map(s =>
      s.kind === 'binding'
        ? `\${${s.value}}`
        : s.value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'),
    )
    .join('');
  return `\`${body}\``;
}

// Mixed content as an object-literal FIELD value (rather than a JSX attribute):
// a quoted string when all-literal, a bare expression for a single binding, else
// a template literal. Used when the target prop lives in an interaction layer.
export function segmentsFieldValue(segments: { kind: string; value: string }[]): unknown {
  if (!segments.some(s => s.kind === 'binding')) return segments.map(s => s.value).join('');
  if (segments.length === 1) return raw(segments[0].value);
  return raw(templateLiteralText(segments));
}

// Remove an element (or opaque node) by deleting its exact span.
export function removeNode(el: AstNode): Edit[] {
  return [{ start: el.start, end: el.end, text: '' }];
}

// Remove several elements as ONE edit batch — multi-node removal must land in a
// single applyEdits pass, since a reparse between removals reassigns every
// positional id. JSX spans nest (never partially overlap), so a node lying
// inside an already-kept span is a descendant of another removed node: deleting
// the ancestor removes it, and keeping its edit would trip applyEdits'
// overlapping-edits guard.
export function removeNodes(els: AstNode[]): Edit[] {
  const sorted = [...els].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Edit[] = [];
  let coveredEnd = -1;
  for (const el of sorted) {
    if (el.start < coveredEnd) continue;
    out.push(...removeNode(el));
    coveredEnd = el.end;
  }
  return out;
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

// Ensure `import { name } from '<from>'` is present. Three cases: already
// imported → no-op; a named import from `<from>` exists → append `name` to it;
// otherwise → add a fresh import line after the existing imports. Used when
// nesting a component so the referenced root is in scope.
//
// A module can be imported by SEVERAL statements, so every one of them has to be
// considered: a generated root opens with a default-only
// `import ReactEcs from '@dcl/sdk/react-ecs'`, and judging that module by its
// first statement alone reports "no named group" forever — re-adding a name that
// is already in scope and emitting a duplicate binding (TS2300) on the second
// widget of a kind.
export function ensureNamedImport(
  program: { body?: AstNode[] },
  name: string,
  from: string,
): Edit[] {
  const namedGroups = ((program.body ?? []) as AstNode[])
    .filter(s => s.type === 'ImportDeclaration' && s.source?.value === from)
    .map(d => ((d.specifiers ?? []) as AstNode[]).filter(s => s.type === 'ImportSpecifier'));

  const isImported = namedGroups.some(specs =>
    specs.some(s => (s.imported?.name ?? s.local?.name) === name),
  );
  if (isImported) return [];

  const group = namedGroups.find(specs => specs.length > 0);
  if (group) {
    const last = group[group.length - 1];
    return [{ start: last.end, end: last.end, text: `, ${name}` }];
  }

  const at = afterImports(program);
  const line = `import { ${name} } from '${from}'`;
  return [{ start: at, end: at, text: at === 0 ? `${line}\n` : `\n${line}` }];
}
