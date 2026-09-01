import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  Vector3Type,
} from '@dcl/ecs';
import { CoreComponents } from '../components/types';

/**
 * Components whose `area` field (a 3D region size in meters) must mirror the
 * entity's Transform scale. The runtime ignores the Transform scale for these
 * regions — the region size comes solely from `area` — so the editor keeps
 * `area` in sync with the scale to make the visible placeholder cube match
 * the actual effect region.
 */
export const AREA_COMPONENTS: string[] = [
  CoreComponents.AVATAR_MODIFIER_AREA,
  CoreComponents.CAMERA_MODE_AREA,
];

type WithArea = { area?: Vector3Type };

export function isAreaComponent(componentName: string): boolean {
  return AREA_COMPONENTS.includes(componentName);
}

/** Returns the entity's Transform scale, or {1,1,1} when it has no Transform. */
export function getEntityScale(engine: IEngine, entity: Entity): Vector3Type {
  const Transform = engine.getComponentOrNull(CoreComponents.TRANSFORM) as {
    getOrNull(entity: Entity): { scale?: Vector3Type } | null;
  } | null;
  const scale = Transform?.getOrNull(entity)?.scale;
  return scale ? { x: scale.x, y: scale.y, z: scale.z } : { x: 1, y: 1, z: 1 };
}

/**
 * Copies `scale` into the `area` field of every area-bearing component on the
 * entity. Runs inside the same operation batch as the Transform write, so the
 * area update rides the same dispatch (and the same undo step).
 */
export function syncAreaWithScale(engine: IEngine, entity: Entity, scale: Vector3Type): void {
  for (const componentName of AREA_COMPONENTS) {
    const component = engine.getComponentOrNull(
      componentName,
    ) as LastWriteWinElementSetComponentDefinition<WithArea> | null;
    if (!component) continue;
    const value = component.getMutableOrNull(entity);
    if (!value) continue;
    value.area = { x: scale.x, y: scale.y, z: scale.z };
  }
}
