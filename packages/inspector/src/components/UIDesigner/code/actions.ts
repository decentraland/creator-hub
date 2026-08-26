// The "action" surface — event-handler callbacks the editor can author. A
// callback is a top-level `/** @ui-action */` function that takes the `state`
// object as its parameter and mutates it:
//
//   /** @ui-action */
//   function onIncrement(state: State) {
//     state.counter += 1
//   }
//
// Passing `state` in (rather than closing over the module const) keeps the
// handler a pure function of state and side-steps use-before-declaration when the
// function is emitted above the `state` const. Events bind through a thunk:
// `onMouseDown={() => onIncrement(state)}`.
//
// The body is edited as a `{{ var }}` TEMPLATE: a bound-variable reference
// (`state.counter` for a typed-state var, a bare `counter` for a /** @ui-bind */
// marker) is shown as `{{ counter }}`, so the author never has to know which form
// a variable takes. Read (code → template) is AST-accurate; write (template →
// code) resolves each `{{ name }}` to that variable's expression. Everything else
// in the body is literal code, so any handler round-trips. Dependency-free
// (AST-span based) and unit-testable.

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

// A bound variable the template can reference: `name` is what appears inside
// `{{ }}`, `expr` is the code it resolves to (`state.name` / `props.name` / bare
// marker `name`). `type` distinguishes a callback input (invoked optional-chained
// in code) from a value.
export interface BoundVar {
  name: string;
  expr: string;
  type?: string;
}

// Names of callback-typed PROPS. Invoking one in a handler body is optional-
// chained in CODE (`props.x?.(…)` — editor inputs are always optional), but shown
// clean in the template (`{{ props.x }}(…)`); the `?.` is added on write and
// stripped on read so it lives code-side only.
function callbackPropNames(vars: BoundVar[]): string[] {
  return vars.filter(v => v.type === 'callback' && v.expr === `props.${v.name}`).map(v => v.name);
}

export interface CodeAction {
  name: string;
  // The handler body rendered with `{{ var }}` placeholders, dedented for editing.
  template: string;
}

function declOf(stmt: AstNode): AstNode | undefined {
  return stmt.type === 'ExportNamedDeclaration' ? (stmt.declaration as AstNode) : stmt;
}

// The BlockStatement body of the named @ui-action function (for span math).
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

// Walk a body AST collecting the spans of bound-variable references: a
// `state.<name>` member-expression (name ∈ stateNames), a `props.<name>`
// member-expression (name ∈ propNames), or a bare identifier reference to a
// marker var (name ∈ markerNames) that ISN'T a property key, member property, or
// declaration id (those aren't references). `parent` is tracked so those
// non-reference positions can be excluded.
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
      return; // don't recurse into the `state` object / property identifiers
    }

    // `props.<name>` — a component input referenced in the handler (args object).
    // Templatized as the QUALIFIED `{{ props.<name> }}` so it can't collide with a
    // same-named state variable.
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

// Strip leading/trailing blank lines and the common indentation, so the body
// edits as clean left-aligned lines in the textarea.
function dedent(s: string): string {
  const lines = s.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const indents = lines.filter(l => l.trim() !== '').map(l => l.match(/^\s*/)?.[0].length ?? 0);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map(l => l.slice(min).replace(/\s+$/, '')).join('\n');
}

// Render a handler body (code) as a `{{ var }}` template.
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
  // A callback input's `?.` is code-side only — strip it so the template shows a
  // clean `{{ props.x }}(…)` call. templateToBody re-adds it on write.
  for (const name of callbackPropNames(vars)) {
    out = out.replaceAll(`{{ props.${name} }}?.(`, `{{ props.${name} }}(`);
  }
  return dedent(out);
}

// Read every @ui-action handler as a `{{ var }}`-template body. `vars` is the
// binding surface (state + marker), so references can be templatized.
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

// A `{{ var }}` template is well-formed when every `{{ … }}` holds a single
// identifier (or a `props.<name>` input reference), so it resolves to valid code.
// Strip well-formed placeholders; any `{{` or `}}` left is malformed — a space in
// the name (`{{ none prope }}`), an unclosed `{{`, or a stray `}}` — which would
// splice invalid code. The editor uses this to mark the body invalid and NOT sync
// it (a local guard on top of the store's don't-persist-syntax-errors backstop).
export function isValidTemplate(text: string): boolean {
  const stripped = text.replace(/\{\{\s*(?:props\.)?[A-Za-z_$][\w$]*\s*\}\}/g, '');
  return !stripped.includes('{{') && !stripped.includes('}}');
}

