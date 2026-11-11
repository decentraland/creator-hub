import type { ScriptLayout, ScriptParamUnion } from './types';

// Every param type this editor can render. Typed as a Record over the union so adding a type to
// `ScriptParamUnion` without listing it here fails the typecheck.
const SUPPORTED_PARAM_TYPES: Record<ScriptParamUnion['type'], true> = {
  number: true,
  slider: true,
  boolean: true,
  string: true,
  enum: true,
  entity: true,
  action: true,
  object: true,
  array: true,
};

export function isSupportedParamType(type: unknown): type is ScriptParamUnion['type'] {
  return typeof type === 'string' && Object.hasOwn(SUPPORTED_PARAM_TYPES, type);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Layouts come from catalog composites written by NEWER editors, so they are untyped input here:
// walk them defensively and report the path of every param whose type this editor doesn't know.
function collectUnsupported(param: unknown, path: string, out: string[]) {
  if (!isPlainObject(param)) return;
  if (!isSupportedParamType(param.type)) {
    out.push(path);
    return;
  }
  if (param.type === 'object' && isPlainObject(param.fields)) {
    for (const [key, field] of Object.entries(param.fields)) {
      collectUnsupported(field, `${path}.${key}`, out);
    }
  }
  if (param.type === 'array') collectUnsupported(param.item, `${path}[]`, out);
}

export function findUnsupportedParams(layout: ScriptLayout): string[] {
  const out: string[] = [];
  for (const [name, param] of Object.entries(layout.params ?? {})) {
    collectUnsupported(param, name, out);
  }
  for (const action of layout.actions ?? []) {
    for (const [name, param] of Object.entries(action.params ?? {})) {
      collectUnsupported(param, `${action.methodName}(${name})`, out);
    }
  }
  return out;
}

// True when a container param holds a value of the wrong shape. Creator Hub 0.52 rendered object
// and list params as plain text boxes, so editing one there saved the typed text (e.g.
// "[object Object]") as the value of an `object` param (#1765).
function hasMalformedValue(param: ScriptParamUnion, value: unknown): boolean {
  if (param.type === 'object') {
    if (!isPlainObject(value)) return true;
    return Object.entries(param.fields ?? {}).some(
      ([key, field]) => key in value && hasMalformedValue(field, value[key]),
    );
  }
  if (param.type === 'array') {
    if (!Array.isArray(value)) return true;
    return value.some(element => hasMalformedValue(param.item, element));
  }
  return false;
}

export function hasMalformedParams(layout: ScriptLayout | undefined): boolean {
  if (!layout) return false;
  return Object.values(layout.params ?? {}).some(param => hasMalformedValue(param, param.value));
}
