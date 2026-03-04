import { Color3, type HighlightLayer, Mesh, type AbstractMesh, type Scene } from '@babylonjs/core';
import { ComponentType } from '@dcl/ecs';
import type { EditorComponentsTypes } from '../../../sdk/components';
import { CoreComponents } from '../../../sdk/components';
import type { EcsEntity } from '../EcsEntity';
import type { ComponentOperation } from '../component-operations';

const highlightedMeshes = new Set<AbstractMesh>();
let cachedHighlightLayer: HighlightLayer | undefined;

function getSelectionHighlightLayer(scene: Scene): HighlightLayer | undefined {
  if (!cachedHighlightLayer) {
    cachedHighlightLayer = scene.effectLayers.find(l => l.name === 'selection_highlight') as
      | HighlightLayer
      | undefined;
  }
  return cachedHighlightLayer;
}

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

export function toggleMeshSelection(mesh: AbstractMesh, value: boolean): void {
  mesh.renderOverlay = value;
  mesh.overlayColor = Color3.White();
  mesh.overlayAlpha = 0.2;

  if (!(mesh instanceof Mesh)) return;

  const highlightLayer = getSelectionHighlightLayer(mesh.getScene());

  if (value && !highlightedMeshes.has(mesh)) {
    highlightLayer?.addMesh(mesh, Color3.Yellow());
    highlightedMeshes.add(mesh);
  } else if (!value && highlightedMeshes.has(mesh)) {
    highlightLayer?.removeMesh(mesh);
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
