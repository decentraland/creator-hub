import type { Entity } from '@dcl/ecs';

import {
  type CanvasBindingRow,
  type CanvasSegment,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  type UINodeType,
} from '../tree-model';

// Segment-kind string values ('literal' / 'binding') — the values
// previewBoundText compares against (tree-model's SegmentKind). Kept as local
// constants so this pure parser has no value imports beyond types.
const SEG_LITERAL = 'literal';
const SEG_BINDING = 'binding';
import { ergonomicToPBBackground, ergonomicToPBText, ergonomicToPBTransform } from './ecs-shape';
import {
  findInteractionForSpread,
  INTERACTION_STATES,
  type InteractionAst,
  type InteractionStateKey,
  soleSpreadArgument,
} from './interaction-convention';
import {
  branchElement,
  componentStatements,
  parsePlatformConditional,
  type PlatformVariantAst,
  PLATFORMS,
} from './platform-convention';
import type { CodeUINode, ComponentRefProp, InteractionStateStyles, ParsedUI, Span } from './types';

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

// Props folded into `uiText` for a Label / Button (Button extends
// UiLabelProps in react-ecs).
const UI_TEXT_PROPS = new Set(['value', 'fontSize', 'textAlign', 'color', 'font', 'textWrap']);

// Props folded into `uiInput` for an Input (react-ecs UiInputProps —
// PBUiInput fields with textAlign/font as ergonomic strings).
const UI_INPUT_PROPS = new Set([
  'placeholder',
  'value',
  'color',
  'placeholderColor',
  'disabled',
  'textAlign',
  'font',
  'fontSize',
]);

// Props folded into `uiDropdown` for a Dropdown (react-ecs UiDropdownProps).
const UI_DROPDOWN_PROPS = new Set([
  'acceptEmpty',
  'emptyLabel',
  'options',
  'selectedIndex',
  'disabled',
  'color',
  'textAlign',
  'font',
  'fontSize',
]);

// Which prop set folds into which node field, per element type.
const TYPED_PROP_GROUPS: Partial<
  Record<
    UINodeType,
    { props: Set<string>; field: 'uiText' | 'uiInput' | 'uiDropdown'; componentId: string }
  >
> = {
  Label: { props: UI_TEXT_PROPS, field: 'uiText', componentId: 'core::UiText' },
  Button: { props: UI_TEXT_PROPS, field: 'uiText', componentId: 'core::UiText' },
  Input: { props: UI_INPUT_PROPS, field: 'uiInput', componentId: 'core::UiInput' },
  Dropdown: { props: UI_DROPDOWN_PROPS, field: 'uiDropdown', componentId: 'core::UiDropdown' },
};

// oxc-parser defaults to `preserveParens: true`, so `( expr )` is wrapped in a
// ParenthesizedExpression node. Peel those off before inspecting an expression.
function unparen(node: AnyNode): AnyNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression as AnyNode;
  return n;
}

