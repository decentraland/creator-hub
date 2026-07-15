// Extract the "public binding surface" a scene's UI code exposes to the editor,
// declared with JSDoc markers (mirrors Unity [SerializeField] / Godot @export /
// Unreal UPROPERTY — see the plan's engine-precedent note):
//   /** @ui-bind */   let score: number = 0     → a bindable variable
//   /** @ui-action */ function onClick() {}      → an event handler
// A field can then reference a variable (`value={score}`) or a handler
// (`onMouseDown={onClick}`) instead of a static literal.

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

export interface BindVariable {
  name: string;
  // 'number' | 'string' | 'boolean' — from an explicit annotation, else shallow
  // literal-initializer inference, else 'string'. OXC parses but does not
  // type-check, so inferred/complex types aren't resolved.
  type: string;
  // The expression a field binds to (`value={<expr>}`). A marker variable binds
  // bare (`score`); a state variable binds through the object (`state.score`).
  expr: string;
  // The default value (statically-evaluated literal), used to preview a bound
  // field on the canvas. Undefined for markers and non-literal initializers.
  value?: string | number | boolean;
  // Set when this variable is declared in ANOTHER file (imported via
  // `import { name } from '<imported>'`) — the target file's scene-relative
  // path. Such vars are bindable here but read-only (edit them in their own
  // file). Undefined for local state/marker vars. See code/imports.ts.
  imported?: string;
}

export interface BindAction {
  name: string;
}

export interface BindingSurface {
  variables: BindVariable[];
  actions: BindAction[];
}

const EMPTY: BindingSurface = { variables: [], actions: [] };

// Build a default-value lookup (binding expr → value string) from a surface's
// variables, for previewing bound text on the canvas (`state.score` → "0"). Only
// vars carrying a known default (state vars / literal markers) are included;
// props and expression bindings have none.
export function buildResolveMap(variables: BindVariable[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of variables) if (v.value !== undefined) map[v.expr] = String(v.value);
  return map;
}

function annotationType(id: AstNode | undefined): string | null {
  const t = id?.typeAnnotation?.typeAnnotation?.type;
  if (t === 'TSNumberKeyword') return 'number';
  if (t === 'TSStringKeyword') return 'string';
  if (t === 'TSBooleanKeyword') return 'boolean';
  return null;
}

function inferInitializerType(init: AstNode | undefined): string {
  if (init?.type === 'Literal') {
    if (typeof init.value === 'number') return 'number';
    if (typeof init.value === 'boolean') return 'boolean';
  }
  return 'string';
}

// A leading JSDoc marker for a declaration: a comment whose end abuts the
// declaration's start (only whitespace between) and carries the tag. Exported so
// the action reader (code/actions.ts) recognizes @ui-action handlers the same way.
export function markerFor(
  comments: Comment[],
  declStart: number,
  source: string,
): 'bind' | 'action' | null {
  for (const c of comments) {
    if (c.end > declStart) continue;
    if (!/^\s*$/.test(source.slice(c.end, declStart))) continue;
    if (c.value.includes('@ui-bind')) return 'bind';
    if (c.value.includes('@ui-action')) return 'action';
  }
  return null;
}

export function extractBindingSurface(
  program: AstNode,
  comments: Comment[] | undefined,
  source: string,
): BindingSurface {
  if (!program?.body || !comments) return EMPTY;
  const variables: BindVariable[] = [];
  const actions: BindAction[] = [];

  for (const stmt of program.body as AstNode[]) {
    const decl = (stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt) as
      | AstNode
      | undefined;
    if (!decl) continue;
    const marker = markerFor(comments, stmt.start, source);
    if (!marker) continue;

    if (marker === 'bind' && decl.type === 'VariableDeclaration') {
      const d = decl.declarations?.[0] as AstNode | undefined;
      const name = d?.id?.name as string | undefined;
      if (name) {
        variables.push({
          name,
          type: annotationType(d?.id) ?? inferInitializerType(d?.init),
          expr: name,
        });
      }
    } else if (marker === 'action' && decl.type === 'FunctionDeclaration') {
      const name = decl.id?.name as string | undefined;
      if (name) actions.push({ name });
    }
  }

  return { variables, actions };
}
