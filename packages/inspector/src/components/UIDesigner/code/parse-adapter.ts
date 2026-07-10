import type { Entity } from '@dcl/ecs';

import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, type UINodeType } from '../tree-model';
import { ergonomicToPBTransform } from './ecs-shape';
import type { CodeUINode, ParsedUI, Span } from './types';

// ---------------------------------------------------------------------------
// Minimal OXC/ESTree node shapes we read. OXC emits an ESTree-conformant AST,
// so these mirror the standard node types. We keep them local (rather than
// importing `@oxc-project/types`, a transitive dep) so the adapter is
// self-contained and the surface we depend on is explicit.
// ---------------------------------------------------------------------------
interface Node {
  type: string;
  start: number;
  end: number;
  [k: string]: unknown;
}
type AnyNode = Node & Record<string, any>;

// The four built-in react-ecs UI elements the editor can represent. Any other
// element name (a custom component) becomes an opaque node.
const ELEMENT_TYPE: Record<string, UINodeType> = {
  UiEntity: 'UiEntity',
  Label: 'Label',
  Input: 'Input',
  Dropdown: 'Dropdown',
  Button: 'Button',
};

// Props folded into `uiText` for a Label (kept minimal for the thin slice).
const UI_TEXT_PROPS = new Set(['value', 'fontSize', 'textAlign', 'color', 'font']);

// oxc-parser defaults to `preserveParens: true`, so `( expr )` is wrapped in a
// ParenthesizedExpression node. Peel those off before inspecting an expression.
function unparen(node: AnyNode): AnyNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression as AnyNode;
  return n;
}

// Static-evaluate an expression to a plain JS value. Returns `{ ok: false }`
// for anything non-literal (identifiers, calls, member access) so the caller
// can decide whether to skip the prop or mark the node dynamic.
function evalExpr(input: AnyNode): { ok: true; value: unknown } | { ok: false } {
  const node = unparen(input);
  switch (node.type) {
    case 'Literal':
      return { ok: true, value: node.value };
    case 'UnaryExpression': {
      const arg = evalExpr(node.argument);
      if (!arg.ok) return { ok: false };
      if (node.operator === '-') return { ok: true, value: -(arg.value as number) };
      if (node.operator === '+') return { ok: true, value: +(arg.value as number) };
      if (node.operator === '!') return { ok: true, value: !arg.value };
      return { ok: false };
    }
    case 'ObjectExpression': {
      const r = evalObject(node);
      return { ok: true, value: r.obj };
    }
    case 'ArrayExpression': {
      const out: unknown[] = [];
      for (const el of node.elements as AnyNode[]) {
        if (!el) continue;
        const v = evalExpr(el);
        if (!v.ok) return { ok: false };
        out.push(v.value);
      }
      return { ok: true, value: out };
    }
    default:
      return { ok: false };
  }
}

// Evaluate an ObjectExpression's literal properties. `hadDynamic` is true when
// a value (or a spread) could not be statically evaluated.
function evalObject(node: AnyNode): { obj: Record<string, unknown>; hadDynamic: boolean } {
  const obj: Record<string, unknown> = {};
  let hadDynamic = false;
  for (const prop of node.properties as AnyNode[]) {
    if (prop.type !== 'Property' || prop.computed) {
      hadDynamic = true;
      continue;
    }
    const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
    const v = evalExpr(prop.value);
    if (v.ok) obj[String(key)] = v.value;
    else hadDynamic = true;
  }
  return { obj, hadDynamic };
}

function elementName(el: AnyNode): string | null {
  const name = el.openingElement?.name;
  // We only handle simple <Foo> names; <Foo.Bar> (member) is treated as unknown.
  return name?.type === 'JSXIdentifier' ? (name.name as string) : null;
}

// Pull the JSXAttributes off an opening element into a name→attribute map and a
// flag for whether the element uses any spread ({...x}), which forces opacity.
function readAttributes(el: AnyNode): { attrs: Map<string, AnyNode>; hasSpread: boolean } {
  const attrs = new Map<string, AnyNode>();
  let hasSpread = false;
  for (const a of (el.openingElement?.attributes ?? []) as AnyNode[]) {
    if (a.type === 'JSXSpreadAttribute') {
      hasSpread = true;
      continue;
    }
    if (a.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier') {
      attrs.set(a.name.name as string, a);
    }
  }
  return { attrs, hasSpread };
}

// Resolve a JSXAttribute's value to a static JS value. Handles the two forms:
// bare string (`value="x"` → Literal) and braces (`fontSize={24}` →
// JSXExpressionContainer). Returns `{ ok:false }` for dynamic expressions.
function attrValue(attr: AnyNode): { ok: true; value: unknown } | { ok: false } {
  const v = attr.value as AnyNode | null;
  if (v == null) return { ok: true, value: true }; // bare boolean attr
  if (v.type === 'Literal') return { ok: true, value: v.value };
  if (v.type === 'JSXExpressionContainer') return evalExpr(v.expression);
  return { ok: false };
}

