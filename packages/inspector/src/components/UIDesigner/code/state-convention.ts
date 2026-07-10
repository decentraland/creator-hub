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
  return 'string';
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
    vars.push({ name, type: typeByName.get(name) ?? inferType(prop.value as AstNode) });
  }
  return vars;
}

// Literal default per bindable type, used when seeding a new state property.
const STATE_DEFAULT: Record<string, string> = { number: '0', string: "''", boolean: 'false' };

// Produce the edits that add `name` to the `state` object (and, when an
// interface types it, to that interface). Returns [] when no `state` object
// exists — the caller seeds the scaffold first (see store.addBindVariable).
// Pure: located entirely by the AST spans from findStateNodes, so it round-trips
// without reprinting.
export function addStateProperty(program: AstNode, name: string, type: string): Edit[] {
  const { object, interfaceBody } = findStateNodes(program);
  if (!object) return [];
  const value = STATE_DEFAULT[type] ?? "''";
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