// Static-evaluate an expression to a plain JS value. Returns `{ ok: false }`
// for anything non-literal (identifiers, calls, member access) so the caller
// can decide whether to skip the prop or mark the node dynamic. For object
// literals the evaluation is PARTIAL: unevaluable fields/spreads are dropped
// from the value and reported via `dynamic: true` — the caller MUST treat a
// dynamic result as read-only (a write re-emitting the partial value would
// erase the dynamic parts from source).
function evalExpr(input: AnyNode): { ok: true; value: unknown; dynamic?: boolean } | { ok: false } {
  const node = unparen(input);
  switch (node.type) {
    case 'Literal':
      return { ok: true, value: node.value };
    case 'UnaryExpression': {
      const arg = evalExpr(node.argument);
      if (!arg.ok) return { ok: false };
      if (node.operator === '-')
        return { ok: true, value: -(arg.value as number), dynamic: arg.dynamic };
      if (node.operator === '+')
        return { ok: true, value: +(arg.value as number), dynamic: arg.dynamic };
      if (node.operator === '!') return { ok: true, value: !arg.value, dynamic: arg.dynamic };
      return { ok: false };
    }
    case 'ObjectExpression': {
      const r = evalObject(node);
      return { ok: true, value: r.obj, dynamic: r.hadDynamic || undefined };
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
// a value (or a spread, or any NESTED value) could not be statically evaluated.
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
    if (v.ok) {
      obj[String(key)] = v.value;
      if (v.dynamic) hadDynamic = true;
    } else {
      hadDynamic = true;
    }
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
// JSXExpressionContainer). Returns `{ ok:false }` for dynamic expressions;
// `dynamic: true` flags a PARTIALLY-static object (some fields unevaluable) —
// display it, never re-emit it.
function attrValue(attr: AnyNode): { ok: true; value: unknown; dynamic?: boolean } | { ok: false } {
  const v = attr.value as AnyNode | null;
  if (v == null) return { ok: true, value: true }; // bare boolean attr
  if (v.type === 'Literal') return { ok: true, value: v.value };
  if (v.type === 'JSXExpressionContainer') return evalExpr(v.expression);
  return { ok: false };
}

// If an expression is a simple variable reference — `ident` or `obj.prop` (the
// code-as-source binding form, e.g. `state.score`) — return its verbatim source
// text; else null. This is what lets the panel show the field as bound (and
// re-bind it) rather than collapsing the whole node to opaque dynamic content.
// Expression-level so both the JSX-attribute path and the interaction-layer
// path (where a bound prop is an object-property value, with no
// JSXExpressionContainer to unwrap) can share it.
function bindingExprOf(expr: AnyNode | undefined, source: string): string | null {
  if (!expr) return null;
  const e = unparen(expr);
  if (e && (e.type === 'Identifier' || e.type === 'MemberExpression')) {
    return source.slice(e.start, e.end);
  }
  return null;
}

function bindingExpr(attr: AnyNode, source: string): string | null {
  const v = attr.value as AnyNode | null;
  if (v?.type !== 'JSXExpressionContainer') return null;
  return bindingExprOf(v.expression as AnyNode, source);
}

// Extract the handler NAME an event attr is bound to, from either the thunk form
// the editor writes (`onMouseDown={() => onClick(state)}`) or a bare reference
// (`onMouseDown={onClick}`, e.g. hand-authored). Returns null for anything else
// (an inline arrow with a body, a dynamic expression). The name is what the panel
// shows as bound; re-binding always re-emits the thunk.
function handlerNameOfExpr(expr: AnyNode | undefined): string | null {
  if (!expr) return null;
  const e = unparen(expr);
  if (e.type === 'Identifier') return e.name as string;
  if (e.type === 'ArrowFunctionExpression') {
    const body = unparen(e.body as AnyNode);
    if (body.type === 'CallExpression' && body.callee?.type === 'Identifier') {
      return body.callee.name as string;
    }
  }
  return null;
}

function eventHandlerName(attr: AnyNode): string | null {
  const v = attr.value as AnyNode | null;
  if (v?.type !== 'JSXExpressionContainer') return null;
  return handlerNameOfExpr(v.expression as AnyNode);
}

// A `` `literal ${expr} …` `` template literal → ordered mixed-content segments
// (literal quasis + `${expr}` bindings), so the mixed editor round-trips a
// code-authored interpolated string. Returns null for anything that isn't a
// template literal or that interpolates a non-simple expression. Expression-level
// for the same reason as bindingExprOf.
function templateSegmentsOf(input: AnyNode | undefined, source: string): CanvasSegment[] | null {
  if (!input) return null;
  const e = unparen(input);
  if (!e || e.type !== 'TemplateLiteral') return null;
  const quasis = (e.quasis ?? []) as AnyNode[];
  const exprs = (e.expressions ?? []) as AnyNode[];
  const segs: CanvasSegment[] = [];
  for (let i = 0; i < quasis.length; i++) {
    const cooked = (quasis[i].value as { cooked?: string })?.cooked ?? '';
    if (cooked) segs.push({ kind: SEG_LITERAL, value: cooked });
    if (i < exprs.length) {
      const expr = unparen(exprs[i]);
      if (expr.type !== 'Identifier' && expr.type !== 'MemberExpression') return null;
      segs.push({ kind: SEG_BINDING, value: source.slice(expr.start, expr.end) });
    }
  }
  return segs;
}

function templateSegments(attr: AnyNode, source: string): CanvasSegment[] | null {
  const v = attr.value as AnyNode | null;
  if (v?.type !== 'JSXExpressionContainer') return null;
  return templateSegmentsOf(v.expression as AnyNode, source);
}

// Event-handler attrs → the field-config componentId the panel keys their
// bindings under (mirrors field-configs' event groups): mouse events in the
// editor-internal `ui::events` namespace; onChange/onSubmit on the
// Input/Dropdown component. Returns null for a non-event attr.
function eventFieldKey(type: UINodeType, attr: string): string | null {
  if (
    attr === 'onMouseDown' ||
    attr === 'onMouseUp' ||
    attr === 'onMouseEnter' ||
    attr === 'onMouseLeave'
  )
    return `ui::events.${attr}`;
  if (attr === 'onChange' || attr === 'onSubmit')
    return `${type === 'Dropdown' ? 'core::UiDropdown' : 'core::UiInput'}.${attr}`;
  return null;
}

// Read one interaction layer's object literal into the PB-shaped bags the panel
// and canvas consume — the object-literal counterpart of visitElement's
// attribute reading. Unknown props are left alone (writes are surgical, so
// hand-authored extras survive); a non-static uiTransform/uiBackground marks the
// layer dynamic, matching the JSX-attribute path's safety rule.
function readInteractionLayer(
  obj: AnyNode,
  type: UINodeType,
  source: string,
): {
  styles: InteractionStateStyles;
  events: Map<string, string>;
  bound: CanvasBindingRow[];
  dynamic: boolean;
} {
  const styles: InteractionStateStyles = {};
  const events = new Map<string, string>();
  const bound: CanvasBindingRow[] = [];
  const textValues: Record<string, unknown> = {};
  const group = TYPED_PROP_GROUPS[type];
  let dynamic = false;

  for (const prop of (obj.properties ?? []) as AnyNode[]) {
    if (prop.type !== 'Property' || prop.computed) {
      dynamic = true;
      continue;
    }
    const key = String(prop.key.type === 'Identifier' ? prop.key.name : prop.key.value);
    const valueNode = prop.value as AnyNode;

    if (key === 'uiTransform' || key === 'uiBackground') {
      const v = evalExpr(valueNode);
      if (!v.ok) {
        dynamic = true;
        continue;
      }
      if (v.dynamic) dynamic = true;
      const bag = v.value as Record<string, unknown>;
      styles[key] =
        key === 'uiTransform' ? ergonomicToPBTransform(bag) : ergonomicToPBBackground(bag);
      continue;
    }

    if (eventFieldKey(type, key)) {
      const handler = handlerNameOfExpr(valueNode);
      if (handler) events.set(key, handler);
      continue;
    }

    if (group?.props.has(key)) {
      const v = evalExpr(valueNode);
      if (v.ok && !v.dynamic) {
        textValues[key] = v.value;
        continue;
      }
      // A prop bound to a variable or an interpolated template is a RECOGNIZED
      // construct, not unevaluable content — record it as a binding row exactly
      // as the JSX-attribute path does. Marking the layer dynamic here instead
      // would drop the value from the canvas AND freeze every panel edit on the
      // node, so wrapping a bound element in interaction states silently
      // downgraded it.
      const field = `${group.componentId}.${key}`;
      const segments = templateSegmentsOf(valueNode, source);
      const expr = bindingExprOf(valueNode, source);
      if (segments) bound.push({ field, variable: '', segments });
      else if (expr) bound.push({ field, variable: expr });
      else dynamic = true;
    }
  }

  // File the typed props under the SAME node field the JSX path uses
  // (uiText / uiInput / uiDropdown), so the panel's componentId → field mapping
  // resolves a layer's value exactly like it resolves the element's.
  if (group && Object.keys(textValues).length > 0) {
    styles[group.field] = ergonomicToPBText(textValues);
  }
  return { styles, events, bound, dynamic };
}

// Whether an attribute is one the editor models as a style or an event — and so
// one that can MOVE into an interaction layer when a node gains interaction
// states. Unmodeled attributes (`key`, anything hand-authored the editor doesn't
// understand) stay on the element, where the layer spread can't clobber them.
export function isLayerableProp(type: UINodeType, name: string): boolean {
  if (name === 'uiTransform' || name === 'uiBackground') return true;
  if (eventFieldKey(type, name)) return true;
  return TYPED_PROP_GROUPS[type]?.props.has(name) ?? false;
}

export interface CodeToUINodesOptions {
  // Name of the exported component to read (defaults to the first exported
  // function declaration returning JSX).
  componentName?: string;
  // Names of OTHER editor roots that may be used as components. A JSX element
  // whose name is in this set (e.g. `<OtroNOmbre />`) becomes a first-class
  // `component-ref` node instead of an opaque block. Everything else unknown
  // stays opaque.
  knownComponents?: string[];
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
  // The component function, so a `{...btn}` spread can be resolved to the
  // `const btn = useInteraction(…)` declared in its body.
  const componentFn = findComponentFn(program, options.componentName);
  // Its statements, so a `platform === 'mobile' ? …` test can be resolved to the
  // `const platform = usePlatform()` declared in the same scope.
  const fnStatements = componentStatements(componentFn);

  const spans = new Map<number, Span>();
  const astNodes = new Map<number, AnyNode>();
  const known = new Set(options.knownComponents ?? []);
  let nextId = 1;
  let hasOpaque = false;

  // A reference to another editor root used as a component. First-class (not
  // opaque): its span/AST are registered so move/remove/duplicate splices work.
  // Its own children (react-ecs slots) are not walked here — the inline preview
  // comes from resolving the referenced file (store.augmentComponentRefs); the
  // structural parent is recorded on uiTransform so the canvas lays it out.
  const componentRefNode = (node: AnyNode, name: string, parentEntity?: number): CodeUINode => {
    const id = nextId++ as unknown as Entity;
    const span: Span = [node.start, node.end];
    spans.set(id as unknown as number, span);
    astNodes.set(id as unknown as number, node);
    // Parse the values set on THIS instance (`<Name title="Hi" n={5} x={expr} />`)
    // so the panel shows + edits them per instance.
    const { attrs } = readAttributes(node);
    const props: ComponentRefProp[] = [];
    for (const [attrName, attr] of attrs) {
      const v = attrValue(attr);
      if (v.ok) {
        props.push({ name: attrName, value: v.value as string | number | boolean });
      } else {
        const e = (attr.value as AnyNode | null)?.expression as AnyNode | undefined;
        props.push({ name: attrName, expr: e ? source.slice(e.start, e.end) : '' });
      }
    }
    return {
      entity: id,
      type: 'UiEntity',
      name,
      span,
      componentRef: { name, props },
      uiTransform: parentEntity !== undefined ? { parent: parentEntity } : undefined,
      children: [],
    };
  };

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

  // A recognized platform conditional → a pass-through node holding one child per
  // authored branch. The branches are visited with the CONDITIONAL's parent, not
  // the variant's id: the variant contributes no box of its own, so each branch
  // must lay out exactly where the conditional sits (and a root-level variant's
  // branches stay parentless, i.e. full-screen roots).
  const platformVariantNode = (v: PlatformVariantAst, parentEntity?: number): CodeUINode => {
    const id = nextId++ as unknown as Entity;
    const span: Span = [v.outer.start, v.outer.end];
    spans.set(id as unknown as number, span);
    astNodes.set(id as unknown as number, v.outer);
    const children: CodeUINode[] = [];
    for (const platform of PLATFORMS) {
      const el = branchElement(v[platform]);
      if (!el) continue;
      const child = visitElement(el, parentEntity);
      child.platform = platform;
      children.push(child);
    }
    return {
      entity: id,
      type: 'UiEntity',
      name: 'Platform',
      span,
      platformVariant: true,
      children,
    };
  };

  // Map a JSXElement to a CodeUINode. Unknown element names, spreads, and
  // member-expression names collapse the node to opaque.
  const visitElement = (el: AnyNode, parentEntity?: number): CodeUINode => {
    const name = elementName(el);
    if (name == null) return opaqueNode(el, 'member-name-element', 'Unknown');
    const type = ELEMENT_TYPE[name];
    if (!type) {
      // A known editor root used as a component → a first-class reference node;
      // any other unknown element stays opaque (edit in code).
      if (known.has(name)) return componentRefNode(el, name, parentEntity);
      return opaqueNode(el, 'custom-component', name);
    }

    const { attrs, hasSpread } = readAttributes(el);
    // A spread is representable ONLY when it is a recognized interaction call
    // (`{...btn}` where `const btn = useInteraction({…})`); the node then keeps
    // its styles in that call's layers. Any other spread stays opaque.
    let interaction: InteractionAst | null = null;
    if (hasSpread) {
      interaction = findInteractionForSpread(soleSpreadArgument(el), componentFn);
      if (!interaction) return opaqueNode(el, 'spread-props', name);
    }

    const id = nextId++ as unknown as Entity;
    const span: Span = [el.start, el.end];
    spans.set(id as unknown as number, span);
    astNodes.set(id as unknown as number, el);

    let dynamicProps = false;
    const node: CodeUINode = { entity: id, type, name, span, children: [] };
    // Simple-expression bindings on this element (text props + event handlers),
    // keyed by the panel's `componentId.field` so a bound attribute previews on
    // the canvas and shows as bound in the panel.
    const bindings: CanvasBindingRow[] = [];

    // Interaction layers. The node renders its `base` layer, so hydrate the
    // regular style fields from it — everything downstream (canvas, panel)
    // then treats the node like any other. Hydration happens BEFORE the
    // attribute reads below so a co-authored attribute still wins, mirroring
    // JSX precedence for `<X {...btn} attr={…} />`.
    if (interaction) {
      const states: Partial<Record<InteractionStateKey, InteractionStateStyles>> = {};
      for (const key of INTERACTION_STATES) {
        const layer = interaction.states.get(key);
        if (!layer) continue;
        const { styles, events, bound, dynamic } = readInteractionLayer(layer.object, type, source);
        states[key] = styles;
        if (dynamic) dynamicProps = true;
        if (key !== 'base') continue;
        // Bound typed props surface as bindings, like the JSX path — the canvas
        // reads them through previewBoundText, so without this a bound `value`
        // renders as empty text.
        bindings.push(...bound);
        if (styles.uiTransform) node.uiTransform = styles.uiTransform;
        if (styles.uiBackground) node.uiBackground = styles.uiBackground;
        if (styles.uiText) node.uiText = styles.uiText;
        if (styles.uiInput) node.uiInput = styles.uiInput;
        if (styles.uiDropdown) node.uiDropdown = styles.uiDropdown;
        // Event handlers live in the base layer (the helper chains them), so
        // they surface as bindings exactly like a JSX event attribute would.
        for (const [attrName, handler] of events) {
          const field = eventFieldKey(type, attrName);
          if (field) bindings.push({ field, variable: handler });
        }
      }
      node.interaction = {
        states,
        activeExpr: interaction.activeArg
          ? source.slice(interaction.activeArg.start, interaction.activeArg.end)
          : undefined,
        name: interaction.name,
      };
    }

    const uiTransformAttr = attrs.get('uiTransform');
    if (uiTransformAttr) {
      const v = attrValue(uiTransformAttr);
      // Normalize react-ecs's ergonomic shape → flattened PBUiTransform so the
      // canvas renders it identically to the ECS-backed path. A PARTIALLY
      // static object (e.g. `{ width: state.w, height: 100 }`) still renders
      // from its static fields but marks the node dynamic so no write path
      // re-emits the lossy value over the source.
      if (v.ok) {
        node.uiTransform = ergonomicToPBTransform(v.value as Record<string, unknown>);
        if (v.dynamic) dynamicProps = true;
      } else {
        dynamicProps = true;
      }
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
      if (v.ok) {
        // Normalize react-ecs's ergonomic background (string enums, bare
        // texture object) → the flattened-PB shape the panel reads.
        node.uiBackground = ergonomicToPBBackground(v.value as Record<string, unknown>);
        if (v.dynamic) dynamicProps = true;
      } else {
        dynamicProps = true;
      }
    }

    // Typed element props fold into their node field (Label/Button → uiText,
    // Input → uiInput, Dropdown → uiDropdown); a prop bound to a variable
    // (`value={state.x}`) or an interpolated template (`value={`Hi ${name}`}`)
    // is recorded as a binding row instead — previewed on the canvas via
    // previewBoundText and shown as bound in the panel — rather than collapsing
    // the node to opaque dynamic content.
    const group = TYPED_PROP_GROUPS[type];
    if (group) {
      const values: Record<string, unknown> = {};
      for (const key of group.props) {
        const attr = attrs.get(key);
        if (!attr) continue;
        const v = attrValue(attr);
        if (v.ok) {
          values[key] = v.value;
          continue;
        }
        const field = `${group.componentId}.${key}`;
        const segments = templateSegments(attr, source);
        const expr = bindingExpr(attr, source);
        if (segments) bindings.push({ field, variable: '', segments });
        else if (expr) bindings.push({ field, variable: expr });
        else dynamicProps = true;
      }
      // Normalize react-ecs's ergonomic text enums (textAlign/font strings) to
      // the flattened numeric enums the canvas + PropertyPanel read.
      if (Object.keys(values).length > 0) node[group.field] = ergonomicToPBText(values);
    }

    // Event-handler bindings — the thunk `onMouseDown={() => onClick(state)}` the
    // editor writes (or a bare `onMouseDown={onClick}`). Record the handler NAME
    // as the bound value; handlers are never static so they don't fold into a
    // component value.
    for (const [attrName, attr] of attrs) {
      const field = eventFieldKey(type, attrName);
      if (!field) continue;
      const handler = eventHandlerName(attr);
      if (handler) bindings.push({ field, variable: handler });
    }

    if (bindings.length > 0) node.bindings = bindings;
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
      const variant = parsePlatformConditional(child, fnStatements);
      if (variant) return platformVariantNode(variant, parentEntity);
      const reason = isMapCall(expr)
        ? 'loop'
        : expr?.type === 'ConditionalExpression' || expr?.type === 'LogicalExpression'
          ? 'conditional'
          : 'expression';
      return opaqueNode(child, reason, reason === 'loop' ? 'Repeater' : 'Expression');
    }
    return null;
  };

  // The component may return a platform conditional instead of an element
  // (findComponentReturnJsx accepts both).
  const rootVariant = parsePlatformConditional(rootJsx, fnStatements);
  const root = rootVariant ? platformVariantNode(rootVariant) : visitElement(rootJsx);
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

// The component's function node (a FunctionDeclaration, or the arrow / function
// expression assigned to a `const`) — the node whose `.body` we splice to place
// the FIRST element into an empty root, and whose statements hold the
// `const x = useInteraction(…)` a `{...x}` spread resolves against. Mirrors
// findComponentReturnJsx's forms.
//
// Without a `componentName` it must agree with findComponentReturnJsx, which
// SKIPS functions that return no JSX: otherwise a helper declared before the
// component (a `/** @ui-action */` handler, which addBindAction inserts right
// after the imports) is picked instead, and every lookup against the component's
// scope silently fails — a spread then resolves to nothing and its node
// collapses to opaque. A JSX-returning candidate therefore wins; the first
// function is only the fallback, which keeps an EMPTY root (`return` with no
// argument, no JSX anywhere) splice-able by spliceSetRootChild.
export function findComponentFn(program: AnyNode, componentName?: string): AnyNode | null {
  let fallback: AnyNode | null = null;
  for (const stmt of (program.body ?? []) as AnyNode[]) {
    const decl =
      stmt.type === 'ExportNamedDeclaration' && stmt.declaration
        ? (stmt.declaration as AnyNode)
        : stmt;
    if (decl.type === 'FunctionDeclaration') {
      if (componentName && decl.id?.name !== componentName) continue;
      if (componentName) return decl;
      if (fnBodyJsx(decl.body)) return decl;
      fallback ??= decl;
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
        if (componentName) return init;
        if (fnBodyJsx(init.body as AnyNode | undefined)) return init;
        fallback ??= init;
      }
    }
  }
  return fallback;
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

// Extract the returned root expression from a function/arrow body: either a
// concise arrow body (`=> <jsx/>` / `=> (<jsx/>)`, where the body IS the
// expression) or a block body with a `return <jsx/>`. A recognized platform
// conditional counts too (`return platform === 'mobile' ? <A/> : <B/>`) — every
// other conditional, fragments, and non-JSX returns aren't representable as a
// single root → null.
function fnBodyJsx(body: AnyNode | undefined): AnyNode | null {
  if (!body) return null;
  if (body.type !== 'BlockStatement') {
    return rootExpression(unparen(body), []);
  }
  const stmts = (body.body ?? []) as AnyNode[];
  for (const stmt of stmts) {
    if (stmt.type === 'ReturnStatement' && stmt.argument) {
      return rootExpression(unparen(stmt.argument as AnyNode), stmts);
    }
  }
  return null;
}

function rootExpression(arg: AnyNode, statements: AnyNode[]): AnyNode | null {
  if (arg.type === 'JSXElement') return arg;
  return parsePlatformConditional(arg, statements) ? arg : null;
}
