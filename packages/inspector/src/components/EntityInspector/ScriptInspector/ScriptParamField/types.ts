import type { ScriptParamUnion } from '../types';

export type Props = {
  name: string;
  param: ScriptParamUnion;
  error?: string;
  onUpdate: (value: ScriptParamUnion['value']) => void;
};
