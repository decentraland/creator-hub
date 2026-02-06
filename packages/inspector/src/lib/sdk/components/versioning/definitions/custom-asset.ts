import { Schemas } from '@dcl/ecs';

const CustomAssetV0 = { assetId: Schemas.String };

export const CUSTOM_ASSET_VERSIONS = [CustomAssetV0] as const;
