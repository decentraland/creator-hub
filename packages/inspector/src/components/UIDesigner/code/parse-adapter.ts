import type { Entity } from '@dcl/ecs';

import { type CanvasBindingRow, type CanvasSegment, type UINodeType } from '../shared/tree-model';

const SEG_LITERAL = 'literal';
const SEG_BINDING = 'binding';
import { ergonomicToFlattenedKey, NESTED_TRANSFORM_GROUPS } from './transform-patch';
import {
  ergonomicToPBBackground,
  ergonomicToPBButton,
  ergonomicToPBText,
  ergonomicToPBTransform,
} from './ecs-shape';
import {
  findInteractionForSpread,
  INTERACTION_STATES,
  type InteractionAst,
  type InteractionStateKey,
  soleSpreadArgument,
} from './interaction-convention';
import { readNodeName } from './name-marker';
import {
  branchElement,
  componentStatements,
  parsePlatformConditional,
  type PlatformVariantAst,
  PLATFORMS,
} from './platform-convention';
import type { CodeUINode, ComponentRefProp, InteractionStateStyles, ParsedUI, Span } from './types';

interface Node {
  type: string;
  start: number;
  end: number;
  [k: string]: unknown;
}
type AnyNode = Node & Record<string, any>;

const ELEMENT_TYPE: Record<string, UINodeType> = {
  UiEntity: 'UiEntity',
  Label: 'Label',
  Input: 'Input',
  Dropdown: 'Dropdown',
  Button: 'Button',
};

const UI_TEXT_PROPS = new Set(['value', 'fontSize', 'textAlign', 'color', 'font', 'textWrap']);

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

export const UI_BUTTON = 'ui::button';

const UI_BUTTON_PROPS = new Set(['variant', 'disabled']);

const UI_TRANSFORM = 'core::UiTransform';
const UI_BACKGROUND = 'core::UiBackground';

const NESTED_BACKGROUND_GROUPS = new Set(['texture', 'avatarTexture']);

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

function unparen(node: AnyNode): AnyNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression as AnyNode;
  return n;
}

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
  return name?.type === 'JSXIdentifier' ? (name.name as string) : null;
}

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

function attrValue(attr: AnyNode): { ok: true; value: unknown; dynamic?: boolean } | { ok: false } {
  const v = attr.value as AnyNode | null;
  if (v == null) return { ok: true, value: true };
  if (v.type === 'Literal') return { ok: true, value: v.value };
  if (v.type === 'JSXExpressionContainer') return evalExpr(v.expression);
  return { ok: false };
}

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

function readStyleObject(
  obj: AnyNode,
  componentId: string,
  source: string,
  group?: string,
): { value: Record<string, unknown>; bound: CanvasBindingRow[]; dynamic: boolean } {
  const value: Record<string, unknown> = {};
  const bound: CanvasBindingRow[] = [];
  let dynamic = false;
  for (const prop of (obj.properties ?? []) as AnyNode[]) {
    if (prop.type !== 'Property' || prop.computed) {
      dynamic = true;
      continue;
    }
    const key = String(prop.key.type === 'Identifier' ? prop.key.name : prop.key.value);
    const valueNode = prop.value as AnyNode;

    const nested = unparen(valueNode);
    const isGroup =
      componentId === UI_TRANSFORM
        ? NESTED_TRANSFORM_GROUPS.has(key)
        : NESTED_BACKGROUND_GROUPS.has(key);
    if (!group && isGroup && nested.type === 'ObjectExpression') {
      const r = readStyleObject(nested, componentId, source, key);
      value[key] = r.value;
      bound.push(...r.bound);
      if (r.dynamic) dynamic = true;
      continue;
    }

    const v = evalExpr(valueNode);
    if (v.ok && !v.dynamic) {
      value[key] = v.value;
      continue;
    }
    const expr = bindingExprOf(valueNode, source);
    const flat = !group
      ? key
      : componentId === UI_TRANSFORM
        ? ergonomicToFlattenedKey(group, key)
        : `${group}.${key}`;
    if (expr && flat) {
      bound.push({ field: `${componentId}.${flat}`, variable: expr });
      continue;
    }
    if (v.ok) value[key] = v.value;
    dynamic = true;
  }
  return { value, bound, dynamic };
}

