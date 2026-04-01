import type { Entity } from '@dcl/ecs';

import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { SdkContextValue } from '../context';
import { entityValidator as gltfValidator } from '../../../components/EntityInspector/GltfInspector/utils';
import { entityValidator as audioSourceValidator } from '../../../components/EntityInspector/AudioSourceInspector/utils';
import { entityValidator as audioStreamValidator } from '../../../components/EntityInspector/AudioStreamInspector/utils';
import { entityValidator as videoPlayerValidator } from '../../../components/EntityInspector/VideoPlayerInspector/utils';
import { entityValidator as nftShapeValidator } from '../../../components/EntityInspector/NftShapeInspector/utils';
import { entityValidator as placeholderValidator } from '../../../components/EntityInspector/PlaceholderInspector/utils';
import { entityValidator as materialTextureValidator } from '../../../components/EntityInspector/MaterialInspector/Texture/utils';
import { entityValidator as scriptValidator } from '../../../components/EntityInspector/ScriptInspector/utils';
import { ROOT } from '../tree';
import type { EntityValidator } from './types';

// Registry of all entity validators.
// When adding validation for a new component, export an `entityValidator` from its utils.ts
// and add it here. A test enforces that all components with an entityValidator are registered.
export const entityValidators: EntityValidator[] = [
  gltfValidator,
  audioSourceValidator,
  audioStreamValidator,
  videoPlayerValidator,
  nftShapeValidator,
  placeholderValidator,
  materialTextureValidator,
  scriptValidator,
];

export function validateAllEntities(
  sdk: SdkContextValue,
  assetCatalog: AssetCatalogResponse | undefined,
): number[] {
  const nodes =
    sdk.components.Nodes.getOrNull(ROOT as Entity)?.value.filter(
      node =>
        ![sdk.engine.RootEntity, sdk.engine.PlayerEntity, sdk.engine.CameraEntity].includes(
          node.entity,
        ),
    ) ?? [];

  const entitiesWithErrors: number[] = [];

  for (const node of nodes) {
    if (hasValidationErrors(sdk, node.entity, assetCatalog)) {
      entitiesWithErrors.push(node.entity);
    }
  }

  return entitiesWithErrors;
}

function hasValidationErrors(
  sdk: SdkContextValue,
  entity: Entity,
  assetCatalog: AssetCatalogResponse | undefined,
): boolean {
  return entityValidators.some(validator => !validator.validate(sdk, entity, assetCatalog));
}
