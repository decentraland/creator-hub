import type { UINodeType } from '../shared/tree-model';
import { keyName, unparen } from './ast-utils';

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
    const key = keyName(prop.key);
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

export type { AnyNode };
export {
  ELEMENT_TYPE,
  evalExpr,
  NESTED_BACKGROUND_GROUPS,
  TYPED_PROP_GROUPS,
  UI_BACKGROUND,
  UI_BUTTON_PROPS,
  UI_TRANSFORM,
};
