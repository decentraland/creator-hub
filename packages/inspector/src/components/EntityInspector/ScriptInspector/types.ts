import type { Entity } from '@dcl/ecs';
import type { ScriptItem } from '../../../lib/sdk/components';

export type ChangeEvt = React.ChangeEvent<HTMLInputElement>;

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type ScriptInput = {
  scripts: ScriptItem[];
};

export type ScriptLayout = {
  params: Record<string, ScriptParamUnion>;
  error?: string;
};

export type ScriptParamUnion =
  | ScriptParamNumber
  | ScriptParamBoolean
  | ScriptParamString
  | ScriptParamEntity;

export type ScriptParam = {
  optional?: boolean;
};

export type ScriptParamNumber = ScriptParam & {
  type: 'number';
  value: number;
};

export type ScriptParamBoolean = ScriptParam & {
  type: 'boolean';
  value: boolean;
};

export type ScriptParamString = ScriptParam & {
  type: 'string';
  value: string;
};

export type ScriptParamEntity = ScriptParam & {
  type: 'entity';
  value: Entity;
};
