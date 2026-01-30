import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../constants';

const CUSTOM_ASSET_BASE_NAME = BaseComponentNames.CUSTOM_ASSET;

const CustomAssetV0 = {
  assetId: Schemas.String,
};

export const CUSTOM_ASSET_VERSIONS = [
  { versionName: CUSTOM_ASSET_BASE_NAME, component: CustomAssetV0 },
];

export function defineCustomAssetComponent(engine: IEngine) {
  return engine.defineComponent(CUSTOM_ASSET_BASE_NAME, CustomAssetV0);
}
