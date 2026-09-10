import type { Edit } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

export interface PropVar {
  name: string;
  type: string;
}

function declOf(stmt: AstNode): AstNode | undefined {
  return stmt.type === 'ExportNamedDeclaration' ? (stmt.declaration as AstNode) : stmt;
}

function tsKeywordToType(t: string | undefined): string | null {
  if (t === 'TSNumberKeyword') return 'number';
  if (t === 'TSStringKeyword') return 'string';
  if (t === 'TSBooleanKeyword') return 'boolean';
  if (t === 'TSFunctionType') return 'callback';
  return null;
}

/** Editor prop type → the TS source text spliced into the props type literal. */
export function propTypeToTs(type: string): string {
  return type === 'callback' ? '(value?: unknown) => void' : type;
}

function findComponentFn(program: AstNode, componentName: string): AstNode | undefined {
  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (decl?.type === 'FunctionDeclaration' && decl.id?.name === componentName) return decl;
  }
  return undefined;
}

function findPropsTypeLiteral(fn: AstNode | undefined): AstNode | undefined {
  const param = (fn?.params ?? [])[0] as AstNode | undefined;
  const ann = param?.typeAnnotation?.typeAnnotation as AstNode | undefined;
  return ann?.type === 'TSTypeLiteral' ? ann : undefined;
}

/** Read the props declared by `componentName` (name + type); a non-primitive member type is reported as 'unknown'. */
export function readPropsVariables(program: AstNode, componentName: string): PropVar[] {
  const lit = findPropsTypeLiteral(findComponentFn(program, componentName));
  if (!lit) return [];
  const vars: PropVar[] = [];
  for (const m of (lit.members ?? []) as AstNode[]) {
    if (m.type !== 'TSPropertySignature' || m.key?.type !== 'Identifier') continue;
    const type = tsKeywordToType(m.typeAnnotation?.typeAnnotation?.type) ?? 'unknown';
    vars.push({ name: m.key.name as string, type });
  }
  return vars;
}

/** Ensure the component has a `props` parameter (seed an empty `props: {}` when it has none); null when it already has one or isn't found. */
export function ensurePropsParamEdit(
  program: AstNode,
  source: string,
  componentName: string,
): Edit | null {
  const fn = findComponentFn(program, componentName);
  if (!fn) return null;
  if ((fn.params ?? []).length > 0) return null;
  const parens = paramParens(fn, source);
  if (!parens) return null;
  return { start: parens.open + 1, end: parens.close, text: 'props: {}' };
}

function paramParens(fn: AstNode, source: string): { open: number; close: number } | null {
  const from = (fn.id?.end ?? fn.start) as number;
  const to = (fn.body?.start ?? fn.end) as number;
  const open = source.indexOf('(', from);
  const close = source.indexOf(')', open + 1);
  if (open < 0 || close < 0 || close > to) return null;
  return { open, close };
}

/** Add a prop to `componentName`, seeding the `props: { … }` parameter when absent; every editor-declared prop is emitted optional. */
export function addPropsProperty(
  program: AstNode,
  source: string,
  componentName: string,
  name: string,
  type: string,
): Edit[] {
  const fn = findComponentFn(program, componentName);
  if (!fn) return [];
  const lit = findPropsTypeLiteral(fn);
  if (lit) {
    const members = (lit.members ?? []) as AstNode[];
    if (members.length > 0) {
      const last = members[members.length - 1];
      return [{ start: last.end, end: last.end, text: `; ${name}?: ${type}` }];
    }
    return [{ start: lit.start + 1, end: lit.end - 1, text: ` ${name}?: ${type} ` }];
  }
  if ((fn.params ?? []).length > 0) return [];
  const parens = paramParens(fn, source);
  if (!parens) return [];
  return [{ start: parens.open + 1, end: parens.close, text: `props: { ${name}?: ${type} }` }];
}

function memberByName(lit: AstNode, name: string): { members: AstNode[]; index: number } {
  const members = (lit.members ?? []) as AstNode[];
  const index = members.findIndex(
    m => m.type === 'TSPropertySignature' && m.key?.type === 'Identifier' && m.key.name === name,
  );
  return { members, index };
}

/** Remove a prop from the props type literal, absorbing one delimiter; [] when the prop isn't found. */
export function removePropsProperty(program: AstNode, componentName: string, name: string): Edit[] {
  const lit = findPropsTypeLiteral(findComponentFn(program, componentName));
  if (!lit) return [];
  const { members, index } = memberByName(lit, name);
  if (index < 0) return [];
  const el = members[index];
  if (members.length === 1) return [{ start: lit.start + 1, end: lit.end - 1, text: '' }];
  if (index > 0) return [{ start: members[index - 1].end, end: el.end, text: '' }];
  return [{ start: el.start, end: members[index + 1].start, text: '' }];
}

/** Change a prop's type: rewrite its member's type-annotation span. */
export function setPropsPropertyType(
  program: AstNode,
  componentName: string,
  name: string,
  newType: string,
): Edit[] {
  const lit = findPropsTypeLiteral(findComponentFn(program, componentName));
  if (!lit) return [];
  const { members, index } = memberByName(lit, name);
  if (index < 0) return [];
  const ann = members[index].typeAnnotation?.typeAnnotation as AstNode | undefined;
  if (!ann) return [];
  return [{ start: ann.start, end: ann.end, text: newType }];
}
