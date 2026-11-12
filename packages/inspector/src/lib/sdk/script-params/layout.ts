import { getScriptParams, toColorOfKind } from './parser';
import { isMalformedParam, isPlainObject } from './validation';
import type { ScriptColor, ScriptLayout, ScriptParamColor, ScriptParamUnion } from './types';

export function parseLayout(layout?: string): ScriptLayout | undefined {
  if (!layout) return undefined;
  try {
    return JSON.parse(layout);
  } catch (error) {
    console.warn('Failed to parse script layout:', error);
    return undefined;
  }
}

// Keeps a stored colour if it still is one, reshaped to the declared kind (a script that changes
// a param from Color3 to Color4 keeps the creator's channels and gains an opaque alpha).
function reconcileColor(sourceParam: ScriptParamColor, storedValue: unknown): ScriptColor {
  const stored = storedValue as Partial<ScriptColor> | undefined;
  const isColor =
    !!stored &&
    typeof stored.r === 'number' &&
    typeof stored.g === 'number' &&
    typeof stored.b === 'number';
  return toColorOfKind(
    isColor ? (stored as ScriptColor) : sourceParam.value,
    sourceParam.value.a !== undefined,
  );
}

// Reconciles a stored value against a freshly-parsed param shape: the structure/defaults
// come from `sourceParam` (current script source), the data from `storedValue` (the user's
// edits). For containers it recurses — keeping stored keys/elements that still exist,
// dropping removed keys, adding new keys with the container's declared default. A container
// of the wrong shape takes the source default. Leaf values are kept if present, with
// enum/slider validated against the fresh options/range.
function reconcileValue(sourceParam: ScriptParamUnion, storedValue: unknown): unknown {
  switch (sourceParam.type) {
    case 'object': {
      if (!isPlainObject(storedValue)) return sourceParam.value;
      const defaults = isPlainObject(sourceParam.value) ? sourceParam.value : {};
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, fieldParam] of Object.entries(sourceParam.fields)) {
        if (Object.hasOwn(storedValue, key)) {
          result[key] = reconcileValue(fieldParam, storedValue[key]);
        } else {
          result[key] = Object.hasOwn(defaults, key) ? defaults[key] : fieldParam.value;
        }
      }
      return result;
    }
    case 'array':
      if (!Array.isArray(storedValue)) return sourceParam.value;
      return storedValue.map(element => reconcileValue(sourceParam.item, element));
    case 'enum':
      return typeof storedValue === 'string' && sourceParam.options.includes(storedValue)
        ? storedValue
        : sourceParam.value;
    case 'slider': {
      const n = typeof storedValue === 'number' ? storedValue : sourceParam.value;
      return Math.min(Math.max(n, sourceParam.min), sourceParam.max);
    }
    case 'color':
      return reconcileColor(sourceParam, storedValue);
    default:
      return storedValue !== undefined ? storedValue : sourceParam.value;
  }
}

export function mergeLayout(source: ScriptLayout, target: ScriptLayout): ScriptLayout {
  const layout: ScriptLayout = { params: {}, actions: [] };

  for (const [name, value] of Object.entries(source.params)) {
    const targetParam = target.params[name];
    if (!targetParam || value.type !== targetParam.type) {
      layout.params[name] = value; // keep source if param not in target or if param types are different
    } else if (value.type === 'object' && targetParam.type === 'object') {
      // fresh `fields`/defaults from source; stored values reconciled key-by-key
      layout.params[name] = {
        ...value,
        value: reconcileValue(value, targetParam.value) as Record<string, unknown>,
      };
    } else if (value.type === 'array' && targetParam.type === 'array') {
      // fresh `item` shape from source; stored rows reconciled element-by-element
      layout.params[name] = {
        ...value,
        value: reconcileValue(value, targetParam.value) as unknown[],
      };
    } else if (value.type === 'slider' && targetParam.type === 'slider') {
      // min/max/step always come from the fresh parse; keep the stored value clamped to the new range
      const storedValue = typeof targetParam.value === 'number' ? targetParam.value : value.value;
      layout.params[name] = {
        ...value,
        value: Math.min(Math.max(storedValue, value.min), value.max),
      };
    } else if (value.type === 'enum' && targetParam.type === 'enum') {
      // options always come from the fresh parse; keep the stored choice only if still valid
      const storedValue =
        typeof targetParam.value === 'string' && value.options.includes(targetParam.value)
          ? targetParam.value
          : value.value;
      layout.params[name] = { ...value, value: storedValue };
    } else if (value.type === 'color' && targetParam.type === 'color') {
      layout.params[name] = { ...value, value: reconcileColor(value, targetParam.value) };
    } else {
      // editor metadata (tooltip, @enabledIf, @components…) comes from the fresh parse too, so
      // removing a tag from the script takes effect on refresh
      layout.params[name] = { ...value, value: targetParam.value } as ScriptParamUnion;
    }
  }

  layout.actions = source.actions;
  layout.events = source.events;
  layout.error = source.error;

  return layout;
}

/**
 * `stored` with each malformed object/list param rebuilt from the script `content`, every other
 * param untouched. Undefined when nothing was repaired, including when `content` doesn't parse.
 */
export function repairMalformedParams(
  stored: ScriptLayout,
  content: string,
): ScriptLayout | undefined {
  const source = getScriptParams(content);
  if (source.error) return undefined;

  const params = { ...stored.params };
  let repaired = false;
  for (const [name, param] of Object.entries(stored.params)) {
    const fresh = source.params[name];
    if (!isMalformedParam(param) || !fresh || fresh.type !== param.type) continue;
    params[name] = { ...fresh, value: reconcileValue(fresh, param.value) } as ScriptParamUnion;
    repaired = true;
  }
  return repaired ? { ...stored, params } : undefined;
}
