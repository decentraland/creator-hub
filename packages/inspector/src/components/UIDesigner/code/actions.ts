import { markerFor } from './bindings';
import { afterImports, type Edit } from './emit-adapter';
import { ensurePropsParamEdit } from './props-convention';

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

/** A bound variable the template can reference: `name` inside `{{ }}`, `expr` the code it resolves to. */
export interface BoundVar {
  name: string;
  expr: string;
  type?: string;
}

function callbackPropNames(vars: BoundVar[]): string[] {
  return vars.filter(v => v.type === 'callback' && v.expr === `props.${v.name}`).map(v => v.name);
}

export interface CodeAction {
  name: string;
  template: string;
}

function declOf(stmt: AstNode): AstNode | undefined {
  return stmt.type === 'ExportNamedDeclaration' ? (stmt.declaration as AstNode) : stmt;
}

function findActionBody(program: AstNode, name: string): AstNode | undefined {
  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (decl?.type === 'FunctionDeclaration' && decl.id?.name === name) {
      return decl.body as AstNode | undefined;
    }
  }
  return undefined;
}

interface Ref {
  start: number;
  end: number;
  name: string;
}

function collectRefs(
  body: AstNode,
  stateNames: Set<string>,
  markerNames: Set<string>,
  propNames: Set<string>,
): Ref[] {
  const out: Ref[] = [];
  const visit = (node: AstNode | undefined, parent: AstNode | undefined): void => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;

    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object?.type === 'Identifier' &&
      node.object.name === 'state' &&
      node.property?.type === 'Identifier' &&
      stateNames.has(node.property.name)
    ) {
      out.push({ start: node.start, end: node.end, name: node.property.name });
      return;
    }

    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object?.type === 'Identifier' &&
      node.object.name === 'props' &&
      node.property?.type === 'Identifier' &&
      propNames.has(node.property.name)
    ) {
      out.push({ start: node.start, end: node.end, name: `props.${node.property.name}` });
      return;
    }

    if (node.type === 'Identifier' && markerNames.has(node.name)) {
      const isPropKey = parent?.type === 'Property' && parent.key === node && !parent.computed;
      const isMemberProp =
        parent?.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const isDeclId =
        (parent?.type === 'VariableDeclarator' ||
          parent?.type === 'FunctionDeclaration' ||
          parent?.type === 'ClassDeclaration') &&
        parent.id === node;
      if (!isPropKey && !isMemberProp && !isDeclId) {
        out.push({ start: node.start, end: node.end, name: node.name });
      }
      return;
    }

    for (const k in node) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) {
        for (const el of v) if (el && typeof el === 'object') visit(el as AstNode, node);
      } else if (v && typeof v === 'object') {
        visit(v as AstNode, node);
      }
    }
  };
  visit(body, undefined);
  return out;
}

function dedent(s: string): string {
  const lines = s.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const indents = lines.filter(l => l.trim() !== '').map(l => l.match(/^\s*/)?.[0].length ?? 0);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map(l => l.slice(min).replace(/\s+$/, '')).join('\n');
}

function codeToTemplate(body: AstNode, source: string, vars: BoundVar[]): string {
  const innerStart = body.start + 1;
  const innerEnd = body.end - 1;
  const stateNames = new Set(vars.filter(v => v.expr === `state.${v.name}`).map(v => v.name));
  const markerNames = new Set(vars.filter(v => v.expr === v.name).map(v => v.name));
  const propNames = new Set(vars.filter(v => v.expr === `props.${v.name}`).map(v => v.name));
  const refs = collectRefs(body, stateNames, markerNames, propNames)
    .filter(r => r.start >= innerStart && r.end <= innerEnd)
    .sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = innerStart;
  for (const r of refs) {
    out += source.slice(cursor, r.start) + `{{ ${r.name} }}`;
    cursor = r.end;
  }
  out += source.slice(cursor, innerEnd);
  for (const name of callbackPropNames(vars)) {
    out = out.replaceAll(`{{ props.${name} }}?.(`, `{{ props.${name} }}(`);
  }
  return dedent(out);
}

/** Read every @ui-action handler as a `{{ var }}`-template body, templatizing references against `vars`. */
export function readActions(
  program: AstNode,
  comments: Comment[] | undefined,
  source: string,
  vars: BoundVar[],
): CodeAction[] {
  if (!program?.body || !comments) return [];
  const actions: CodeAction[] = [];
  for (const stmt of program.body as AstNode[]) {
    const decl = declOf(stmt);
    if (!decl || decl.type !== 'FunctionDeclaration') continue;
    if (markerFor(comments, stmt.start, source) !== 'action') continue;
    const name = decl.id?.name as string | undefined;
    if (!name) continue;
    const body = decl.body as AstNode | undefined;
    actions.push({ name, template: body ? codeToTemplate(body, source, vars) : '' });
  }
  return actions;
}

/** Whether every `{{ … }}` in the template holds a single identifier (or `props.<name>`), so it resolves to valid code. */
export function isValidTemplate(text: string): boolean {
  const stripped = text.replace(/\{\{\s*(?:props\.)?[A-Za-z_$][\w$]*\s*\}\}/g, '');
  return !stripped.includes('{{') && !stripped.includes('}}');
}

