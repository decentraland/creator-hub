import type { ScriptParamUnion } from '../types';
import type { ParamUpdate } from './update';

export type Props = {
  name: string;
  param: ScriptParamUnion;
  // A plain value from a leaf, or a `(prev) => next` updater from a container editor. See update.ts.
  onUpdate: (update: ParamUpdate) => void;
};
