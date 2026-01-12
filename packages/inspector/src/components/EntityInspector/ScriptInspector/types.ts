import type { Entity } from '@dcl/ecs';
import { type Script } from '@dcl/asset-packs';

export type ChangeEvt = React.ChangeEvent<HTMLInputElement>;

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type ScriptItem = Script['value'][number];

export type ScriptInput = {
  scripts: ScriptItem[];
};

export type ScriptLayout = {
  params: Record<string, ScriptParamUnion>;
  actions?: ScriptAction[];
  error?: string;
};

export type ScriptAction = {
  methodName: string;
  description?: string;
  params: Record<string, ScriptParamUnion>;
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
