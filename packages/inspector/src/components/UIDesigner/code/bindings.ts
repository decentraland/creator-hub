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
  type: string;
  expr: string;
  value?: string | number | boolean;
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

const RESERVED_ACTION_NAMES = ['state', 'props', 'value', 'UiAction'];

/** Whether a new @ui-action may NOT be called `name` (collides with a reserved name, another action, or a variable). */
export function isActionNameTaken(surface: BindingSurface, name: string): boolean {
  return (
    RESERVED_ACTION_NAMES.includes(name) ||
    surface.actions.some(a => a.name === name) ||
    surface.variables.some(v => v.name === name)
  );
}

/** Build a default-value lookup (binding expr → value string) from a surface's variables, for previewing bound text on the canvas. */
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

/** A leading JSDoc marker for a declaration: a comment abutting the declaration's start that carries the tag. */
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
