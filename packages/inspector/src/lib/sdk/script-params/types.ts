import type { Entity } from '@dcl/ecs';
import type { ActionRef } from '@dcl/asset-packs';

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
  | ScriptParamColor
  | ScriptParamEntity
  | ScriptParamAction
  | ScriptParamObject
  | ScriptParamArray;

export type ScriptParam = {
  optional?: boolean;
  tooltip?: string;
  // `@enabledIf <key>` / `@enabledIf !<key>`: the field is greyed out and locked unless the
  // sibling field `<key>` is on (or off, with `!`). The script still receives its value.
  enabledIf?: string;
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
  // `@actionsOf <key>`: the value names one of the actions on the entity held by the sibling
  // field `<key>` of the same object, so the editor offers that entity's actions.
  actionsOf?: string;
  // `@format wallet`: the value is an Ethereum address. `@format image` (or audio, video, model):
  // the value is the path of a scene file of that kind, picked with the file field.
  format?: ScriptStringFormat;
};

export type ScriptFileFormat = 'image' | 'audio' | 'video' | 'model';
export type ScriptStringFormat = 'wallet' | ScriptFileFormat;

// A string-literal union in the constructor (e.g. `shape: 'box' | 'sphere'`) becomes a
// dropdown. `options` come from the parsed type; `value` is the current choice.
export type ScriptParamEnum = ScriptParam & {
  type: 'enum';
  value: string;
  options: string[];
};

export type ScriptColor = { r: number; g: number; b: number; a?: number };

// A `Color3` or `Color4` param, edited with the same picker as the Material colours. `value` is
// the plain `{ r, g, b }` (plus `a` for a Color4) the constructor receives, so it already is a
// Color3/Color4 at runtime. The picker is RGB-only: a Color4 keeps the alpha it was declared with.
export type ScriptParamColor = ScriptParam & {
  type: 'color';
  value: ScriptColor;
};

export type ScriptParamEntity = ScriptParam & {
  type: 'entity';
  value: Entity;
  // `@components <name> …`: only entities carrying one of these components (full ECS names,
  // e.g. `asset-packs::Actions`) can be picked.
  components?: string[];
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
