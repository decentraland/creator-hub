// Cross-file import resolution for the binding surface. When the active root
// imports a variable declared with /** @ui-bind */ in another scene file
// (`import { score } from './shared'`), that variable should be bindable in the
// editor too — it's in scope, so a field can reference it bare (`value={score}`),
// exactly like a local marker. This module owns the *pure* half of that feature:
//   - collectNamedImports: which names the active file pulls in, and from where.
//   - resolveModuleCandidates: a relative specifier → the scene file paths to try.
// The IO half (reading + parsing the target file, caching, merging) lives in
// store.ts, which is the only place with the storage/parser RPC handles.
// Dependency-free so it can be unit-tested in isolation.

interface AstNode {
  type: string;
  [k: string]: any;
}

export interface NamedImport {
  // The module specifier, verbatim (`./shared`, `../state`, `@dcl/sdk`).
  from: string;
  // Each named binding: `imported` is the exported name in the target file,
  // `local` is the name it's bound to here (they differ for `{ a as b }`).
  specifiers: { imported: string; local: string }[];
}

// Collect the named imports of a parsed module. Only `import { … }` specifiers
// are returned — default (`import x`) and namespace (`import * as x`) imports
// can't resolve to a single @ui-bind declaration, so they're skipped.
export function collectNamedImports(program: AstNode | undefined): NamedImport[] {
  const out: NamedImport[] = [];
  for (const stmt of (program?.body ?? []) as AstNode[]) {
    if (stmt.type !== 'ImportDeclaration') continue;
    const from = stmt.source?.value;
    if (typeof from !== 'string') continue;
    const specifiers: { imported: string; local: string }[] = [];
    for (const s of (stmt.specifiers ?? []) as AstNode[]) {
      if (s.type !== 'ImportSpecifier') continue;
      // `imported` is an Identifier (name) or, for `{ "x" as y }`, a Literal (value).
      const imported = s.imported?.name ?? s.imported?.value;
      const local = s.local?.name;
      if (typeof imported === 'string' && typeof local === 'string')
        specifiers.push({ imported, local });
    }
    if (specifiers.length) out.push({ from, specifiers });
  }
  return out;
}

const EXT = /\.[tj]sx?$/;

// Resolve a relative import specifier from `activeFilename` to the ordered list
// of scene-relative file paths to probe (first existing one wins). Returns null
// for a bare/package specifier (`@dcl/sdk`, `react`) — those never point at a
// scene file. Paths are POSIX scene-relative (e.g. `src/ui/MainUI.tsx`); this
// does the `.`/`..` math itself rather than relying on Node `path` (unavailable
// in the inspector iframe).
export function resolveModuleCandidates(activeFilename: string, spec: string): string[] | null {
  if (!spec.startsWith('.')) return null;
  const stack = activeFilename.split('/').slice(0, -1); // the active file's dir
  for (const part of spec.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  const base = stack.join('/');
  if (!base) return null;
  // An explicit extension resolves directly; otherwise try .ts/.tsx then an
  // index file (a directory import).
  if (EXT.test(base)) return [base];
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
}
