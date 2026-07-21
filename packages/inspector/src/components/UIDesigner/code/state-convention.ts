// The "state object" binding convention — the functional analog of the
// class-field surface we considered, and the signature the editor imposes:
//
//   export interface State { score: number }
//   export const state: State = { score: 0 }
//
// Bindable variables are the properties of `state` (typed by the interface, else
// inferred from the initializer). The editor reads these as the binding surface
// and writes new ones here; hand-authored /** @ui-bind */ markers remain a
// fallback for foreign code (see bindings.ts). Dependency-free so it can be
// shared by the reader (bindings.ts) and the writer (emit-adapter.ts) and
// unit-tested in isolation.

import type { Edit } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

export interface StateVar {
  name: string;
  type: string;
  // The default value from the object initializer (a statically-evaluated
  // literal), used to preview a bound field on the canvas. Undefined when the
  // initializer isn't a simple literal.
  value?: string | number | boolean;
}

export interface StateNodes {
  // ObjectExpression initializer of `const state = { … }`.
  object?: AstNode;
  // TSInterfaceBody of the interface typing `state` (if any).
  interfaceBody?: AstNode;
}

function declOf(stmt: AstNode): AstNode | undefined {
  return stmt.type === 'ExportNamedDeclaration' ? (stmt.declaration as AstNode) : stmt;
}

function tsKeywordToType(t: string | undefined): string | null {
  if (t === 'TSNumberKeyword') return 'number';
  if (t === 'TSStringKeyword') return 'string';
  if (t === 'TSBooleanKeyword') return 'boolean';
  return null;
}

function inferType(init: AstNode | undefined): string {
  if (init?.type === 'Literal') {
    if (typeof init.value === 'number') return 'number';
    if (typeof init.value === 'boolean') return 'boolean';
  }
  // A negative/positive numeric literal parses as a UnaryExpression (`-3`).
  if (
    init?.type === 'UnaryExpression' &&
    (init.operator === '-' || init.operator === '+') &&
    (init.argument as AstNode | undefined)?.type === 'Literal' &&
    typeof (init.argument as AstNode).value === 'number'
  )
    return 'number';
  return 'string';
}

// Statically evaluate a state property's initializer to its literal value
// (string / number / boolean), for the canvas default-value preview. Handles a
// negative-number unary (`-5`). Non-literal initializers → undefined.
function evalLiteral(init: AstNode | undefined): string | number | boolean | undefined {
  if (!init) return undefined;
  if (init.type === 'Literal') {
    const v = init.value;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  }
  if (init.type === 'UnaryExpression' && init.operator === '-') {
    const a = evalLiteral(init.argument as AstNode);
    if (typeof a === 'number') return -a;
  }
  return undefined;
}

// Format a user-entered default (raw text) as the TS literal to splice into the
// state object, per the variable's type. Empty raw → the type's zero default.
export function literalForType(type: string, raw?: string): string {
  if (raw === undefined || raw === '') return STATE_DEFAULT[type] ?? "''";
  if (type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : '0';
  }
  if (type === 'boolean') return raw === 'true' ? 'true' : 'false';
  return JSON.stringify(raw);
}

// Locate the `state` const's object initializer and the interface body that
// types it (matched by the const's type annotation, else an interface named
// "State"). Returns the AST nodes (with byte spans) so callers can read or
// splice them.
export function findStateNodes(program: AstNode): StateNodes {
  const interfaceByName = new Map<string, AstNode>();
  let stateDeclarator: AstNode | undefined;

  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (!decl) continue;
    if (decl.type === 'TSInterfaceDeclaration' && decl.id?.name) {
      interfaceByName.set(decl.id.name as string, decl.body as AstNode);
    } else if (decl.type === 'VariableDeclaration') {
      for (const d of (decl.declarations ?? []) as AstNode[]) {
        if (d.id?.type === 'Identifier' && d.id.name === 'state') stateDeclarator = d;
      }
    }
  }

  if (!stateDeclarator) return {};
  const init = stateDeclarator.init as AstNode | undefined;
  const object = init && init.type === 'ObjectExpression' ? init : undefined;
  const typeName = stateDeclarator.id?.typeAnnotation?.typeAnnotation?.typeName?.name as
    | string
    | undefined;
  const interfaceBody =
    (typeName && interfaceByName.get(typeName)) || interfaceByName.get('State') || undefined;
  return { object, interfaceBody };
}

// Read the bindable variables declared by the state convention, typed from the
// interface (preferred) or shallow literal inference from the initializer.
export function readStateVariables(program: AstNode): StateVar[] {
  const { object, interfaceBody } = findStateNodes(program);
  if (!object) return [];

  const typeByName = new Map<string, string>();
  for (const m of (interfaceBody?.body ?? []) as AstNode[]) {
    if (m.type === 'TSPropertySignature' && m.key?.type === 'Identifier') {
      const t = tsKeywordToType(m.typeAnnotation?.typeAnnotation?.type);
      if (t) typeByName.set(m.key.name as string, t);
    }
  }

  const vars: StateVar[] = [];
  for (const prop of (object.properties ?? []) as AstNode[]) {
    if (prop.type !== 'Property' || prop.computed) continue;
    const key = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
    if (key == null) continue;
    const name = String(key);
    vars.push({
      name,
      type: typeByName.get(name) ?? inferType(prop.value as AstNode),
      value: evalLiteral(prop.value as AstNode),
    });
  }
  return vars;
}

// Literal default per bindable type, used when seeding a new state property.
const STATE_DEFAULT: Record<string, string> = { number: '0', string: "''", boolean: 'false' };

