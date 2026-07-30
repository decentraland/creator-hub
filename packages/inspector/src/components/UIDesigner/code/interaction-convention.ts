// The interaction-state styling convention — the CSS-pseudo-state analog for
// react-ecs, which has NO native hover/press styling (it exposes only the four
// raw pointer callbacks). The editor authors and reads this exact shape:
//
//   const btn = useInteraction(
//     {
//       base:   { uiBackground: { color: WHITE } },
//       hover:  { uiBackground: { color: BLUE } },
//       press:  { uiBackground: { color: GREEN } },
//       active: { uiBackground: { color: RED } },
//     },
//     state.selected,
//   )
//   return <UiEntity {...btn} />
//
// Why a recognized helper instead of an inline ternary: a conditional inside
// `uiBackground`/`uiTransform` marks the node `dynamicProps` (parse-adapter),
// which is a hard write barrier — the panel could then edit NO prop on that
// node. Keeping every layer a static object literal behind a known call keeps
// the node first-class and fully splice-editable, and the transient
// hover/pressed flags stay encapsulated in the helper's own `useState` rather
// than polluting the shared `state` binding surface.
//
// This module locates and rewrites the construct; it deliberately does not
// EVALUATE the layer objects — parse-adapter owns static evaluation (it already
// has evalExpr) and feeds the values into the node. Dependency-free apart from
// the emit-adapter Edit builders, so it unit-tests in isolation.

import {
  type Edit,
  ensureNamedImport,
  insertStatementBeforeReturn,
  removeObjectProperty,
  setFieldsInObject,
  setObjectProperty,
} from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

const INTERACTION_HELPER = 'useInteraction';

// Layer order is precedence order: later layers win. `base` is the node's normal
// resting style (so a node with interaction states keeps ONE home for its
// styles); `active` is driven by an app-state boolean (a selected tab, a checked
// toggle) rather than by the pointer.
export const INTERACTION_STATES = ['base', 'hover', 'press', 'active'] as const;
export type InteractionStateKey = (typeof INTERACTION_STATES)[number];

const STATE_SET = new Set<string>(INTERACTION_STATES);

function isInteractionStateKey(k: string): k is InteractionStateKey {
  return STATE_SET.has(k);
}

interface InteractionStateAst {
  // The `hover: { … }` Property node in the layers map.
  prop: AstNode;
  // Its ObjectExpression value — the splice target for that layer's styles.
  object: AstNode;
}

export interface InteractionAst {
  // The `useInteraction(…)` CallExpression.
  call: AstNode;
  // First argument: the layers map ObjectExpression.
  map: AstNode;
  // Second argument (optional): the expression driving the `active` layer.
  activeArg?: AstNode;
  states: Map<InteractionStateKey, InteractionStateAst>;
  // The `const <name> = useInteraction(…)` declarator, when the (canonical)
  // const form is used rather than an inline spread of the call.
  declarator?: AstNode;
  // The enclosing VariableDeclaration statement — the span to delete when
  // unwrapping a node back to plain attributes.
  declaration?: AstNode;
  name?: string;
}

function unparen(node: AstNode): AstNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression as AstNode;
  return n;
}

function keyNameOf(prop: AstNode): string | null {
  const key = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
  return key == null ? null : String(key);
}

// Parse a `useInteraction(layers, active?)` call. Returns null for anything
// else, and for a call whose first argument isn't a plain object literal (a
// computed layers map isn't editable — the node falls back to opaque/read-only
// rather than being silently half-owned by the editor).
export function parseInteractionCall(node: AstNode | undefined): InteractionAst | null {
  if (!node) return null;
  const call = unparen(node);
  if (call.type !== 'CallExpression') return null;
  if (call.callee?.type !== 'Identifier' || call.callee.name !== INTERACTION_HELPER) return null;

  const args = (call.arguments ?? []) as AstNode[];
  const map = args[0] ? unparen(args[0]) : undefined;
  if (!map || map.type !== 'ObjectExpression') return null;

  const states = new Map<InteractionStateKey, InteractionStateAst>();
  for (const prop of (map.properties ?? []) as AstNode[]) {
    if (prop.type !== 'Property' || prop.computed) continue;
    const key = keyNameOf(prop);
    if (!key || !isInteractionStateKey(key)) continue;
    const object = unparen(prop.value as AstNode);
    if (object.type !== 'ObjectExpression') continue;
    states.set(key, { prop, object });
  }

  return { call, map, activeArg: args[1] ? unparen(args[1]) : undefined, states };
}

