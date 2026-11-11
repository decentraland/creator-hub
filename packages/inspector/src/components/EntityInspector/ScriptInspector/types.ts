import type { Entity } from '@dcl/ecs';
import type { Script } from '@dcl/asset-packs';

export type ChangeEvt = React.ChangeEvent<HTMLInputElement>;

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type ScriptItem = Script['value'][number];

export type ScriptInput = {
  scripts: ScriptItem[];
};

export type {
  ScriptLayout,
  ScriptAction,
  ScriptParamUnion,
  ScriptParam,
  ScriptParamNumber,
  ScriptParamSlider,
  ScriptParamBoolean,
  ScriptParamString,
  ScriptParamEnum,
  ScriptParamEntity,
  ScriptParamAction,
  ScriptParamObject,
  ScriptParamArray,
} from '../../../lib/sdk/script-params/types';
