import * as BABYLON from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../decentraland/EcsEntity';
import type { SceneContext } from '../decentraland/SceneContext';
import { getLayoutManager } from '../decentraland/layout-manager';
import { snapManager } from '../decentraland/snap-manager';

type HoverChangeCallback = (entityId: Entity | null) => void;
const hoverChangeCallbacks = new Set<HoverChangeCallback>();

export function subscribeToHoverChange(cb: HoverChangeCallback): () => void {
  hoverChangeCallbacks.add(cb);
  return () => hoverChangeCallbacks.delete(cb);
}

function notifyHoverChange(entityId: Entity | null): void {
  for (const cb of hoverChangeCallbacks) cb(entityId);
}

function isEcsEntity(x: unknown): x is EcsEntity {
  return typeof x === 'object' && x !== null && 'isDCLEntity' in (x as object);
}

function findParentEntity(node: BABYLON.Node): EcsEntity | null {
  let current: BABYLON.Node | null = node;
  while (current) {
    if (isEcsEntity(current)) return current;
    current = current.parent;
  }
  return null;
}

let cachedContext: SceneContext | null = null;

function getSceneContext(scene: BABYLON.Scene) {
  if (cachedContext) return cachedContext;
  const entity = scene.transformNodes.find(n => isEcsEntity(n)) as EcsEntity | undefined;
  if (entity) cachedContext = entity.context.deref() ?? null;
  return cachedContext;
}

export function initHover(scene: BABYLON.Scene): void {
  // ── Subparcel highlight ──────────────────────────────────────────────────
  const subparcelMesh = BABYLON.MeshBuilder.CreatePlane('subparcel_hover', { size: 1 }, scene);
  subparcelMesh.rotation.x = Math.PI / 2;
  subparcelMesh.position.y = 0.005;
  subparcelMesh.isPickable = false;
  subparcelMesh.isVisible = false;

  const subparcelMat = new BABYLON.StandardMaterial('subparcel_hover_mat', scene);
  subparcelMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  subparcelMat.alpha = 0.08;
  subparcelMat.backFaceCulling = false;
  subparcelMesh.material = subparcelMat;

  const groundPlane = BABYLON.Plane.FromPositionAndNormal(
    BABYLON.Vector3.Zero(),
    BABYLON.Vector3.Up(),
  );

  // ── Entity hover highlight ───────────────────────────────────────────────
  // Using renderOverlay instead of HighlightLayer: no post-processing pass,
  // no blur artifacts, works reliably on all mesh/material types.
  const HOVER_COLOR = new BABYLON.Color3(0.5, 0.85, 1.0); // soft cyan
  const HOVER_ALPHA = 0.22;

  let hoveredEntity: EcsEntity | null = null;
  const hoveredMeshes = new Set<BABYLON.AbstractMesh>();

  function clearEntityHover(): void {
    if (hoveredEntity === null) return;
    notifyHoverChange(null);
    // renderOverlay (hover) is independent of renderOutline (selection),
    // so clearing hover never affects the selection outline.
    for (const mesh of hoveredMeshes) {
      mesh.renderOverlay = false;
    }
    hoveredMeshes.clear();
    hoveredEntity = null;
  }

  function addToHover(mesh: BABYLON.AbstractMesh): void {
    if (mesh.name.includes('collider')) return;
    mesh.overlayColor = HOVER_COLOR;
    mesh.overlayAlpha = HOVER_ALPHA;
    mesh.renderOverlay = true;
    hoveredMeshes.add(mesh);
  }

  function setEntityHover(entity: EcsEntity): void {
    if (entity === hoveredEntity) return;
    clearEntityHover();
    hoveredEntity = entity;
    notifyHoverChange(entity.entityId);

    if (entity.meshRenderer) {
      addToHover(entity.meshRenderer);
    }
    if (entity.gltfContainer) {
      for (const mesh of entity.gltfContainer.getChildMeshes()) {
        addToHover(mesh);
      }
    }
  }

  function updateSubparcel(worldPos: BABYLON.Vector3): void {
    const snapDist = snapManager.getPositionSnap() || 1;
    const cx = Math.floor(worldPos.x / snapDist) * snapDist + snapDist / 2;
    const cz = Math.floor(worldPos.z / snapDist) * snapDist + snapDist / 2;
    // Scale the 1×1 plane to match the snap cell size (local XY → world XZ after π/2 rotation)
    subparcelMesh.scaling.x = snapDist;
    subparcelMesh.scaling.y = snapDist;
    subparcelMesh.position.set(cx, 0.005, cz);
    subparcelMesh.isVisible = true;
  }

  // ── Pointer move handler ─────────────────────────────────────────────────
  scene.onPointerObservable.add(evt => {
    if (evt.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;

    const pick = scene.pick(scene.pointerX, scene.pointerY);
    const pickedMesh = pick?.pickedMesh;
    const entity = pickedMesh ? findParentEntity(pickedMesh) : null;

    if (entity && !entity.isLocked() && !entity.isHidden()) {
      const context = getSceneContext(scene);
      const isSelected = context?.editorComponents.Selection.has(entity.entityId) ?? false;
      if (!isSelected) {
        setEntityHover(entity);
      } else {
        clearEntityHover();
      }
      subparcelMesh.isVisible = false;
      return;
    }

    // No entity under cursor — show subparcel highlight on ground
    clearEntityHover();

    const camera = scene.activeCamera;
    if (!camera) {
      subparcelMesh.isVisible = false;
      return;
    }

    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, camera);
    const dist = ray.intersectsPlane(groundPlane);
    if (dist !== null && dist > 0) {
      const worldPos = ray.origin.add(ray.direction.scale(dist));
      const layoutManager = getLayoutManager(scene);
      if (layoutManager.isPositionInBounds(worldPos)) {
        updateSubparcel(worldPos);
      } else {
        subparcelMesh.isVisible = false;
      }
    } else {
      subparcelMesh.isVisible = false;
    }
  });

  // Hide highlights when the cursor leaves the canvas
  scene
    .getEngine()
    .getRenderingCanvas()
    ?.addEventListener('pointerleave', () => {
      clearEntityHover();
      subparcelMesh.isVisible = false;
    });
}