// Statements of a component function's block body (or [] for a concise arrow).
function bodyStatements(fnNode: AstNode | null | undefined): AstNode[] {
  const body = fnNode?.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  return (body.body ?? []) as AstNode[];
}

// Resolve a `{...x}` spread on a JSX element to its backing interaction call.
// Handles both the canonical const form (`const btn = useInteraction(…)` then
// `{...btn}`) and an inline spread of the call itself (`{...useInteraction(…)}`).
// Returns null when the spread isn't an interaction — the caller then treats the
// element as opaque, exactly as before this convention existed.
export function findInteractionForSpread(
  spreadArgument: AstNode | null | undefined,
  fnNode: AstNode | null | undefined,
): InteractionAst | null {
  if (!spreadArgument) return null;
  const arg = unparen(spreadArgument);

  const inline = parseInteractionCall(arg);
  if (inline) return inline;

  if (arg.type !== 'Identifier') return null;
  const name = arg.name as string;
  for (const stmt of bodyStatements(fnNode)) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const d of (stmt.declarations ?? []) as AstNode[]) {
      if (d.id?.type !== 'Identifier' || d.id.name !== name) continue;
      const parsed = parseInteractionCall(d.init as AstNode | undefined);
      if (parsed) return { ...parsed, declarator: d, declaration: stmt, name };
    }
  }
  return null;
}

// The single `{...x}` spread ATTRIBUTE on an element, when it has exactly one and
// no other spread. Multiple spreads stay unrepresentable (opaque). Callers that
// unwrap the node need the attribute's own span, not just its argument.
function soleSpreadAttribute(el: AstNode): AstNode | undefined {
  const spreads = ((el.openingElement?.attributes ?? []) as AstNode[]).filter(
    a => a.type === 'JSXSpreadAttribute',
  );
  return spreads.length === 1 ? spreads[0] : undefined;
}

export function soleSpreadArgument(el: AstNode): AstNode | undefined {
  return soleSpreadAttribute(el)?.argument as AstNode | undefined;
}

// ---------------------------------------------------------------------------
// Write side — Edit builders. Every one is surgical: it splices the smallest
// span that expresses the change, so sibling layers and any hand-authored
// fields the editor doesn't model survive byte-for-byte.
// ---------------------------------------------------------------------------

// Patch fields of a NESTED prop bag in one layer, e.g.
// `setInteractionNested(ast, 'hover', 'uiBackground', { color })`. Creates the
// layer and/or the bag when absent.
export function setInteractionNested(
  ast: InteractionAst,
  stateKey: InteractionStateKey,
  propName: string,
  fields: Record<string, unknown>,
): Edit[] {
  const state = ast.states.get(stateKey);
  if (state) return setObjectProperty(state.object, propName, fields);
  const setEntries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (setEntries.length === 0) return [];
  return setFieldsInObject(ast.map, {
    [stateKey]: { [propName]: Object.fromEntries(setEntries) },
  });
}

// Patch FLAT fields of one layer — the top-level element props (a Label's
// `value`/`fontSize`/`color`, an Input's `placeholder`, …) which live directly in
// the layer bag rather than inside `uiTransform`/`uiBackground`.
export function setInteractionFlat(
  ast: InteractionAst,
  stateKey: InteractionStateKey,
  fields: Record<string, unknown>,
): Edit[] {
  const state = ast.states.get(stateKey);
  if (state) return setFieldsInObject(state.object, fields);
  const setEntries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (setEntries.length === 0) return [];
  return setFieldsInObject(ast.map, { [stateKey]: Object.fromEntries(setEntries) });
}

// Add an empty layer (the panel's "add Hover state"). No-op when it exists.
export function addInteractionState(ast: InteractionAst, stateKey: InteractionStateKey): Edit[] {
  if (ast.states.has(stateKey)) return [];
  return setFieldsInObject(ast.map, { [stateKey]: {} });
}

// Drop a whole layer (the panel's "remove Hover state").
export function removeInteractionState(ast: InteractionAst, stateKey: InteractionStateKey): Edit[] {
  if (!ast.states.has(stateKey)) return [];
  return removeObjectProperty(ast.map, stateKey);
}

