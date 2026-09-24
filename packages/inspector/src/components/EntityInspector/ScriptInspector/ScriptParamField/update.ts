// A param update is either the new value, or a function computing it from the previous value.
// Leaves emit a plain value; container editors (object/array) emit the FUNCTIONAL form so a
// nested edit composes against the freshest value instead of a stale render-closure snapshot.
// Without this, two debounced sibling edits within one debounce window both spread the same
// stale container value and the second silently reverts the first (data loss).
export type ParamUpdate = unknown | ((prev: unknown) => unknown);

export function resolveParamUpdate(update: ParamUpdate, prev: unknown): unknown {
  return typeof update === 'function' ? (update as (p: unknown) => unknown)(prev) : update;
}
