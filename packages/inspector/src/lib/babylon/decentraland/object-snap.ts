import { Vector3 } from '@babylonjs/core';
import type { EcsEntity } from './EcsEntity';

const SNAP_THRESHOLD = 1.0;

function getRefreshedBoundingBox(entity: EcsEntity) {
  const children = entity.gltfContainer
    ? entity.gltfContainer.getChildMeshes(false)
    : entity.getChildMeshes(false);
  if (children.length === 0) return null;
  // Force world matrices current so minimumWorld/maximumWorld are fresh
  for (const child of children) {
    child.computeWorldMatrix(true);
  }
  return entity.getMeshesBoundingBox(children);
}

function computeBoundingBoxSnapPoints(min: Vector3, max: Vector3): Vector3[] {
  const midX = (min.x + max.x) / 2;
  const midY = (min.y + max.y) / 2;
  const midZ = (min.z + max.z) / 2;

  return [
    // 8 corners
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, max.y, max.z),

    // 12 edge midpoints
    new Vector3(midX, min.y, min.z),
    new Vector3(midX, min.y, max.z),
    new Vector3(min.x, min.y, midZ),
    new Vector3(max.x, min.y, midZ),
    new Vector3(midX, max.y, min.z),
    new Vector3(midX, max.y, max.z),
    new Vector3(min.x, max.y, midZ),
    new Vector3(max.x, max.y, midZ),
    new Vector3(min.x, midY, min.z),
    new Vector3(max.x, midY, min.z),
    new Vector3(min.x, midY, max.z),
    new Vector3(max.x, midY, max.z),

    // 6 face centers
    new Vector3(midX, min.y, midZ),
    new Vector3(midX, max.y, midZ),
    new Vector3(min.x, midY, midZ),
    new Vector3(max.x, midY, midZ),
    new Vector3(midX, midY, min.z),
    new Vector3(midX, midY, max.z),
  ];
}

export type ObjectSnapResult = {
  /** The adjusted world position for the dragged entity. */
  position: Vector3;
  /** The bounding-box snap point on the TARGET entity that was matched. */
  snapPoint: Vector3;
  /** The bounding-box snap point on the ORIGIN (dragged) entity that matched. */
  originPoint: Vector3;
};

/**
 * Attempts to snap `entity` to a nearby entity's bounding box snap points.
 * Returns the snapped world position and the matched target point, or null if no target is within threshold.
 *
 * @param entity - The entity being dragged.
 * @param newWorldPosition - The proposed new world position for the entity.
 * @param targetEntities - Candidate snap target entities (should exclude dragged entities).
 */
export function computeObjectSnap(
  entity: EcsEntity,
  newWorldPosition: Vector3,
  targetEntities: EcsEntity[],
): ObjectSnapResult | null {
  // Force-refresh the dragged entity's bounding box to ensure consistency
  const bb = getRefreshedBoundingBox(entity);
  if (!bb) return null;

  // With fresh world matrices, entity.getAbsolutePosition() is now consistent with the BB
  const originalPos = entity.getAbsolutePosition();
  const bbMin = bb.boundingBox.minimumWorld;
  const bbMax = bb.boundingBox.maximumWorld;

  // Compute snap point offsets from the entity's current world position.
  // These offsets are constant for pure translation (no rotation/scale during position drag).
  const minOffset = bbMin.subtract(originalPos);
  const maxOffset = bbMax.subtract(originalPos);

  // Project the offsets to the proposed new position
  const projectedMin = newWorldPosition.add(minOffset);
  const projectedMax = newWorldPosition.add(maxOffset);
  const draggedPoints = computeBoundingBoxSnapPoints(projectedMin, projectedMax);

  // Proximity filter: skip targets whose centers are farther than the dragged entity's
  // bounding-box half-diagonal + the snap threshold + a margin for the target's own size.
  // This avoids iterating every entity in the scene on each pointer-move.
  const draggedHalfDiagonal = Vector3.Distance(projectedMin, projectedMax) / 2;
  const proximityRadius = draggedHalfDiagonal + SNAP_THRESHOLD + 10;

  let bestDistance = SNAP_THRESHOLD;
  let bestOffset: Vector3 | null = null;
  let bestSnapPoint: Vector3 | null = null;
  let bestOriginPoint: Vector3 | null = null;

  for (const target of targetEntities) {
    if (Vector3.Distance(newWorldPosition, target.getAbsolutePosition()) > proximityRadius)
      continue;
    const targetBB = target.getGroupMeshesBoundingBox();
    if (!targetBB) continue;

    const targetPoints = computeBoundingBoxSnapPoints(
      targetBB.boundingBox.minimumWorld,
      targetBB.boundingBox.maximumWorld,
    );

    for (const draggedPoint of draggedPoints) {
      for (const targetPoint of targetPoints) {
        const dist = Vector3.Distance(draggedPoint, targetPoint);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestOffset = targetPoint.subtract(draggedPoint);
          bestSnapPoint = targetPoint;
          bestOriginPoint = draggedPoint;
        }
      }
    }
  }

  if (bestOffset && bestSnapPoint && bestOriginPoint) {
    const snappedPosition = newWorldPosition.add(bestOffset);
    return {
      position: snappedPosition,
      // Point on the TARGET entity that was matched.
      snapPoint: bestSnapPoint,
      // Point on the DRAGGED entity that matched — corrected to its post-snap world position
      // (bestDraggedPoint was projected at newWorldPosition; after the offset the entity has moved
      // so its snap point is now co-located with snapPoint).
      originPoint: bestOriginPoint.add(bestOffset),
    };
  }
  return null;
}
