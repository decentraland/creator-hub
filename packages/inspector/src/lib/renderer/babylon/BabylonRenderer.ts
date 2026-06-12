import * as BABYLON from '@babylonjs/core';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import type { Vector3 } from '@dcl/ecs-math';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';

import type { SceneContext } from '../../babylon/decentraland/SceneContext';
import type { CameraManager } from '../../babylon/decentraland/camera';
import type { Gizmos } from '../../babylon/decentraland/GizmoManager';
import { getPointerCoords } from '../../babylon/decentraland/mouse-utils';
import { setupAxisHelper } from '../../babylon/setup/axisHelper';
import { GROUND_MESH_PREFIX } from '../../utils/scene';
import type { GizmoType } from '../../utils/gizmo';
import type {
  GroundPlane,
  IRenderer,
  RendererCamera,
  RendererDebug,
  RendererEvents,
  RendererGizmos,
  RendererMetrics,
  RendererViewport,
  SpawnPointController,
  SpawnPointTarget,
  Unsubscribe,
} from '../types';
import { computeEntitiesOutsideLayout, computeSceneMetrics } from './metrics';

const ZOOM_AXIS = new BABYLON.Vector3(0, 0, 1.1);

type AxisHelperHandle = { dispose(): void };

/**
 * The Babylon implementation of {@link IRenderer}.
 *
 * This is deliberately a thin *wiring* layer over the existing Babylon modules
 * (`SceneContext`, `CameraManager`, `Gizmos`, the spawn-point manager). It owns
 * no rendering logic of its own — it adapts the established Babylon surface to
 * the renderer-agnostic contract and, crucially, translates between the
 * contract's entity-ID vocabulary and Babylon's node objects so that those
 * objects never escape this file.
 */
export class BabylonRenderer implements IRenderer {
  // The reverse-channel bus lives on SceneContext so the Babylon input/gizmo
  // code can emit onto it; the adapter just re-exposes it as the contract's
  // `events`. Same emitter, two views.
  readonly events: Emitter<RendererEvents>;

  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly viewport: RendererViewport;
  readonly spawnPoints: SpawnPointController;
  readonly debug: RendererDebug;

  #axisHelper: AxisHelperHandle;

  constructor(
    private readonly context: SceneContext,
    private readonly cameraManager: CameraManager,
  ) {
    const scene = context.scene;
    const babylonGizmos = context.gizmos;
    const spawnPoints = context.spawnPoints;

    this.events = context.rendererEvents;
    this.camera = createCameraFacade(cameraManager, context);
    this.gizmos = createGizmosFacade(babylonGizmos);
    this.metrics = createMetricsFacade(scene, context);
    this.viewport = createViewportFacade(scene, context);
    this.spawnPoints = createSpawnPointsFacade(spawnPoints);
    this.debug = createDebugFacade(scene);

    // The axis indicator is a renderer editor-visual: it draws an orientation
    // gizmo into a secondary scene and follows the editor camera. The inspector
    // no longer reaches into the scene to set it up — the renderer owns it.
    this.#axisHelper = setupAxisHelper(scene, () => {
      const camera = cameraManager.getCamera();
      const direction = camera.target.subtract(camera.position).normalize();
      return {
        alpha: Math.atan2(direction.x, direction.z),
        beta: Math.acos(direction.y),
      };
    });

    // Bridge the renderer's native speed observable into the agnostic event bus.
    cameraManager.getSpeedChangeObservable().on('change', speed => {
      this.events.emit('cameraSpeedChange', { speed });
    });
  }

  setSelection(_entities: Entity[]): void {
    // Selection is currently driven through the ECS Selection editor-component,
    // which the renderer already projects to visuals via putEntitySelectedComponent.
    // The method exists so callers can stop reaching for Babylon directly; the
    // ECS-driven path remains the source of truth during migration.
  }

  pickAt(x: number, y: number): { entity: Entity | null; point: Vector3 | null } {
    const pick = this.context.scene.pick(x, y, undefined, false);
    const mesh = pick?.pickedMesh ?? null;
    const entity = mesh ? this.findEntityByMesh(mesh) : null;
    const p = pick?.pickedPoint;
    return {
      entity,
      point: p ? DclVector3.create(p.x, p.y, p.z) : null,
    };
  }

  async getPointerWorldPoint(): Promise<Vector3 | null> {
    const point = await getPointerCoords(this.context.scene);
    return point ? DclVector3.create(point.x, point.y, point.z) : null;
  }

  setGridVisible(visible: boolean): void {
    const layout = this.context.scene.getNodeByName('layout');
    layout?.setEnabled(visible);
  }

  dispose(): void {
    this.#axisHelper.dispose();
    this.events.all.clear();
  }

  private findEntityByMesh(mesh: BABYLON.AbstractMesh): Entity | null {
    let node: BABYLON.Node | null = mesh;
    while (node) {
      const entity = (node as { entityId?: Entity }).entityId;
      if (entity !== undefined) return entity;
      node = node.parent;
    }
    return null;
  }
}

// --- Camera facade ---------------------------------------------------------

