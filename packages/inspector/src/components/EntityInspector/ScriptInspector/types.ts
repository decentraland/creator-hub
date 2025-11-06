import type { Entity } from '@dcl/ecs';
import type { ScriptItem } from '../../../lib/sdk/components';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type ScriptInput = {
  scripts: ScriptItem[];
};

export type ScriptLayout = {
  params: {
    [key: string]: ScriptParamUnion;
  };
};

export type ScriptParamUnion = ScriptParamNumber | ScriptParamBoolean | ScriptParamString;

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
