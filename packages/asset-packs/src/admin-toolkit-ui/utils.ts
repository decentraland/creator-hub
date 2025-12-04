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
