import type { AbstractMesh, Mesh } from '@babylonjs/core';
import { HighlightLayer, Constants, StandardMaterial, Color4 } from '@babylonjs/core';
import { ComponentType } from '@dcl/ecs';
import type { EditorComponentsTypes } from '../../../sdk/components';
import { CoreComponents } from '../../../sdk/components';
import type { EcsEntity } from '../EcsEntity';
import type { ComponentOperation } from '../component-operations';
import { boxSelectionManager } from '../box-selection-manager';

// Store highlight info
type HighlightInfo = {
  highlightLayer: HighlightLayer;
  originalRenderingGroupId: number;
  xrayMesh?: AbstractMesh; // Mesh that renders ONLY occluded parts (GEQUAL depth test)
};

const highlightedMeshes = new Map<AbstractMesh, HighlightInfo>();

// Subscribe to X-Ray setting changes and update all highlights
boxSelectionManager.onChange(values => {
  updateAllHighlightsXRayMode(values.xRayEnabled);
});

function updateAllHighlightsXRayMode(xRayEnabled: boolean) {
  for (const [mesh, info] of highlightedMeshes) {
    updateHighlightXRayMode(mesh, info, xRayEnabled);
  }
}

/**
 * X-ray mode: Shows occluded parts with a "see through walls" effect
 * Simplified approach: Always render on top with reduced opacity to simulate X-ray
 */
function updateHighlightXRayMode(mesh: AbstractMesh, info: HighlightInfo, xRayEnabled: boolean) {
  if (xRayEnabled && !info.xrayMesh) {
    // Create a clone for X-ray effect
    const xrayClone = mesh.clone(`xray_${mesh.uniqueId}`, null);
    if (!xrayClone) return;

    const scene = mesh.getScene();

    // Make the clone mesh itself invisible but keep edges visible
    const xrayMat = new StandardMaterial(`xrayMat_${mesh.uniqueId}`, scene);
    xrayMat.alpha = 0; // Completely transparent mesh
    xrayMat.alphaMode = Constants.ALPHA_COMBINE;

    // CRITICAL: Make edges render through walls
    xrayMat.depthFunction = Constants.ALWAYS; // Always render (through walls)
    xrayMat.disableDepthWrite = true; // Don't write to depth buffer

    xrayClone.material = xrayMat;
    xrayClone.renderingGroupId = 2; // Render after everything
    xrayClone.isPickable = false; // Don't interfere with picking

    // Use EdgesRenderer for SOLID lines (no glow!)
    (xrayClone as Mesh).enableEdgesRendering();
    (xrayClone as Mesh).edgesWidth = 3.0; // Slightly thinner than normal selection
    (xrayClone as Mesh).edgesColor = new Color4(1, 0.65, 0, 1); // Orange for X-ray

    info.xrayMesh = xrayClone;
  } else if (!xRayEnabled && info.xrayMesh) {
    // Clean up X-ray mesh and edges
    (info.xrayMesh as Mesh).disableEdgesRendering();
    info.xrayMesh.dispose(false, true);
    info.xrayMesh = undefined;
  }
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

export function toggleMeshSelection(mesh: AbstractMesh, value: boolean) {
  // Don't use renderOverlay - it makes the whole mesh glow
  // We only want the HighlightLayer outline effect
  const info = highlightedMeshes.get(mesh);
  if (value && !info) {
    // Save the original rendering group ID before we potentially modify it
    const originalRenderingGroupId = mesh.renderingGroupId;

    const scene = mesh.getScene();

    console.log('[Selection] Enabling edges for mesh:', mesh.name, mesh.uniqueId);

    // ONLY use EdgesRenderer - NO HighlightLayer glow!
    // First disable if already enabled to prevent accumulation
    (mesh as Mesh).disableEdgesRendering();
    (mesh as Mesh).enableEdgesRendering();
    (mesh as Mesh).edgesWidth = 4.0; // Normal selection - keep visible
    (mesh as Mesh).edgesColor = new Color4(1, 1, 0, 1); // Yellow outline

    // Create a dummy HighlightLayer just to keep the data structure (but don't use it!)
    const dummyHl = new HighlightLayer(`hl_${mesh.uniqueId}`, scene, {
      mainTextureRatio: 0.1,
      blurTextureSizeRatio: 0.1,
      isStroke: false,
      camera: null,
    });
    // DON'T add the mesh to it! This prevents the glow!

    // Store the highlight layer reference and original rendering group
    const highlightInfo: HighlightInfo = {
      highlightLayer: dummyHl,
      originalRenderingGroupId,
    };
    highlightedMeshes.set(mesh, highlightInfo);

    // Set up X-Ray mode based on current setting
    const isXRayEnabled = boxSelectionManager.isXRayEnabled();
    if (isXRayEnabled) {
      updateHighlightXRayMode(mesh, highlightInfo, true);
    }
  } else if (value && info) {
    // Already selected - don't re-enable edges to prevent brightening
    console.log('[Selection] Mesh already selected, skipping:', mesh.name, mesh.uniqueId);
    return;
  } else if (!value && info) {
    // Disable edges rendering
    (mesh as Mesh).disableEdgesRendering();

    // Clean up X-ray mesh if it exists
    if (info.xrayMesh) {
      info.xrayMesh.dispose(false, true);
    }

    // Clean up highlight layer
    try {
      info.highlightLayer.removeMesh(mesh as Mesh);
      info.highlightLayer.dispose();
    } catch (e) {
      console.warn('[Selection] Error disposing highlight layer:', e);
    }

    // Restore original rendering group
    mesh.renderingGroupId = info.originalRenderingGroupId;

    // Remove from map
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
        // Skip colliders and X-ray clone meshes
        if (mesh.name.includes('collider')) continue;
        if (mesh.name.startsWith('xray_')) continue;
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
