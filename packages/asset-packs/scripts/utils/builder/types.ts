export type BuilderApiAssetPack = {
  id: string;
  title: string;
  thumbnail: string; // uuid
  created_at: string; // UTC date;
  updated_at: string; // UTC date;
  eth_address: string;
  assets: BuilderApiAsset[];
};

export type BuilderApiAsset = {
  id: string;
  asset_pack_id: string;
  name: string;
  model: string;
  thumbnail: string; // hash
  tags: string[];
  category: string;
  contents: Record<string, string>; // path -> hash;
  created_at: string; // UTC date;
  updated_at: string; // UTC date;
  metrics: Metrics;
  script: string | null;
  parameters: Parameter[];
  actions: Action[];
  legacy_id: string | null;
};

export enum ParameterType {
  BOOLEAN = 'boolean',
  TEXT = 'text',
  TEXTAREA = 'textarea',
  FLOAT = 'float',
  INTEGER = 'integer',
  ENTITY = 'entity',
  ACTIONS = 'actions',
  OPTIONS = 'options',
  SLIDER = 'slider',
}

export type ParameterValue = string | number | boolean | ActionValue[];

export type ActionValue = {
  entityName: string;
  actionId: string;
  values: Record<string, ParameterValue>;
};

export type Parameter = {
  id: string;
  type: ParameterType;
  label: string;
  description?: string;
  default?: Exclude<ParameterValue, ActionValue>;
  options?: {
    label: string;
    value: string;
  }[];
  min?: number;
  max?: number;
  step?: number;
};

export type Action = {
  id: string;
  label: string;
  parameters: Parameter[];
  description?: string;
};

export type Metrics = {
  triangles: number;
  materials: number;
  textures: number;
  meshes: number;
  bodies: number;
  entities: number;
};
