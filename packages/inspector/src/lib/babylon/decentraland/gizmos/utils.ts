import {
  Vector3,
  TransformNode,
  Quaternion,
  StandardMaterial,
  MeshBuilder,
  type Scene,
  type Mesh,
  type Color3,
} from '@babylonjs/core';
import type { EcsEntity } from '../EcsEntity';
import type { GizmoAxis } from './types';
import { FULL_ALPHA } from './constants';

export const TransformUtils = {
  convertToLocalPosition(worldPosition: Vector3, parent: TransformNode | null): Vector3 {
    if (!parent) return worldPosition.clone();
    const worldMatrixInverse = parent.getWorldMatrix().clone().invert();
    return Vector3.TransformCoordinates(worldPosition, worldMatrixInverse);
  },

  convertToLocalRotation(worldRotation: Quaternion, parent: TransformNode | null): Quaternion {
    if (!parent) return worldRotation.clone();
    const parentWorldRotation =
      parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());
    return parentWorldRotation.invert().multiply(worldRotation);
  },

  getWorldRotation(entity: EcsEntity): Quaternion {
    if (!entity.rotationQuaternion) return Quaternion.Identity();
    if (!entity.parent || !(entity.parent instanceof TransformNode)) {
      return entity.rotationQuaternion.clone();
    }
    const parentWorldRotation =
      (entity.parent as TransformNode).rotationQuaternion ||
      Quaternion.FromRotationMatrix((entity.parent as TransformNode).getWorldMatrix());
    return parentWorldRotation.multiply(entity.rotationQuaternion);
  },

  getParentWorldScale(parent: TransformNode | null): Vector3 {
    if (!parent) return new Vector3(1, 1, 1);
    const scale = new Vector3();
    const rotation = new Quaternion();
    const position = new Vector3();
    parent.getWorldMatrix().decompose(scale, rotation, position);
    return scale;
  },

  alignGizmo(gizmoNode: TransformNode, currentEntities: EcsEntity[]): void {
    if (currentEntities.length === 1) {
      const entity = currentEntities[0];
      if (entity.rotationQuaternion && gizmoNode.rotationQuaternion) {
        // If the entity has a parent, convert to world rotation
        if (entity.parent && entity.parent instanceof TransformNode) {
          const parent = entity.parent as TransformNode;
          const parentWorldRotation =
            parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());
          const worldRotation = parentWorldRotation.multiply(entity.rotationQuaternion);
          gizmoNode.rotationQuaternion.copyFrom(worldRotation);
        } else {
          // If no parent, apply directly
          gizmoNode.rotationQuaternion.copyFrom(entity.rotationQuaternion);
        }
      }
    } else {
      // For multiple entities, always reset to identity rotation
      // This provides a consistent reference point for scaling operations
      if (gizmoNode.rotationQuaternion) {
        gizmoNode.rotationQuaternion.set(0, 0, 0, 1); // Quaternion.Identity()
      }
    }

    gizmoNode.computeWorldMatrix(true);
  },
};

// Helper function to configure gizmo buttons for left-click only
export function configureGizmoButtons(gizmo: GizmoAxis, buttons: number[]) {
  if (gizmo && gizmo.xGizmo && gizmo.yGizmo && gizmo.zGizmo) {
    gizmo.xGizmo.dragBehavior.dragButtons = buttons;
    gizmo.yGizmo.dragBehavior.dragButtons = buttons;
    gizmo.zGizmo.dragBehavior.dragButtons = buttons;
  }
}

/**
 * Creates a thin plane cube for scale gizmo planar scaling
 * @returns Tuple of [mesh, material] for the created plane
 */
export function createPlane(
  scene: Scene,
  rootMesh: Mesh,
  name: string,
  width: number,
  height: number,
  depth: number,
  position: Vector3,
  diffuseColor: Color3,
  emissiveColor: Color3,
): [Mesh, StandardMaterial] {
  const plane = MeshBuilder.CreateBox(
    `${name}Mesh`,
    {
      width: width,
      height: height,
      depth: depth,
    },
    scene,
  );
  plane.position = position;
  const material = new StandardMaterial(`${name}Mat`, scene);
  material.diffuseColor = diffuseColor;
  material.emissiveColor = emissiveColor;
  material.alpha = FULL_ALPHA;
  material.disableLighting = true;
  plane.material = material;
  plane.parent = rootMesh;
  plane.isPickable = true; // always pickable

  return [plane, material];
}
