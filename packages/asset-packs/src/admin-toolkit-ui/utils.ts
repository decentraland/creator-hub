import type { IEngine } from '@dcl/ecs';

export function setInterval(engine: IEngine, fn: () => void, ms: number) {
  let timer = 0;
  function intervalSystem(dt: number) {
    timer += dt;
    if (timer * 1000 >= ms) {
      timer = 0;
      fn();
    }
  }
  engine.addSystem(intervalSystem);
  return intervalSystem;
}

export function clearInterval(engine: IEngine, fn: (t: number) => void) {
  engine.removeSystem(fn);
}

// Generic function to convert snake_case to camelCase
export function toCamelCase<T extends Record<string, any> | any[]>(
  obj: T,
): T extends any[] ? any[] : { [K in keyof T as CamelCaseString<K & string>]: T[K] } {
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        return toCamelCase(item);
      }
      return item;
    }) as any;
  }

  const result = {} as any;
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = obj[key];

    if (typeof value === 'object' && value !== null) {
      result[camelKey] = toCamelCase(value);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// Type helper for converting snake_case to camelCase
export type CamelCaseString<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCaseString<Q>>}`
  : S;

// Type helper for converting an entire object from snake_case to camelCase
export type CamelCase<T> = {
  [K in keyof T as CamelCaseString<string & K>]: T[K] extends Record<string, any>
    ? CamelCase<T[K]>
    : T[K] extends Array<infer U>
      ? U extends Record<string, any>
        ? Array<CamelCase<U>>
        : T[K]
      : T[K];
};

// The smart-item action dropdown. An item with no actions (anything linked that isn't a smart
// item) must not open: an open dropdown with no options draws as an empty white box over the
// buttons below it.
export function getActionPickerState(hasSelection: boolean, actionCount: number) {
  const hasNoActions = hasSelection && actionCount === 0;
  return {
    disabled: !hasSelection || hasNoActions,
    emptyLabel: hasNoActions ? 'This item has no actions' : 'Select action',
  };
}

// The action the panel shows and plays for a smart item: the admin's pick, else the item's
// configured default, else its first action. A name that is not one of the item's own actions
// (stale pick, or a default that was removed) never wins, so the dropdown label and the Play
// button always agree and can't carry over a previous item's action.
export function resolveSelectedAction<T extends { name: string }>(
  actions: T[],
  pickedAction: string | undefined,
  defaultAction: string | undefined,
): { index: number; action: T | undefined } {
  for (const name of [pickedAction, defaultAction]) {
    const index = name ? actions.findIndex(action => action.name === name) : -1;
    if (index >= 0) return { index, action: actions[index] };
  }
  return actions.length > 0 ? { index: 0, action: actions[0] } : { index: -1, action: undefined };
}
