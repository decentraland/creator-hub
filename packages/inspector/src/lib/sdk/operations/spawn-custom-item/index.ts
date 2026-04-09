import type { Entity, IEngine, Vector3Type } from '@dcl/ecs';

import type { AssetData } from '../../../logic/catalog';
import type { EnumEntity } from '../../enum-entity';
import addAsset from '../add-asset';

/**
 * Spawns a custom item entity tree in the scene.
 *
 * This operation creates an entity (or entity tree) in the ECS engine
 * that adopts all components and structure defined in the given composite.
 * It is the programmatic equivalent of dragging a Custom Item from the
 * catalog into the 3D viewport.
 *
 * Call this after the custom item's asset files have been imported into the
 * scene directory (e.g. via `dataLayer.spawnCustomItem`) so that all
 * resource paths resolve correctly.
 *
 * @example
 * // 1. Import files + retrieve spawn data from the data layer
 * const { composite, basePath, name, assetId } =
 *   await dataLayer.spawnCustomItem({ path: 'my_monster' });
 *
 * // 2. Spawn the entity tree at the desired position
 * const entity = operations.spawnCustomItem(
 *   composite, basePath, name,
 *   { x: 8, y: 0, z: 8 },
 *   assetId,
 *   sdk.enumEntity,
 * );
 * await operations.dispatch();
 */
export function spawnCustomItem(engine: IEngine) {
  return function spawnCustomItem(
    composite: AssetData['composite'],
    basePath: string,
    name: string,
    position: Vector3Type,
    assetId: string,
    enumEntityId: EnumEntity,
    parent?: Entity,
  ): Entity {
    return addAsset(engine)(
      parent ?? engine.RootEntity,
      /* src */ '',
      name,
      position,
      basePath,
      enumEntityId,
      composite,
      assetId,
      /* custom */ true,
    );
  };
}

export default spawnCustomItem;
