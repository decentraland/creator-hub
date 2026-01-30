import { Schemas } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const CUSTOM_ASSET_BASE_NAME = BaseComponentNames.CUSTOM_ASSET;

const CustomAssetV0 = {
  assetId: Schemas.String,
};

export const CUSTOM_ASSET_VERSIONS = [
  { versionName: CUSTOM_ASSET_BASE_NAME, component: CustomAssetV0 },
];