function styleObjectOf(attr: AnyNode): AnyNode | null {
  const v = attr.value as AnyNode | null;
  if (v?.type !== 'JSXExpressionContainer') return null;
  const e = unparen(v.expression as AnyNode);
  return e?.type === 'ObjectExpression' ? e : null;
}

function readStyleAttr(
  attr: AnyNode,
  componentId: string,
  source: string,
): { value: Record<string, unknown> | undefined; bound: CanvasBindingRow[]; dynamic: boolean } {
  const obj = styleObjectOf(attr);
  if (obj) return readStyleObject(obj, componentId, source);
  const v = attrValue(attr);
  if (v.ok) {
    return { value: v.value as Record<string, unknown>, bound: [], dynamic: !!v.dynamic };
  }
  return { value: undefined, bound: [], dynamic: true };
}

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
      const componentId = key === 'uiTransform' ? UI_TRANSFORM : UI_BACKGROUND;
      const obj = unparen(valueNode);
      const r = obj.type === 'ObjectExpression' ? readStyleObject(obj, componentId, source) : null;
      if (r) {
        bound.push(...r.bound);
        if (r.dynamic) dynamic = true;
        styles[key] =
          key === 'uiTransform'
            ? ergonomicToPBTransform(r.value)
            : ergonomicToPBBackground(r.value);
        continue;
      }
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
      const field = `${group.componentId}.${key}`;
      const segments = templateSegmentsOf(valueNode, source);
      const expr = bindingExprOf(valueNode, source);
      if (segments) bound.push({ field, variable: '', segments });
      else if (expr) bound.push({ field, variable: expr });
      else dynamic = true;
    }
  }

  if (group && Object.keys(textValues).length > 0) {
    styles[group.field] = ergonomicToPBText(textValues);
  }
  return { styles, events, bound, dynamic };
}

export function isLayerableProp(type: UINodeType, name: string): boolean {
  if (name === 'uiTransform' || name === 'uiBackground') return true;
  if (eventFieldKey(type, name)) return true;
  return TYPED_PROP_GROUPS[type]?.props.has(name) ?? false;
}

const LAYERABLE_COMPONENTS = new Set([
  'core::UiTransform',
  'core::UiBackground',
  'core::UiText',
  'core::UiInput',
  'core::UiDropdown',
]);

export function isLayerableComponent(componentId: string): boolean {
  return LAYERABLE_COMPONENTS.has(componentId);
}

export interface CodeToUINodesOptions {
  componentName?: string;
  knownComponents?: string[];
}

