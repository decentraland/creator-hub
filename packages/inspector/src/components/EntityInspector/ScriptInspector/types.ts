import type { Entity } from '@dcl/ecs';
import { type Script, type ActionRef } from '@dcl/asset-packs';

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
  // Event names the script's reactions can hook (from `@event` JSDoc tags). Drives the
  // Reactions section; baked into a smart item's composite so it shows on placement.
  events?: string[];
  error?: string;
};

export type ScriptAction = {
  methodName: string;
  description?: string;
  params: Record<string, ScriptParamUnion>;
};

export type ScriptParamUnion =
  | ScriptParamNumber
  | ScriptParamSlider
  | ScriptParamBoolean
  | ScriptParamString
  | ScriptParamEnum
  | ScriptParamEntity
  | ScriptParamAction
  | ScriptParamObject
  | ScriptParamArray;

export type ScriptParam = {
  optional?: boolean;
  tooltip?: string;
};

export type ScriptParamNumber = ScriptParam & {
  type: 'number';
  value: number;
};

export type ScriptParamSlider = ScriptParam & {
  type: 'slider';
  value: number;
  min: number;
  max: number;
  step: number;
};

export type ScriptParamBoolean = ScriptParam & {
  type: 'boolean';
  value: boolean;
};

export type ScriptParamString = ScriptParam & {
  type: 'string';
  value: string;
};

// A string-literal union in the constructor (e.g. `shape: 'box' | 'sphere'`) becomes a
// dropdown. `options` come from the parsed type; `value` is the current choice.
export type ScriptParamEnum = ScriptParam & {
  type: 'enum';
  value: string;
  options: string[];
};

export type ScriptParamEntity = ScriptParam & {
  type: 'entity';
  value: Entity;
};

export type ScriptParamAction = ScriptParam & {
  type: 'action';
  value: ActionRef;
};

// A nested object param, declared with an inline type literal in the constructor
// (e.g. `coords: { x: number; y: number; z: number }`). `value` holds the PLAIN JSON
// object handed to the constructor at runtime; `fields` is editor-only metadata (the
// per-key type/shape + default) that the runtime ignores. Keeping data and schema
// apart is what preserves the "runtime spreads `value` verbatim" contract — see
// `resolveScriptParams` in @dcl/sdk-commands.
export type ScriptParamObject = ScriptParam & {
  type: 'object';
  value: Record<string, unknown>;
  fields: Record<string, ScriptParamUnion>;
};

// A list param, declared with `T[]` or `Array<T>` in the constructor. `value` is the
// PLAIN JSON array handed to the constructor; `item` is editor-only metadata describing
// one element's type/shape + default (used to render each row and to seed new rows).
export type ScriptParamArray = ScriptParam & {
  type: 'array';
  value: unknown[];
  item: ScriptParamUnion;
};