export interface CodeToUINodesOptions {
  // Name of the exported component to read (defaults to the first exported
  // function declaration returning JSX).
  componentName?: string;
}

// Build a code-mode UINode tree from an OXC-parsed program.
// Pure + synchronous so it can be unit-tested in Node (feed it oxc-parser's
// output) and reused at runtime (fed the AST over the parse-RPC bridge).
export function codeToUINodes(
  program: AnyNode,
  source: string,
  options: CodeToUINodesOptions = {},
): ParsedUI | null {
  const rootJsx = findComponentReturnJsx(program, options.componentName);
  if (!rootJsx) return null;

  const spans = new Map<number, Span>();
  const astNodes = new Map<number, AnyNode>();
  let nextId = 1;
  let hasOpaque = false;

  const opaqueNode = (node: AnyNode, reason: string, name: string): CodeUINode => {
    hasOpaque = true;
    const id = nextId++ as unknown as Entity;
    const span: Span = [node.start, node.end];
    spans.set(id as unknown as number, span);
    astNodes.set(id as unknown as number, node);
    return {
      entity: id,
      type: 'UiEntity',
      name,
      span,
      opaque: { reason, raw: source.slice(node.start, node.end) },
      children: [],
    };
  };

  // Map a JSXElement to a CodeUINode. Unknown element names, spreads, and
  // member-expression names collapse the node to opaque.
  const visitElement = (el: AnyNode, parentEntity?: number): CodeUINode => {
    const name = elementName(el);
    if (name == null) return opaqueNode(el, 'member-name-element', 'Unknown');
    const type = ELEMENT_TYPE[name];
    if (!type) return opaqueNode(el, 'custom-component', name);

    const { attrs, hasSpread } = readAttributes(el);
    if (hasSpread) return opaqueNode(el, 'spread-props', name);

    const id = nextId++ as unknown as Entity;
    const span: Span = [el.start, el.end];
    spans.set(id as unknown as number, span);
    astNodes.set(id as unknown as number, el);

    let dynamicProps = false;
    const node: CodeUINode = { entity: id, type, name, span, children: [] };

    const uiTransformAttr = attrs.get('uiTransform');
    if (uiTransformAttr) {
      const v = attrValue(uiTransformAttr);
      // Normalize react-ecs's ergonomic shape → flattened PBUiTransform so the
      // canvas renders it identically to the ECS-backed path.
      if (v.ok) node.uiTransform = ergonomicToPBTransform(v.value as Record<string, unknown>);
      else dynamicProps = true;
    }

    // Record the structural parent (from JSX nesting) as PBUiTransform.parent so
    // the canvas can tell the root (no parent → fills the screen, not
    // draggable/resizable) from children (interactive). Mirrors the ECS shape,
    // where UiTransform always carries a parent entity. The root is visited with
    // no parentEntity, so it keeps no parent.
    if (parentEntity !== undefined) {
      node.uiTransform = {
        ...((node.uiTransform as Record<string, unknown> | undefined) ?? {}),
        parent: parentEntity,
      };
    }

    const uiBackgroundAttr = attrs.get('uiBackground');
    if (uiBackgroundAttr) {
      const v = attrValue(uiBackgroundAttr);
      if (v.ok) node.uiBackground = v.value;
      else dynamicProps = true;
    }

    // Label text props fold into uiText.
    if (type === 'Label') {
      const uiText: Record<string, unknown> = {};
      for (const key of UI_TEXT_PROPS) {
        const attr = attrs.get(key);
        if (!attr) continue;
        const v = attrValue(attr);
        if (v.ok) uiText[key] = v.value;
        else dynamicProps = true;
      }
      if (Object.keys(uiText).length > 0) node.uiText = uiText;
    }

    if (dynamicProps) node.dynamicProps = true;

    // Children.
    for (const child of (el.children ?? []) as AnyNode[]) {
      const mapped = visitChild(child, type, id as unknown as number);
      if (mapped) node.children.push(mapped);
    }
    return node;
  };

  // Map a JSX child. Elements recurse; text folds into a Label's value;
  // expression containers that aren't a simple literal become opaque children
  // (loops via `.map`, conditionals, variable refs).
  const visitChild = (
    child: AnyNode,
    parentType: UINodeType,
    parentEntity: number,
  ): CodeUINode | null => {
    if (child.type === 'JSXElement') return visitElement(child, parentEntity);
    if (child.type === 'JSXText') {
      const text = String(child.value ?? '').trim();
      if (text && parentType === 'Label') {
        // Fold literal text into the Label's uiText.value if not already set.
        return null; // handled at element level via `value`; keep tree clean
      }
      return null; // whitespace / non-Label text is ignored
    }
    if (child.type === 'JSXExpressionContainer') {
      const expr = unparen(child.expression as AnyNode);
      if (expr?.type === 'Literal' && parentType === 'Label') return null;
      const reason = isMapCall(expr)
        ? 'loop'
        : expr?.type === 'ConditionalExpression' || expr?.type === 'LogicalExpression'
          ? 'conditional'
          : 'expression';
      return opaqueNode(child, reason, reason === 'loop' ? 'Repeater' : 'Expression');
    }
    return null;
  };

  const root = visitElement(rootJsx);
  // The design-canvas size isn't expressed in code yet (comes from the
  // renderer's virtual resolution / a manifest later). Default it so the canvas
  // has a fixed stage to render into. TODO(M5): read from the setUiRenderer call
  // or the .dcl-ui.json manifest.
  root.canvasWidth = DEFAULT_CANVAS_WIDTH;
  root.canvasHeight = DEFAULT_CANVAS_HEIGHT;
  return { root, spans, astNodes, hasOpaque };
}

