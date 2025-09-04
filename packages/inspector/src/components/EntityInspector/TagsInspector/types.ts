import { Tags } from '@dcl/asset-packs';

export const TAG_PREFIX = 'tag::';
export const DEFAULT_TAGS = Object.values(Tags);

export type Tag = {
  id: number;
  name: string;
  isDefault: boolean;
};
