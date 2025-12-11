import type { Entity } from '@dcl/sdk/ecs';
import { Transform, engine } from '@dcl/sdk/ecs';
import { Vector3, Quaternion } from '@dcl/sdk/math';

/**
 * Returns the position of an entity that is a child of other entities, relative to the scene instead of relative to the parent. Returns a Vector3.
 *
 * @param entity - Entity to calculate position
 * @returns The Entity's global position relative to the scene's origin
 * @public
 */
export function getWorldPosition(entity: Entity): Vector3 {
  const transform = Transform.getOrNull(entity);

  if (!transform) return Vector3.Zero();

  const parent = transform.parent;

  if (!parent) {
    return transform.position;
  } else {
    return Vector3.add(
      getWorldPosition(parent),
      Vector3.rotate(transform.position, getWorldRotation(parent)),
    );
  }
}

/**
 * Returns the position of an entity that is a child of other entities, relative to the scene instead of relative to the parent. Returns a Vector3.
 *
 * @param entity - Entity to calculate position
 * @returns The Entity's global rotation in reference to the scene's origin
 * @public
 */
export function getWorldRotation(entity: Entity): Quaternion {
  const transform = Transform.getOrNull(entity);

  if (!transform) return Quaternion.Identity();

  const parent = transform.parent;

  if (!parent) {
    return transform.rotation;
  } else {
    return Quaternion.multiply(transform.rotation, getWorldRotation(parent));
  }
}

/**
 * Returns an array of entities that all share the provided entity as parent.
 *
 * @param parent - Parent of the entities you want to fetch.
 * @returns An array of entities that are children of the provided entity. If the entity has no children, it returns an empty array.
 * @public
 */
export function getEntitiesWithParent(parent: Entity): Entity[] {
  const entitiesWithParent: Entity[] = [];

  for (const [entity, transform] of engine.getEntitiesWith(Transform)) {
    if (transform.parent === parent) {
      entitiesWithParent.push(entity);
    }
  }

  return entitiesWithParent;
}

/**
 * Returns an entity that is the parent of the provided entity.
 *
 * @param child - Child of the entity you want to fetch.
 * @returns The parent entity. If no parent is found it defaults to the root entity of the scene.
 * @public
 */

export function getEntityParent(child: Entity): Entity {
  const transform = Transform.getOrNull(child);
  if (transform) {
    return transform.parent as Entity;
  } else {
    return engine.RootEntity as Entity;
  }
}

/**
 * Returns the position of the player's avatar.
 *
 * @returns A Vector3 with the current position of the player's avatar, relative to the scene's origin. If no data can be retrieved, it returns (0,0,0).
 * @public
 */
export function getPlayerPosition(): Vector3 {
  return Transform.getOrNull(engine.PlayerEntity)?.position || Vector3.create();
}
