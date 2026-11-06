import { createLogger } from 'redux-logger';

type Action = { meta?: { arg?: { options?: { secret?: unknown } } } };

/** Hides a World access password from a logged action, leaving the dispatched one untouched. */
export function redactSecret<T extends Action>(action: T): T {
  const arg = action.meta?.arg;
  if (arg?.options?.secret === undefined) return action;
  return {
    ...action,
    meta: { ...action.meta, arg: { ...arg, options: { ...arg.options, secret: '<redacted>' } } },
  };
}

export const logger = createLogger({ actionTransformer: redactSecret });
