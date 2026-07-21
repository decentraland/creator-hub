// Component reference graph — the cycle guard for nesting one root inside
// another. react-ecs composes components by rendering them, so a reference cycle
// (A renders B, B renders A) infinite-recurses at runtime. Before inserting
// `<Child />` into a root we check the edge wouldn't close a cycle. Pure: the
// store builds the `refs` map by parsing each root (IO) and feeds it here.
// Also owns the pure half of cross-file rename integrity: the span edits that
// retarget a referrer's import + JSX usages when a root is renamed.

import type { Edit } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

// The (capitalized) name of a JSX element, or null for a member-expression name
// (`<Foo.Bar />`) which never denotes a local root.
function jsxName(el: AstNode): string | null {
  const n = el.openingElement?.name ?? el.name;
  return n?.type === 'JSXIdentifier' && typeof n.name === 'string' ? n.name : null;
}

// Walk a program's JSX and collect the names of referenced elements that are in
// `known` (other roots). Used to build one node's outgoing edges.
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

// Can `from` reach `to` following edges in `refs` (adjacency: name → names it
// references)? Includes `from === to` (a self-reference is a cycle too).
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

// Would nesting `child` inside `parent` create a cycle? Nesting adds the edge
// parent → child, so it's unsafe iff `child` already reaches `parent`.
export function wouldCycle(refs: Map<string, string[]>, parent: string, child: string): boolean {
  return reaches(refs, child, parent);
}

// The final path segment of a module specifier, extension stripped —
// './Card' / '../ui/Card' / './Card.tsx' all yield 'Card'.
function specifierBasename(spec: string): string {
  const last = spec.split('/').pop() ?? spec;
  return last.replace(/\.[tj]sx?$/, '');
}

// Whether a parsed module references root `name`: imports it by name (even
// unused — a rename/delete would still break the import) or renders `<Name />`.
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

// Span edits that retarget every reference to root `oldName` in a REFERRER file
// onto `newName`: the import source ('./Old' → './New', directory prefix and
// extension preserved), the imported specifier identifier, and — when the
// local binding is the plain (unaliased) name — the `<Old>` / `</Old>` JSX
// identifiers. An aliased import (`{ Old as O }`) keeps its alias and its JSX
// untouched; only the imported name and module source are rewritten.
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
      // Replace only the basename inside the string literal (quotes kept).
      const lastSlash = from.lastIndexOf('/');
      const ext = (from.split('/').pop() ?? '').match(/\.[tj]sx?$/)?.[0] ?? '';
      const inner = `${from.slice(0, lastSlash + 1)}${newName}${ext}`;
      edits.push({ start: source.start + 1, end: source.end - 1, text: inner });
    }
    for (const s of (stmt.specifiers ?? []) as AstNode[]) {
      if (s.type !== 'ImportSpecifier') continue;
      const imported = s.imported;
      if ((imported?.name ?? imported?.value) !== oldName) continue;
      if (!fromMatches) continue; // same-named import from another module — not ours
      edits.push({ start: imported.start, end: imported.end, text: newName });
      // Shorthand `{ Old }`: imported and local are the same node, so the local
      // binding is renamed by the splice above → JSX usages must follow.
      if (s.local?.start === imported.start) renameJsx = true;
    }
  }

  if (renameJsx) {
    // Rename only ELEMENT-NAME identifiers (`<Old`, `</Old`, `<Old.Slot`) —
    // never attribute names, which are also JSXIdentifiers.
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