// Set or clear the expression driving the `active` layer. Clearing removes the
// second argument entirely (rather than passing an explicit `false`) so the
// call reads the way a hand-author would write it.
export function setInteractionActive(ast: InteractionAst, expr: string | undefined): Edit[] {
  if (expr === undefined) {
    if (!ast.activeArg) return [];
    return [{ start: ast.map.end, end: ast.activeArg.end, text: '' }];
  }
  if (ast.activeArg) {
    return [{ start: ast.activeArg.start, end: ast.activeArg.end, text: expr }];
  }
  return [{ start: ast.map.end, end: ast.map.end, text: `, ${expr}` }];
}

// Source text of the `const <name> = useInteraction({ base: … })` statement that
// converts a plain element into an interactive one. `baseBody` is the serialized
// body of the base layer (already-emitted source text, e.g.
// `uiBackground: { color: … }`) so the caller controls exactly how the node's
// current props carry over.
export function interactionStatement(name: string, baseBody: string): string {
  const base = baseBody.trim() ? `{ ${baseBody} }` : '{}';
  return `const ${name} = ${INTERACTION_HELPER}({ base: ${base} })`;
}

// An attribute's value rendered as an object-property value. A bare attr
// (`disabled`) is `true`. A JSX string literal is re-serialized from its PARSED
// value, NOT sliced: JSX attribute strings do not process escapes (`"a\nb"` is a
// literal backslash-n there), so slicing it into a JS object literal would
// silently change its meaning.
function attrValueSource(attr: AstNode, source: string): string {
  const v = attr.value as AstNode | null;
  if (v == null) return 'true';
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression as AstNode;
    return source.slice(e.start, e.end);
  }
  if (v.type === 'Literal') return JSON.stringify(v.value);
  return source.slice(v.start, v.end);
}

// Convert a plain element into an interactive one. Its modeled style/event
// attributes move VERBATIM into the `base` layer — no PB round-trip, so nothing
// is lossily re-serialized — and the element gains `{...name}` as its FIRST
// attribute, so any attribute left behind still overrides the layer (matching
// JSX precedence). `isLayerable` is injected rather than imported to keep this
// module free of a parse-adapter cycle.
//
// Edit-overlap contract: the statement insert lands before the return (outside
// the element), the spread insert is zero-width at the tag name, and attribute
// removals use EXACT spans — absorbing the usual leading space would collide
// with the spread insert and make applyEdits throw. The formatter tidies gaps.
export function wrapInInteractionEdits(args: {
  program: { body?: AstNode[] };
  fnNode: AstNode;
  el: AstNode;
  source: string;
  name: string;
  importFrom: string;
  isLayerable: (attrName: string) => boolean;
}): Edit[] {
  const { program, fnNode, el, source, name, importFrom, isLayerable } = args;
  const moved: AstNode[] = [];
  const parts: string[] = [];
  for (const attr of (el.openingElement?.attributes ?? []) as AstNode[]) {
    if (attr.type !== 'JSXAttribute' || attr.name?.type !== 'JSXIdentifier') continue;
    const attrName = String(attr.name.name);
    if (!isLayerable(attrName)) continue;
    parts.push(`${attrName}: ${attrValueSource(attr, source)}`);
    moved.push(attr);
  }

  const at = el.openingElement.name.end as number;
  return [
    ...ensureNamedImport(program, INTERACTION_HELPER, importFrom),
    ...insertStatementBeforeReturn(fnNode, source, interactionStatement(name, parts.join(', '))),
    { start: at, end: at, text: ` {...${name}}` },
    ...moved.map(a => ({ start: a.start, end: a.end, text: '' })),
  ];
}

// Unwrap back to a plain element: the `base` layer's props return as JSX
// attributes and the call + spread are deleted. Overrides (hover/press/active)
// are intentionally dropped — that IS "remove interaction states".
export function unwrapInteractionEdits(ast: InteractionAst, el: AstNode, source: string): Edit[] {
  const spread = soleSpreadAttribute(el);
  if (!spread) return [];

  const base = ast.states.get('base');
  const attrs = ((base?.object.properties ?? []) as AstNode[])
    .filter(p => p.type === 'Property' && !p.computed)
    .map(p => {
      const key = keyNameOf(p);
      const value = p.value as AstNode;
      return `${key}={${source.slice(value.start, value.end)}}`;
    });

  const edits: Edit[] = [{ start: spread.start, end: spread.end, text: attrs.join(' ') }];
  // Only the const form has a statement to remove; an inline spread's call dies
  // with the attribute above.
  if (ast.declaration) {
    edits.push({ start: ast.declaration.start, end: ast.declaration.end, text: '' });
  }
  return edits;
}
