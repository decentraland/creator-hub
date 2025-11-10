import type { ScriptParamUnion } from '../types';

export type Props = {
  name: string;
  param: ScriptParamUnion;
  onUpdate: (value: ScriptParamUnion['value']) => void;
};