export function codeToUINodes(
  program: AnyNode,
  source: string,
  options: CodeToUINodesOptions = {},
): ParsedUI | null {
  const rootJsx = findComponentReturnJsx(program, options.componentName);
  if (!rootJsx) return null;
  const componentFn = findComponentFn(program, options.componentName);
  const fnStatements = componentStatements(componentFn);

  const spans = new Map<number, Span>();
  const astNodes = new Map<number, AnyNode>();
  const known = new Set(options.knownComponents ?? []);
  let nextId = 1;
  let hasOpaque = false;

  const componentRefNode = (node: AnyNode, name: string, parentEntity?: number): CodeUINode => {
    const id = nextId++ as unknown as Entity;
    const span: Span = [node.start, node.end];
    spans.set(id as unknown as number, span);
    astNodes.set(id as unknown as number, node);
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

  const visitElement = (el: AnyNode, parentEntity?: number): CodeUINode => {
    const name = elementName(el);
    if (name == null) return opaqueNode(el, 'member-name-element', 'Unknown');
    const type = ELEMENT_TYPE[name];
    if (!type) {
      if (known.has(name)) return componentRefNode(el, name, parentEntity);
      return opaqueNode(el, 'custom-component', name);
    }

    const { attrs, hasSpread } = readAttributes(el);
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
    const uiName = readNodeName(source, el);
    if (uiName) node.uiName = uiName;
    const bindings: CanvasBindingRow[] = [];

    if (interaction) {
      const states: Partial<Record<InteractionStateKey, InteractionStateStyles>> = {};
      for (const key of INTERACTION_STATES) {
        const layer = interaction.states.get(key);
        if (!layer) continue;
        const { styles, events, bound, dynamic } = readInteractionLayer(layer.object, type, source);
        states[key] = styles;
        if (dynamic) dynamicProps = true;
        if (key !== 'base') continue;
        bindings.push(...bound);
        if (styles.uiTransform) node.uiTransform = styles.uiTransform;
        if (styles.uiBackground) node.uiBackground = styles.uiBackground;
        if (styles.uiText) node.uiText = styles.uiText;
        if (styles.uiInput) node.uiInput = styles.uiInput;
        if (styles.uiDropdown) node.uiDropdown = styles.uiDropdown;
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
      const r = readStyleAttr(uiTransformAttr, UI_TRANSFORM, source);
      if (r.value) node.uiTransform = ergonomicToPBTransform(r.value);
      bindings.push(...r.bound);
      if (r.dynamic) dynamicProps = true;
    }

    if (parentEntity !== undefined) {
      node.uiTransform = {
        ...((node.uiTransform as Record<string, unknown> | undefined) ?? {}),
        parent: parentEntity,
      };
    }

    const uiBackgroundAttr = attrs.get('uiBackground');
    if (uiBackgroundAttr) {
      const r = readStyleAttr(uiBackgroundAttr, UI_BACKGROUND, source);
      if (r.value) node.uiBackground = ergonomicToPBBackground(r.value);
      bindings.push(...r.bound);
      if (r.dynamic) dynamicProps = true;
    }

    const readProps = (
      props: Set<string>,
      componentId: string,
      freezeOnUnread = true,
    ): Record<string, unknown> => {
      const values: Record<string, unknown> = {};
      for (const key of props) {
        const attr = attrs.get(key);
        if (!attr) continue;
        const v = attrValue(attr);
        if (v.ok) {
          values[key] = v.value;
          continue;
        }
        const field = `${componentId}.${key}`;
        const segments = templateSegments(attr, source);
        const expr = bindingExpr(attr, source);
        if (segments) bindings.push({ field, variable: '', segments });
        else if (expr) bindings.push({ field, variable: expr });
        else if (freezeOnUnread) dynamicProps = true;
      }
      return values;
    };

    const group = TYPED_PROP_GROUPS[type];
    if (group) {
      const values = readProps(group.props, group.componentId);
      if (Object.keys(values).length > 0) node[group.field] = ergonomicToPBText(values);
    }

    if (type === 'Button') {
      const values = ergonomicToPBButton(readProps(UI_BUTTON_PROPS, UI_BUTTON, false));
      if (Object.keys(values).length > 0) node.uiButton = values;
    }

    for (const [attrName, attr] of attrs) {
      const field = eventFieldKey(type, attrName);
      if (!field) continue;
      const handler = eventHandlerName(attr);
      if (handler) bindings.push({ field, variable: handler });
    }

    if (bindings.length > 0) node.bindings = bindings;
    if (dynamicProps) node.dynamicProps = true;

    for (const child of (el.children ?? []) as AnyNode[]) {
      const mapped = visitChild(child, type, id as unknown as number);
      if (mapped) node.children.push(mapped);
    }
    return node;
  };

  const visitChild = (
    child: AnyNode,
    parentType: UINodeType,
    parentEntity: number,
  ): CodeUINode | null => {
    if (child.type === 'JSXElement') return visitElement(child, parentEntity);
    if (child.type === 'JSXText') {
      const text = String(child.value ?? '').trim();
      if (text && parentType === 'Label') {
        return null;
      }
      return null;
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

  const rootVariant = parsePlatformConditional(rootJsx, fnStatements);
  const root = rootVariant ? platformVariantNode(rootVariant) : visitElement(rootJsx);
  return { root, spans, astNodes, hasOpaque };
}

function isMapCall(expr: AnyNode | undefined): boolean {
  return (
    !!expr &&
    expr.type === 'CallExpression' &&
    expr.callee?.type === 'MemberExpression' &&
    expr.callee.property?.type === 'Identifier' &&
    expr.callee.property.name === 'map'
  );
}

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
