import type { Entity } from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import type { EngineComponents } from './definitions';

export type FollowAction = {
  target: Entity;
  speed: number;
  minDistance: number;
  axes: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
};

export const followMap = new Map<Entity, FollowAction>();

export function createTransformSystem(components: EngineComponents) {
  const { Transform } = components;
  return function transformSystem() {
    for (const [entity, { target, speed, minDistance, axes }] of followMap) {
      const entityTransform = Transform.getMutableOrNull(entity);
      const targetTransform = Transform.getOrNull(target);

      if (!entityTransform || !targetTransform) continue;
      const direction = Vector3.subtract(targetTransform.position, entityTransform.position);
      const distance = Vector3.length(direction);
      if (distance < minDistance) continue;
      const normalized = Vector3.normalize(direction);
      const move = Vector3.scale(normalized, speed / 10);
      if (Vector3.length(move) > distance) continue;
      if (!axes.x) move.x = 0;
      if (!axes.y) move.y = 0;
      if (!axes.z) move.z = 0;
      Vector3.addToRef(move, entityTransform.position, entityTransform.position);
      const lookAt = Vector3.clone(targetTransform.position);
      if (!axes.x) lookAt.x = entityTransform.position.x;
      if (!axes.y) lookAt.y = entityTransform.position.y;
      if (!axes.z) lookAt.z = entityTransform.position.z;
      const lookAtRotation = Quaternion.fromLookAt(entityTransform.position, lookAt);
      entityTransform.rotation = lookAtRotation;
    }
  };
}
