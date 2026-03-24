import type { Entity } from '@dcl/ecs';

import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { SdkContextValue } from '../context';

export type EntityValidator = {
  componentIds: (sdk: SdkContextValue) => number[];
  validate: (
    sdk: SdkContextValue,
    entity: Entity,
    assetCatalog: AssetCatalogResponse | undefined,
  ) => boolean;
};
