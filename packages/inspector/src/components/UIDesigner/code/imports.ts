interface AstNode {
  type: string;
  [k: string]: any;
}

export interface NamedImport {
  from: string;
  specifiers: { imported: string; local: string }[];
}

/** Collect the named imports of a parsed module; default and namespace imports are skipped. */
export function collectNamedImports(program: AstNode | undefined): NamedImport[] {
  const out: NamedImport[] = [];
  for (const stmt of (program?.body ?? []) as AstNode[]) {
    if (stmt.type !== 'ImportDeclaration') continue;
    const from = stmt.source?.value;
    if (typeof from !== 'string') continue;
    const specifiers: { imported: string; local: string }[] = [];
    for (const s of (stmt.specifiers ?? []) as AstNode[]) {
      if (s.type !== 'ImportSpecifier') continue;
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

/** Resolve a relative import specifier from `activeFilename` to the ordered list of scene-relative file paths to probe; null for a bare/package specifier. */
export function resolveModuleCandidates(activeFilename: string, spec: string): string[] | null {
  if (!spec.startsWith('.')) return null;
  const stack = activeFilename.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  const base = stack.join('/');
  if (!base) return null;
  if (EXT.test(base)) return [base];
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
}
