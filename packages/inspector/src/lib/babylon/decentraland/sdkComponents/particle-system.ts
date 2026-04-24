import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import { ComponentType } from '@dcl/ecs';

import type { ParticleSystemComponentType } from '../../../sdk/components/ParticleSystem';
import type { ComponentOperation } from '../component-operations';
import type { EcsEntity } from '../EcsEntity';
import { toggleMeshSelection } from '../editorComponents/selection';

const SHAPE_TYPE_POINT = 0;
const SHAPE_TYPE_SPHERE = 1;
const SHAPE_TYPE_CONE = 2;
const SHAPE_TYPE_BOX = 3;

const HELPER_COLOR = new Color3(0.2, 0.8, 1.0);

function getOrCreateHelperMaterial(entity: EcsEntity) {
  const scene = entity.scene || entity.getScene();
  const matName = `particleSystemHelperMat-${entity.entityId}`;
  let material = scene.getMaterialByName(matName) as StandardMaterial | null;
  if (!material) {
    material = new StandardMaterial(matName, scene);
    material.wireframe = true;
    material.diffuseColor = HELPER_COLOR;
    material.alpha = 0.5;
    material.disableLighting = true;
    material.emissiveColor = HELPER_COLOR;
  }
  return material;
}

function removeParticleSystemHelper(entity: EcsEntity) {
  const helper = (entity as any).particleSystemHelper as Mesh | undefined;
  const ownsMeshRenderer = helper !== undefined && entity.meshRenderer === helper;

  if (helper) {
    helper.setEnabled(false);
    helper.parent = null;
    helper.dispose(false, false);
    delete (entity as any).particleSystemHelper;
  }

  if (ownsMeshRenderer) {
    delete entity.meshRenderer;
    if (entity.boundingInfoMesh) {
      entity.boundingInfoMesh.dispose();
      delete entity.boundingInfoMesh;
    }
  }
}

export const putParticleSystemComponent: ComponentOperation = (entity, component) => {
  if (component.componentType !== ComponentType.LastWriteWinElementSet) return;

  const value = component.getOrNull(entity.entityId) as ParticleSystemComponentType | null;

  removeParticleSystemHelper(entity);

  if (!value) return;

  const scene = entity.scene || entity.getScene();
  if (!scene) return;

  const shapeType = value.shapeType ?? SHAPE_TYPE_POINT;
  let mesh: Mesh | undefined;
  const material = getOrCreateHelperMaterial(entity);

  switch (shapeType) {
    case SHAPE_TYPE_POINT: {
      mesh = MeshBuilder.CreateSphere(
        `ps-helper-${entity.entityId}`,
        { diameter: 0.15, segments: 8 },
        scene,
      );
      break;
    }
    case SHAPE_TYPE_SPHERE: {
      const radius = value.sphereRadius ?? 1;
      mesh = MeshBuilder.CreateSphere(
        `ps-helper-${entity.entityId}`,
        { diameter: radius * 2, segments: 16 },
        scene,
      );
      break;
    }
    case SHAPE_TYPE_CONE: {
      const angle = value.coneAngle ?? 25;
      const radius = value.coneRadius ?? 1;
      const height = radius * 2;
      const topRadius = Math.tan((angle * Math.PI) / 180) * height;
      mesh = MeshBuilder.CreateCylinder(
        `ps-helper-${entity.entityId}`,
        {
          diameterTop: topRadius * 2,
          diameterBottom: radius * 2,
          height,
          tessellation: 16,
        },
        scene,
      );
      break;
    }
    case SHAPE_TYPE_BOX: {
      const size = value.boxSize ?? { x: 1, y: 1, z: 1 };
      mesh = MeshBuilder.CreateBox(
        `ps-helper-${entity.entityId}`,
        {
          width: size.x,
          height: size.y,
          depth: size.z,
        },
        scene,
      );
      break;
    }
  }

  if (!mesh) return;

  mesh.material = material;
  mesh.isPickable = true;
  mesh.parent = entity;
  (entity as any).particleSystemHelper = mesh;

  // Register as the entity's meshRenderer so selection highlighting and picking
  // work. Skip when a real meshRenderer (e.g. from the MeshRenderer component)
  // is already present.
  if (!entity.meshRenderer) {
    entity.setMeshRenderer(mesh);
    entity.generateBoundingBox();

    const isSelected =
      entity.context.deref()?.editorComponents.Selection.has(entity.entityId) || false;
    toggleMeshSelection(mesh, isSelected);
  }
};
