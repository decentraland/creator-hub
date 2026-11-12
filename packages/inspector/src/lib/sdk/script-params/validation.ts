import type { ScriptLayout, ScriptParamUnion } from './types';

const SUPPORTED_PARAM_TYPES: Record<ScriptParamUnion['type'], true> = {
  number: true,
  slider: true,
  boolean: true,
  string: true,
  enum: true,
  color: true,
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

/** Paths of every param this editor can't render, e.g. `config.mode`, `items[]`, `open(speed)`. */
export function findUnsupportedParams(layout: ScriptLayout): string[] {
  const out: string[] = [];
  const params = isPlainObject(layout?.params) ? layout.params : {};
  for (const [name, param] of Object.entries(params)) {
    collectUnsupported(param, name, out);
  }
  for (const action of Array.isArray(layout?.actions) ? layout.actions : []) {
    if (!isPlainObject(action)) continue;
    const actionParams = isPlainObject(action.params) ? action.params : {};
    for (const [name, param] of Object.entries(actionParams)) {
      collectUnsupported(param, `${action.methodName}(${name})`, out);
    }
  }
  return out;
}

function hasMalformedValue(param: ScriptParamUnion, value: unknown): boolean {
  if (param.type === 'object') {
    if (!isPlainObject(value)) return true;
    return Object.entries(param.fields ?? {}).some(
      ([key, field]) => Object.hasOwn(value, key) && hasMalformedValue(field, value[key]),
    );
  }
  if (param.type === 'array') {
    if (!Array.isArray(value)) return true;
    return value.some(element => hasMalformedValue(param.item, element));
  }
  return false;
}

/** True when an object or list param holds a value of the wrong shape, e.g. a string. */
export function isMalformedParam(param: ScriptParamUnion): boolean {
  return isPlainObject(param) && hasMalformedValue(param, param.value);
}

export function hasMalformedParams(layout: ScriptLayout | undefined): boolean {
  if (!layout || !isPlainObject(layout.params)) return false;
  return Object.values(layout.params).some(isMalformedParam);
}
