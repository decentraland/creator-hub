import type { AbstractMesh, Mesh } from '@babylonjs/core';
import { Color3, HighlightLayer } from '@babylonjs/core';
import { ComponentType } from '@dcl/ecs';
import type { EditorComponentsTypes } from '../../../sdk/components';
import { CoreComponents } from '../../../sdk/components';
import type { EcsEntity } from '../EcsEntity';
import type { ComponentOperation } from '../component-operations';

const highlightedMeshes = new Map<AbstractMesh, HighlightLayer>();

export const putEntitySelectedComponent: ComponentOperation = (entity, component) => {
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    if (entity.isLocked()) return deleteEntitySelectedComponent(entity, component);

    const componentValue = component.get(
      entity.entityId,
    ) as unknown as EditorComponentsTypes['Selection'];
    setGizmoManager(entity, componentValue);
    if (entity.boundingInfoMesh) {
      entity.boundingInfoMesh.onAfterWorldMatrixUpdateObservable.notifyObservers(
        entity.boundingInfoMesh,
      );
    }
  }
};

export const deleteEntitySelectedComponent: ComponentOperation = (entity, component) => {
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    unsetGizmoManager(entity);

    entity.cleanupBoundingBox();

    if (entity.boundingInfoMesh) {
      entity.boundingInfoMesh.onAfterWorldMatrixUpdateObservable.notifyObservers(
        entity.boundingInfoMesh,
      );
    }
  }
};

export function toggleMeshSelection(mesh: AbstractMesh, value: boolean) {
  mesh.renderOverlay = value;
  mesh.overlayColor = new Color3(0.9, 0.9, 0.9); // 10% grey (90% brightness instead of 100%)
  mesh.overlayAlpha = 0.12; // 20% opacity - more visible than before
  const hl = highlightedMeshes.get(mesh);
  if (value && !hl) {
    const newHl = new HighlightLayer('hl1', mesh.getScene(), {
      mainTextureRatio: 2, // Higher resolution for sharper edges
      blurTextureSizeRatio: 0.5, // Sharper blur
      isStroke: false,
      camera: null,
    });
    newHl.addMesh(mesh as Mesh, Color3.FromHexString('#FFFF00')); // Bright pure yellow
    newHl.blurHorizontalSize = 0.5; // More blur for more visible glow
    newHl.blurVerticalSize = 0.5;
    newHl.innerGlow = false; // Only outer glow for cleaner look
    highlightedMeshes.set(mesh, newHl);
  } else if (!value && hl) {
    hl.removeMesh(mesh as Mesh);
    highlightedMeshes.delete(mesh);
  }
}

export const toggleSelection = (entity: EcsEntity, value: boolean) => {
  if (entity.meshRenderer) {
    toggleMeshSelection(entity.meshRenderer, value);
  }

  void entity.onAssetLoaded().then(() => {
    if (entity.gltfContainer) {
      for (const mesh of entity.gltfContainer.getChildMeshes()) {
        if (mesh.name.includes('collider')) continue;
        toggleMeshSelection(mesh, value);
      }
    }
  });
};

export const setGizmoManager = (entity: EcsEntity, value: { gizmo: number }) => {
  const context = entity.context.deref()!;
  const Transform = context.engine.getComponent(CoreComponents.TRANSFORM);

  if (!Transform.has(entity.entityId)) return;

  toggleSelection(entity, true);

  const types = context.gizmos.getGizmoTypes();
  const type = types[value?.gizmo || 0];
  context.gizmos.setGizmoType(type);
  context.gizmos.addEntity(entity);
};

export const unsetGizmoManager = (entity: EcsEntity) => {
  const context = entity.context.deref()!;
  toggleSelection(entity, false);
  context.gizmos.removeEntity(entity);
};
