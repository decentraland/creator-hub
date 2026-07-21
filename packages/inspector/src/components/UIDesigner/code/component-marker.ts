// The `/** @ui-component */` marker decides whether a root is a top-level SCREEN
// (rendered by the src/ui/index.tsx aggregator) or a reusable COMPONENT (only
// rendered where another root nests it). Marker PRESENT → component (not
// aggregated); ABSENT → top-level (default: all roots are promoted). The editor's
// per-root "top-level" toggle writes/removes this marker, so the checkbox and a
// hand-authored decorator are the SAME signal. Dependency-free (pure AST + spans)
// so it can be unit-tested and shared by the store.

import type { Edit } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

interface Comment {
  type: string;
  value: string;
  start: number;
  end: number;
}

const MARKER = '@ui-component';
// A block comment containing the tag. Anchored to the comment form (not a bare
// substring) so a string literal like "@ui-component" in the UI can't false-match.
const MARKER_RE = /\/\*[\s\S]*?@ui-component[\s\S]*?\*\//;

// Cheap whole-source test — used by refreshRoots to classify a root without a
// full parse. Good enough for the aggregate/display decision; the precise
// add/remove below is used for the actual toggle edit.
export function hasComponentMarker(source: string): boolean {
  return MARKER_RE.test(source);
}

// The top-level statement declaring `componentName` (an exported function or
// `export const X = …`), so the marker can be placed right before it.
function findComponentStatement(program: AstNode, componentName: string): AstNode | undefined {
  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = (stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt) as
      | AstNode
      | undefined;
    if (!decl) continue;
    if (decl.type === 'FunctionDeclaration' && decl.id?.name === componentName) return stmt;
    if (decl.type === 'VariableDeclaration') {
      for (const d of (decl.declarations ?? []) as AstNode[]) {
        if (d.id?.type === 'Identifier' && d.id.name === componentName) return stmt;
      }
    }
  }
  return undefined;
}

// The @ui-component comment abutting `stmtStart` (only whitespace between it and
// the declaration), if any — mirrors bindings.markerFor.
function markerCommentFor(
  comments: Comment[],
  stmtStart: number,
  source: string,
): Comment | undefined {
  for (const c of comments) {
    if (c.end > stmtStart) continue;
    if (!/^\s*$/.test(source.slice(c.end, stmtStart))) continue;
    if (c.value.includes(MARKER)) return c;
  }
  return undefined;
}

// Edits to make the `@ui-component` marker present or absent on `componentName`.
// Idempotent: [] when already in the desired state or the component isn't found.
export function componentMarkerEdit(
  program: AstNode,
  comments: Comment[],
  source: string,
  componentName: string,
  present: boolean,
): Edit[] {
  const stmt = findComponentStatement(program, componentName);
  if (!stmt) return [];
  const existing = markerCommentFor(comments, stmt.start, source);
  if (present) {
    if (existing) return [];
    return [{ start: stmt.start, end: stmt.start, text: '/** @ui-component */\n' }];
  }
  if (!existing) return [];
  // Remove the comment and the whitespace up to the declaration (drops the
  // blank line the add introduced).
  return [{ start: existing.start, end: stmt.start, text: '' }];
}