// Produce the edits that add `name` to the `state` object (and, when an
// interface types it, to that interface). `rawDefault` (optional) is the
// user-entered default; when omitted the type's zero default is used. Returns []
// when no `state` object exists — the caller seeds the scaffold first (see
// store.addBindVariable). Pure: located entirely by the AST spans from
// findStateNodes, so it round-trips without reprinting.
export function addStateProperty(
  program: AstNode,
  name: string,
  type: string,
  rawDefault?: string,
): Edit[] {
  const { object, interfaceBody } = findStateNodes(program);
  if (!object) return [];
  const value = literalForType(type, rawDefault);
  const edits: Edit[] = [];

  const props = (object.properties ?? []) as AstNode[];
  if (props.length > 0) {
    const last = props[props.length - 1];
    edits.push({ start: last.end, end: last.end, text: `,\n  ${name}: ${value}` });
  } else {
    // Empty object literal `{}` → seed the first property.
    edits.push({ start: object.start + 1, end: object.end - 1, text: `\n  ${name}: ${value},\n` });
  }

  if (interfaceBody) {
    const members = (interfaceBody.body ?? []) as AstNode[];
    if (members.length > 0) {
      const last = members[members.length - 1];
      edits.push({ start: last.end, end: last.end, text: `\n  ${name}: ${type}` });
    } else {
      edits.push({
        start: interfaceBody.start + 1,
        end: interfaceBody.end - 1,
        text: `\n  ${name}: ${type}\n`,
      });
    }
  }

  return edits;
}

function keyNameOf(prop: AstNode): string | null {
  const key = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
  return key == null ? null : String(key);
}

interface PropertyLocation {
  object?: AstNode;
  props: AstNode[];
  prop?: AstNode;
  propIndex: number;
  interfaceBody?: AstNode;
  members: AstNode[];
  member?: AstNode;
  memberIndex: number;
}

// Locate a single state variable by name: its object-literal Property node and,
// when the state const is typed, the matching interface member — plus the
// surrounding lists so removers can compute the delimiter span to absorb.
function locateProperty(program: AstNode, name: string): PropertyLocation {
  const { object, interfaceBody } = findStateNodes(program);
  const props = (object?.properties ?? []) as AstNode[];
  const propIndex = props.findIndex(
    p => p.type === 'Property' && !p.computed && keyNameOf(p) === name,
  );
  const members = (interfaceBody?.body ?? []) as AstNode[];
  const memberIndex = members.findIndex(
    m => m.type === 'TSPropertySignature' && m.key?.type === 'Identifier' && m.key.name === name,
  );
  return {
    object,
    props,
    prop: propIndex >= 0 ? props[propIndex] : undefined,
    propIndex,
    interfaceBody,
    members,
    member: memberIndex >= 0 ? members[memberIndex] : undefined,
    memberIndex,
  };
}

// Removal edit for element `i` of a delimited list inside `container`, absorbing
// one neighbouring delimiter so no dangling comma / blank line is left: sole
// element → empty the container's interior (also drops any seeded trailing
// comma); otherwise drop the preceding delimiter when there's an earlier
// sibling, else the following one.
function spanRemovingElement(list: AstNode[], i: number, container: AstNode): Edit {
  const el = list[i];
  if (list.length === 1) return { start: container.start + 1, end: container.end - 1, text: '' };
  if (i > 0) return { start: list[i - 1].end, end: el.end, text: '' };
  return { start: el.start, end: list[i + 1].start, text: '' };
}

// Remove a state variable: delete its object property (with an adjacent comma)
// and, when the state const is typed, its interface member. Returns [] when the
// variable isn't found. Bound references (`state.<name>` in JSX) are left as-is —
// deleting a bound variable surfaces a type error the author resolves, matching
// the classic variables panel's delete semantics.
export function removeStateProperty(program: AstNode, name: string): Edit[] {
  const loc = locateProperty(program, name);
  const edits: Edit[] = [];
  if (loc.prop && loc.object) edits.push(spanRemovingElement(loc.props, loc.propIndex, loc.object));
  if (loc.member && loc.interfaceBody)
    edits.push(spanRemovingElement(loc.members, loc.memberIndex, loc.interfaceBody));
  return edits;
}

// Change a state variable's type: rewrite its interface member's type annotation
// (when typed) and reset its object initializer to the new type's default literal
// (a Boolean field shouldn't keep a stale `0`, mirroring the classic panel).
// Returns [] when the variable isn't in the object.
export function setStatePropertyType(program: AstNode, name: string, newType: string): Edit[] {
  const loc = locateProperty(program, name);
  if (!loc.prop) return [];
  const edits: Edit[] = [];
  const value = STATE_DEFAULT[newType] ?? "''";
  edits.push({ start: loc.prop.value.start, end: loc.prop.value.end, text: value });
  const ann = loc.member?.typeAnnotation?.typeAnnotation as AstNode | undefined;
  if (ann) edits.push({ start: ann.start, end: ann.end, text: newType });
  return edits;
}

// Set a state variable's default value: replace its object initializer with the
// `rawDefault` formatted per `type`. Returns [] when the variable isn't found.
export function setStatePropertyValue(
  program: AstNode,
  name: string,
  type: string,
  rawDefault: string,
): Edit[] {
  const loc = locateProperty(program, name);
  if (!loc.prop) return [];
  return [
    {
      start: loc.prop.value.start,
      end: loc.prop.value.end,
      text: literalForType(type, rawDefault),
    },
  ];
}
