import type { UINodeType } from '../shared/tree-model';

const REQUIRED_ATTR_DEFAULTS: Partial<Record<UINodeType, Record<string, string>>> = {
  Label: { value: "''" },
  Button: { value: "''" },
  Input: { placeholder: "''" },
};

/**
 * Coalesce a bound attribute expression with a default when the target element attribute is a
 * required (non-nullable) react-ecs prop — `Label.value`, `Button.value` (inherits UiLabelProps),
 * and `Input.placeholder` (required in PBUiInput). Editor props are always optional (`name?: T`),
 * so a binding like `props.name` is `T | undefined` and would fail the required prop type;
 * `props.name ?? ''` keeps the emitted scene compiling. Harmless for required sources.
 * @returns the expression, wrapped as `${expr} ?? ${default}` only for a required attribute.
 */
export function coalesceRequiredAttr(type: UINodeType, name: string, expr: string): string {
  const def = REQUIRED_ATTR_DEFAULTS[type]?.[name];
  return def === undefined ? expr : `${expr} ?? ${def}`;
}
