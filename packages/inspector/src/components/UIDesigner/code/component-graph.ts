import type { Edit } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

function jsxName(el: AstNode): string | null {
  const n = el.openingElement?.name ?? el.name;
  return n?.type === 'JSXIdentifier' && typeof n.name === 'string' ? n.name : null;
}

/** Walk a program's JSX and collect the names of referenced elements that are in `known` (other roots). */
export function collectComponentRefNames(
  program: AstNode | undefined,
  known: Set<string>,
): string[] {
  const found = new Set<string>();
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (node.type === 'JSXElement') {
      const name = jsxName(node);
      if (name && known.has(name)) found.add(name);
    }
    for (const key in node) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      visit(node[key]);
    }
  };
  visit(node_body(program));
  return [...found];
}

function node_body(program: AstNode | undefined): unknown {
  return program?.body ?? program;
}

/** Can `from` reach `to` following edges in `refs`? Includes `from === to`. */
export function reaches(refs: Map<string, string[]>, from: string, to: string): boolean {
  if (from === to) return true;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of refs.get(cur) ?? []) stack.push(next);
  }
  return false;
}

/** Would nesting `child` inside `parent` create a cycle? Unsafe iff `child` already reaches `parent`. */
export function wouldCycle(refs: Map<string, string[]>, parent: string, child: string): boolean {
  return reaches(refs, child, parent);
}

function specifierBasename(spec: string): string {
  const last = spec.split('/').pop() ?? spec;
  return last.replace(/\.[tj]sx?$/, '');
}

/** Whether a parsed module references root `name`: imports it by name (even unused) or renders `<Name />`. */
export function referencesRoot(program: AstNode | undefined, name: string): boolean {
  for (const stmt of (program?.body ?? []) as AstNode[]) {
    if (stmt.type !== 'ImportDeclaration') continue;
    const from = stmt.source?.value;
    if (typeof from === 'string' && from.startsWith('.') && specifierBasename(from) === name)
      return true;
    for (const s of (stmt.specifiers ?? []) as AstNode[]) {
      if (s.type === 'ImportSpecifier' && (s.imported?.name ?? s.imported?.value) === name)
        return true;
    }
  }
  return collectComponentRefNames(program, new Set([name])).length > 0;
}

/** Span edits that retarget every reference to root `oldName` in a referrer file onto `newName` (import source, specifier, and — for an unaliased import — JSX identifiers). */
export function renameComponentRefEdits(
  program: AstNode | undefined,
  oldName: string,
  newName: string,
): Edit[] {
  const edits: Edit[] = [];
  let renameJsx = false;

  for (const stmt of (program?.body ?? []) as AstNode[]) {
    if (stmt.type !== 'ImportDeclaration') continue;
    const source = stmt.source;
    const from = source?.value;
    const fromMatches =
      typeof from === 'string' && from.startsWith('.') && specifierBasename(from) === oldName;
    if (fromMatches) {
      const lastSlash = from.lastIndexOf('/');
      const ext = (from.split('/').pop() ?? '').match(/\.[tj]sx?$/)?.[0] ?? '';
      const inner = `${from.slice(0, lastSlash + 1)}${newName}${ext}`;
      edits.push({ start: source.start + 1, end: source.end - 1, text: inner });
    }
    for (const s of (stmt.specifiers ?? []) as AstNode[]) {
      if (s.type !== 'ImportSpecifier') continue;
      const imported = s.imported;
      if ((imported?.name ?? imported?.value) !== oldName) continue;
      if (!fromMatches) continue;
      edits.push({ start: imported.start, end: imported.end, text: newName });
      if (s.local?.start === imported.start) renameJsx = true;
    }
  }

  if (renameJsx) {
    const nameEdit = (n: any): void => {
      const target = n?.type === 'JSXMemberExpression' ? n.object : n;
      if (target?.type === 'JSXIdentifier' && target.name === oldName) {
        edits.push({ start: target.start, end: target.end, text: newName });
      }
    };
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const n of node) visit(n);
        return;
      }
      if (node.type === 'JSXElement') {
        nameEdit(node.openingElement?.name);
        nameEdit(node.closingElement?.name);
      }
      for (const key in node) {
        if (key === 'type' || key === 'start' || key === 'end') continue;
        visit(node[key]);
      }
    };
    visit(program?.body);
  }

  return edits;
}
