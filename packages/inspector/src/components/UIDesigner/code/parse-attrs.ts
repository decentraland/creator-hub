import { type CanvasBindingRow, type CanvasSegment, type UINodeType } from '../shared/tree-model';

import { keyName, unparen } from './ast-utils';
import { type AnyNode, evalExpr, NESTED_BACKGROUND_GROUPS, UI_TRANSFORM } from './parse-eval';
import { ergonomicToFlattenedKey, NESTED_TRANSFORM_GROUPS } from './transform-patch';

const SEG_LITERAL = 'literal';
const SEG_BINDING = 'binding';

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
  if (e && e.type === 'LogicalExpression' && (e as { operator?: string }).operator === '??') {
    return bindingExprOf((e as { left?: AnyNode }).left, source);
  }
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
    const key = keyName(prop.key);
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

export {
  attrValue,
  bindingExpr,
  bindingExprOf,
  elementName,
  eventFieldKey,
  eventHandlerName,
  handlerNameOfExpr,
  readAttributes,
  readStyleAttr,
  readStyleObject,
  templateSegments,
  templateSegmentsOf,
};
