// A param update is either the new value (from a leaf editor) or a function computing it from the
// previous value (from a container editor). The functional form lets a nested edit compose against
// the freshest value instead of a stale render-closure snapshot — without it, two debounced sibling
// edits within one window both spread the same stale container value and the second silently reverts
// the first (data loss). `T` is `unknown` at the ScriptParamField level (params hold arbitrary
// values), but concrete where a caller knows it (e.g. a container's own value type), which is where
// the value-vs-updater distinction becomes meaningful at compile time.
export type ParamUpdate<T = unknown> = T | ((prev: T) => T);

export function resolveParamUpdate<T>(update: ParamUpdate<T>, prev: T): T {
  return typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
}