function createCameraFacade(cm: CameraManager, context: SceneContext): RendererCamera {
  return {
    getSpeed: () => cm.getSpeed(),
    reset: () => cm.resetCamera(),
    focusOnEntity: entity => {
      const node = context.getEntityOrNull(entity);
      if (node) cm.centerViewOnEntity(node);
    },
    setInvertRotation: invert => cm.setFreeCameraInvertRotation(invert),
    zoom: step => {
      const camera = cm.getCamera();
      const dir = camera.getDirection(ZOOM_AXIS);
      if (step < 0) dir.negateInPlace();
      camera.position.addInPlace(dir);
    },
    getPose: () => {
      const camera = cm.getCamera();
      return {
        position: DclVector3.create(camera.position.x, camera.position.y, camera.position.z),
        target: DclVector3.create(camera.target.x, camera.target.y, camera.target.z),
        fov: camera.fov,
      };
    },
    setPose: (position, target) => {
      const camera = cm.getCamera();
      camera.position.set(position.x, position.y, position.z);
      camera.setTarget(new BABYLON.Vector3(target.x, target.y, target.z));
    },
    setControlEnabled: enabled => {
      const camera = cm.getCamera();
      if (enabled) cm.reattachControl();
      else camera.detachControl();
    },
  };
}

// --- Gizmos facade ---------------------------------------------------------

function createGizmosFacade(g: Gizmos): RendererGizmos {
  return {
    isEnabled: () => g.isEnabled(),
    setEnabled: enabled => g.setEnabled(enabled),
    setMode: (mode: GizmoType) => g.setGizmoType(mode),
    isWorldAligned: () => g.isGizmoWorldAligned(),
    setWorldAligned: aligned => g.setGizmoWorldAligned(aligned),
    isWorldAlignmentDisabled: () => g.isGizmoWorldAlignmentDisabled(),
    onChange: (cb): Unsubscribe => g.onChange(cb),
  };
}

// --- Metrics facade --------------------------------------------------------

function createMetricsFacade(scene: BABYLON.Scene, context: SceneContext): RendererMetrics {
  return {
    getSceneMetrics: () => computeSceneMetrics(scene),
    getEntitiesOutsideLayout: () => computeEntitiesOutsideLayout(scene, context),
    onChange: (cb): Unsubscribe => {
      const handler = () => cb();
      // Anything that can change triangle/material/texture counts or
      // layout-bounds membership: mesh lifecycle, async data loads, and the
      // out-of-layout multi-material the bounds visual creates/removes.
      scene.onDataLoadedObservable.add(handler);
      scene.onMeshRemovedObservable.add(handler);
      scene.onNewMeshAddedObservable.add(handler);
      scene.onNewMultiMaterialAddedObservable.add(handler);
      scene.onMaterialRemovedObservable.add(handler);
      return () => {
        scene.onDataLoadedObservable.removeCallback(handler);
        scene.onMeshRemovedObservable.removeCallback(handler);
        scene.onNewMeshAddedObservable.removeCallback(handler);
        scene.onNewMultiMaterialAddedObservable.removeCallback(handler);
        scene.onMaterialRemovedObservable.removeCallback(handler);
      };
    },
  };
}

// --- Viewport facade -------------------------------------------------------

function createViewportFacade(scene: BABYLON.Scene, context: SceneContext): RendererViewport {
  return {
    onFrame: (cb): Unsubscribe => {
      const observer = scene.onAfterRenderObservable.add(() => cb());
      return () => scene.onAfterRenderObservable.remove(observer);
    },
    getGroundPlanes: (): GroundPlane[] =>
      scene.meshes
        .filter(mesh => mesh.name.startsWith(GROUND_MESH_PREFIX))
        .map(mesh => ({ x: mesh.absolutePosition.x, z: mesh.absolutePosition.z })),
    getEntityWorldPositions: (entities: Entity[]): Map<Entity, Vector3> => {
      const positions = new Map<Entity, Vector3>();
      for (const entity of entities) {
        const node = context.getEntityOrNull(entity);
        if (!node || !node.isEnabled()) continue;
        const p = node.absolutePosition;
        positions.set(entity, DclVector3.create(p.x, p.y, p.z));
      }
      return positions;
    },
  };
}

// --- Spawn points facade ---------------------------------------------------

function createSpawnPointsFacade(sp: SceneContext['spawnPoints']): SpawnPointController {
  return {
    getSelectedIndex: () => sp.getSelectedIndex(),
    getSelectedTarget: () => sp.getSelectedTarget() as SpawnPointTarget | null,
    isHidden: name => sp.isSpawnPointHidden(name),
    select: index => sp.selectSpawnPoint(index),
    selectCameraTarget: index => sp.selectCameraTarget(index),
    setVisible: (index, name, visible) => sp.setSpawnPointVisible(index, name, visible),
    onSelectionChange: cb =>
      sp.onSelectionChange(({ index, target }) =>
        cb({ index, target: target as SpawnPointTarget | null }),
      ),
    onVisibilityChange: cb => sp.onVisibilityChange(({ name, visible }) => cb({ name, visible })),
  };
}

// --- Debug facade ----------------------------------------------------------

function createDebugFacade(scene: BABYLON.Scene): RendererDebug {
  return {
    isVisible: () => scene.debugLayer.isVisible(),
    toggle: () => {
      if (scene.debugLayer.isVisible()) scene.debugLayer.hide();
      else void scene.debugLayer.show({ showExplorer: true, embedMode: true });
    },
  };
}
