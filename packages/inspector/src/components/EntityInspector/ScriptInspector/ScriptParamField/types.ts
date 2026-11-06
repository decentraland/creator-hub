import type { ScriptParamUnion } from '../types';
import type { ParamUpdate } from './update';

export type Props = {
  name: string;
  param: ScriptParamUnion;
  // The other fields of the object this one belongs to, for a field tied to a sibling
  // (`@actionsOf`).
  siblings?: Record<string, unknown>;
  // The warning to show under a string field, asked per field so nested ones get it too.
  getError?: (param: ScriptParamUnion) => string | undefined;
  // A plain value from a leaf, or a `(prev) => next` updater from a container editor. See update.ts.
  onUpdate: (update: ParamUpdate) => void;
};
