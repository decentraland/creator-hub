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

/** Interaction layers in precedence order (later wins); `active` is app-state-driven. */
export const INTERACTION_STATES = ['base', 'hover', 'press', 'active'] as const;
export type InteractionStateKey = (typeof INTERACTION_STATES)[number];

const STATE_SET = new Set<string>(INTERACTION_STATES);

function isInteractionStateKey(k: string): k is InteractionStateKey {
  return STATE_SET.has(k);
}

interface InteractionStateAst {
  prop: AstNode;
  object: AstNode;
}

export interface InteractionAst {
  call: AstNode;
  map: AstNode;
  activeArg?: AstNode;
  states: Map<InteractionStateKey, InteractionStateAst>;
  declarator?: AstNode;
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

/** Parse a `useInteraction(layers, active?)` call; null when it isn't one or its layers map isn't a plain object literal. */
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

function bodyStatements(fnNode: AstNode | null | undefined): AstNode[] {
  const body = fnNode?.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  return (body.body ?? []) as AstNode[];
}

/** Resolve a `{...x}` spread on a JSX element to its backing interaction call (const or inline form), or null. */
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

function soleSpreadAttribute(el: AstNode): AstNode | undefined {
  const spreads = ((el.openingElement?.attributes ?? []) as AstNode[]).filter(
    a => a.type === 'JSXSpreadAttribute',
  );
  return spreads.length === 1 ? spreads[0] : undefined;
}

export function soleSpreadArgument(el: AstNode): AstNode | undefined {
  return soleSpreadAttribute(el)?.argument as AstNode | undefined;
}

/** Patch fields of a nested prop bag in one layer, creating the layer and/or bag when absent. */
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

/** Patch flat top-level element props of one layer (those living directly in the layer bag). */
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

/** Add an empty layer; no-op when it exists. */
export function addInteractionState(ast: InteractionAst, stateKey: InteractionStateKey): Edit[] {
  if (ast.states.has(stateKey)) return [];
  return setFieldsInObject(ast.map, { [stateKey]: {} });
}

/** Drop a whole layer. */
export function removeInteractionState(ast: InteractionAst, stateKey: InteractionStateKey): Edit[] {
  if (!ast.states.has(stateKey)) return [];
  return removeObjectProperty(ast.map, stateKey);
}

/** Set or clear the expression driving the `active` layer; clearing removes the second argument. */
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

/** Source text of the `const <name> = useInteraction({ base: … })` statement, with `baseBody` as the base layer's serialized body. */
export function interactionStatement(name: string, baseBody: string): string {
  const base = baseBody.trim() ? `{ ${baseBody} }` : '{}';
  return `const ${name} = ${INTERACTION_HELPER}({ base: ${base} })`;
}

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

/** Convert a plain element into an interactive one: its modeled attributes move verbatim into the `base` layer and it gains `{...name}` as its first attribute. */
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

/** Unwrap back to a plain element: the `base` layer's props return as JSX attributes and the call + spread are deleted (overrides dropped). */
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
  if (ast.declaration) {
    edits.push({ start: ast.declaration.start, end: ast.declaration.end, text: '' });
  }
  return edits;
}
