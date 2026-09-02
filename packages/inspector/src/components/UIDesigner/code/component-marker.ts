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
const MARKER_RE = /\/\*[\s\S]*?@ui-component[\s\S]*?\*\//;

/** Cheap whole-source test for the @ui-component marker, to classify a root without a full parse. */
export function hasComponentMarker(source: string): boolean {
  return MARKER_RE.test(source);
}

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

/** Edits to make the `@ui-component` marker present or absent on `componentName`; idempotent. */
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
  return [{ start: existing.start, end: stmt.start, text: '' }];
}