/** Resolve a `{{ var }}` template to code, mapping each placeholder to its variable's expression. */
export function templateToBody(template: string, vars: BoundVar[]): string {
  const byName = new Map(vars.filter(v => !v.expr.startsWith('props.')).map(v => [v.name, v.expr]));
  let code = template.replace(/\{\{\s*((?:props\.)?[A-Za-z_$][\w$]*)\s*\}\}/g, (_m, ref: string) =>
    ref.startsWith('props.') ? ref : (byName.get(ref) ?? ref),
  );
  for (const name of callbackPropNames(vars)) {
    code = code.replaceAll(`props.${name}(`, `props.${name}?.(`);
  }
  return code;
}

/** Splice a handler's body with `code`, re-indented one level; an empty body collapses to `{}`. */
export function setActionBodyEdit(program: AstNode, name: string, code: string): Edit[] {
  const body = findActionBody(program, name);
  if (!body) return [];
  const trimmed = code.replace(/\s+$/, '');
  const text =
    trimmed.trim() === ''
      ? ''
      : '\n' +
        trimmed
          .split('\n')
          .map(l => (l.trim() === '' ? '' : `  ${l}`))
          .join('\n') +
        '\n';
  return [{ start: body.start + 1, end: body.end - 1, text }];
}

/** Remove an entire @ui-action function declaration, including its leading marker comment and a preceding blank line. */
export function removeActionDecl(
  program: AstNode,
  name: string,
  comments: Comment[] | undefined,
  source: string,
): Edit[] {
  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (decl?.type !== 'FunctionDeclaration' || decl.id?.name !== name) continue;
    let start = stmt.start;
    for (const c of comments ?? []) {
      if (
        c.end <= stmt.start &&
        /^\s*$/.test(source.slice(c.end, stmt.start)) &&
        c.value.includes('@ui-action')
      ) {
        start = Math.min(start, c.start);
      }
    }
    while (start > 0 && (source[start - 1] === '\n' || source[start - 1] === ' ')) start--;
    return [{ start, end: stmt.end, text: '' }];
  }
  return [];
}

function hasUiActionType(program: AstNode): boolean {
  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (decl?.type === 'TSTypeAliasDeclaration' && decl.id?.name === 'UiAction') return true;
  }
  return false;
}

/** The `type UiAction = { state; props; value? }` scaffold edit, or null if already present. */
export function uiActionTypeEdit(program: AstNode, componentName: string): Edit | null {
  if (hasUiActionType(program)) return null;
  const at = afterImports(program as { body?: AstNode[] });
  return {
    start: at,
    end: at,
    text: `\n\ntype UiAction = { state: State; props: Parameters<typeof ${componentName}>[0]; value?: unknown }`,
  };
}

function walkCalls(root: AstNode, cb: (call: AstNode) => void): void {
  const visit = (n: any): void => {
    if (!n || typeof n !== 'object' || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression') cb(n);
    for (const k in n) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) {
        for (const el of v) if (el && typeof el === 'object') visit(el);
      } else if (v && typeof v === 'object') {
        visit(v);
      }
    }
  };
  visit(root);
}

/** Rewrite legacy positional @ui-action handlers to the args-object contract, seeding the `UiAction` type and a `props` param when missing; idempotent. */
export function migrateActionsToArgsObject(
  program: AstNode,
  comments: Comment[] | undefined,
  source: string,
  componentName: string,
): Edit[] {
  if (!program?.body || !comments) return [];

  const oldActions = new Map<string, { start: number; end: number }>();
  for (const stmt of program.body as AstNode[]) {
    const decl = declOf(stmt);
    if (!decl || decl.type !== 'FunctionDeclaration') continue;
    if (markerFor(comments, stmt.start, source) !== 'action') continue;
    const name = decl.id?.name as string | undefined;
    if (!name) continue;
    const params = (decl.params ?? []) as AstNode[];
    const first = params[0];
    if (!first || first.type !== 'Identifier' || first.name !== 'state') continue;
    const last = params[params.length - 1];
    oldActions.set(name, { start: first.start, end: last.end });
  }
  if (oldActions.size === 0) return [];

  const edits: Edit[] = [];

  for (const span of oldActions.values()) {
    edits.push({ start: span.start, end: span.end, text: '{ state, props, value }: UiAction' });
  }

  const names = new Set(oldActions.keys());
  walkCalls(program, call => {
    if (call.callee?.type !== 'Identifier' || !names.has(call.callee.name)) return;
    const args = (call.arguments ?? []) as AstNode[];
    if (args.length === 0 || args[0]?.type !== 'Identifier' || args[0].name !== 'state') return;
    const hasValue =
      args.length === 2 && args[1]?.type === 'Identifier' && args[1].name === 'value';
    if (args.length > 2 || (args.length === 2 && !hasValue)) return;
    edits.push({
      start: args[0].start,
      end: args[args.length - 1].end,
      text: hasValue ? '{ state, props, value }' : '{ state, props }',
    });
  });

  const typeEdit = uiActionTypeEdit(program, componentName);
  if (typeEdit) edits.push(typeEdit);
  const propsEdit = ensurePropsParamEdit(program, source, componentName);
  if (propsEdit) edits.push(propsEdit);

  return edits;
}