// Detect `x.map(...)` — the common list-rendering pattern.
function isMapCall(expr: AnyNode | undefined): boolean {
  return (
    !!expr &&
    expr.type === 'CallExpression' &&
    expr.callee?.type === 'MemberExpression' &&
    expr.callee.property?.type === 'Identifier' &&
    expr.callee.property.name === 'map'
  );
}

// Find the JSX returned by the target exported component. Recognizes the common
// react-ecs component forms (the stock scene template uses the arrow/const one):
//   export function X() { return <jsx/> }   |  function X() { return <jsx/> }
//   export const X = () => <jsx/>            (arrow, concise body)
//   export const X = () => (<jsx/>)          (arrow, parenthesized body)
//   export const X = () => { return <jsx/> } (arrow, block body)
//   export const X = function () { … }       (function expression)
//   const X = () => <jsx/>
// The first declaration whose body yields a single JSXElement wins, so helpers
// that return no JSX (e.g. the template's `setupUi`) are skipped. A
// `componentName` pins a specific one (and returns null if it isn't JSX).
function findComponentReturnJsx(program: AnyNode, componentName?: string): AnyNode | null {
  for (const stmt of (program.body ?? []) as AnyNode[]) {
    const decl =
      stmt.type === 'ExportNamedDeclaration' && stmt.declaration
        ? (stmt.declaration as AnyNode)
        : stmt;

    if (decl.type === 'FunctionDeclaration') {
      if (componentName && decl.id?.name !== componentName) continue;
      const jsx = fnBodyJsx(decl.body);
      if (jsx) return jsx;
      if (componentName) return null;
      continue;
    }

    if (decl.type === 'VariableDeclaration') {
      for (const d of (decl.declarations ?? []) as AnyNode[]) {
        if (componentName && d.id?.name !== componentName) continue;
        const init = d.init ? unparen(d.init as AnyNode) : undefined;
        if (
          !init ||
          (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')
        )
          continue;
        const jsx = fnBodyJsx(init.body as AnyNode | undefined);
        if (jsx) return jsx;
        if (componentName) return null;
      }
    }
  }
  return null;
}

// Source span of the exported component's *identifier* (for a rename splice).
// Recognizes the same forms as findComponentReturnJsx. Returns null if no
// declaration named `componentName` is found. We rename only this token, never
// string literals (e.g. a Label's value) that happen to contain the name.
export function findComponentIdSpan(
  program: AnyNode,
  componentName: string,
): { start: number; end: number } | null {
  for (const stmt of (program.body ?? []) as AnyNode[]) {
    const decl =
      stmt.type === 'ExportNamedDeclaration' && stmt.declaration
        ? (stmt.declaration as AnyNode)
        : stmt;
    if (decl.type === 'FunctionDeclaration' && decl.id?.name === componentName) {
      return { start: decl.id.start, end: decl.id.end };
    }
    if (decl.type === 'VariableDeclaration') {
      for (const d of (decl.declarations ?? []) as AnyNode[]) {
        if (d.id?.type === 'Identifier' && d.id.name === componentName) {
          return { start: d.id.start, end: d.id.end };
        }
      }
    }
  }
  return null;
}

// Extract a single returned JSXElement from a function/arrow body: either a
// concise arrow body (`=> <jsx/>` / `=> (<jsx/>)`, where the body IS the
// expression) or a block body with a `return <jsx/>`. Fragments and non-JSX
// returns aren't representable as a single root yet → null.
function fnBodyJsx(body: AnyNode | undefined): AnyNode | null {
  if (!body) return null;
  if (body.type !== 'BlockStatement') {
    const arg = unparen(body);
    return arg.type === 'JSXElement' ? arg : null;
  }
  for (const stmt of (body.body ?? []) as AnyNode[]) {
    if (stmt.type === 'ReturnStatement' && stmt.argument) {
      const arg = unparen(stmt.argument as AnyNode);
      return arg.type === 'JSXElement' ? arg : null;
    }
  }
  return null;
}