// Resolve a `{{ var }}` template to code: a bare `{{ name }}` → that variable's
// expression (`state.name` / bare marker `name`); a qualified `{{ props.name }}`
// → `props.name` (itself). Bare names never resolve to props — props are always
// qualified — so a state var and a prop of the same name can't collide.
export function templateToBody(template: string, vars: BoundVar[]): string {
  const byName = new Map(vars.filter(v => !v.expr.startsWith('props.')).map(v => [v.name, v.expr]));
  let code = template.replace(/\{\{\s*((?:props\.)?[A-Za-z_$][\w$]*)\s*\}\}/g, (_m, ref: string) =>
    ref.startsWith('props.') ? ref : (byName.get(ref) ?? ref),
  );
  // Callback inputs are optional — invoke them optional-chained in code (a no-op
  // if the parent didn't wire them). Idempotent: `props.x(` matches, an already
  // optional-chained `props.x?.(` does not.
  for (const name of callbackPropNames(vars)) {
    code = code.replaceAll(`props.${name}(`, `props.${name}?.(`);
  }
  return code;
}

// Splice a handler's body with `code`, re-indented one level. An empty body
// collapses to `{}`.
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

// Remove an entire @ui-action function declaration, including its leading
// `/** @ui-action */` comment and a preceding blank line.
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

// --- Migration: legacy positional handlers → the args-object contract ---
//
// Old form: a top-level `function h(state: State, value?: unknown)` bound via
// `() => h(state)`. New form: `function h({ state, props, value }: UiAction)`
// bound via `() => h({ state, props })`, so a handler can read props (call a
// callback the parent passed) and `{{ props.x }}` works. The migration rewrites
// legacy handlers + their thunks + seeds the `UiAction` type and a `props` param.

function hasUiActionType(program: AstNode): boolean {
  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (decl?.type === 'TSTypeAliasDeclaration' && decl.id?.name === 'UiAction') return true;
  }
  return false;
}

// The `type UiAction = { state; props; value? }` scaffold edit, or null if present.
// `props` references the component's OWN inline props type, so adding/removing a
// prop never touches this alias or any thunk.
export function uiActionTypeEdit(program: AstNode, componentName: string): Edit | null {
  if (hasUiActionType(program)) return null;
  const at = afterImports(program as { body?: AstNode[] });
  return {
    start: at,
    end: at,
    text: `\n\ntype UiAction = { state: State; props: Parameters<typeof ${componentName}>[0]; value?: unknown }`,
  };
}

// Visit every CallExpression under `root`.
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

// Rewrite legacy positional @ui-action handlers to the args-object contract, plus
// seed the `UiAction` type and a `props: {}` param when missing. Returns [] (a
// no-op) when nothing is old-form, so it's idempotent — re-running on migrated
// source changes nothing.
export function migrateActionsToArgsObject(
  program: AstNode,
  comments: Comment[] | undefined,
  source: string,
  componentName: string,
): Edit[] {
  if (!program?.body || !comments) return [];

  // Old-form handlers: an @ui-action FunctionDeclaration whose FIRST param is the
  // identifier `state` (the new form is a `{ … }` ObjectPattern).
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

  // Handler signatures → the destructured args object.
  for (const span of oldActions.values()) {
    edits.push({ start: span.start, end: span.end, text: '{ state, props, value }: UiAction' });
  }

  // Thunk calls: name(state) / name(state, value) → name({ state, props[, value] }).
  // An unrecognized argument shape is left untouched (never corrupt a hand call).
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

  // Seed the UiAction type + a props param so the rewritten handlers typecheck.
  const typeEdit = uiActionTypeEdit(program, componentName);
  if (typeEdit) edits.push(typeEdit);
  const propsEdit = ensurePropsParamEdit(program, source, componentName);
  if (propsEdit) edits.push(propsEdit);

  return edits;
}
