import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';
import type { Vector3 } from '@dcl/ecs-math';

import type {
  GroundPlane,
  IRenderer,
  RendererAnimation,
  RendererCamera,
  RendererDebug,
  RendererEvents,
  RendererGizmos,
  RendererMetrics,
  RendererViewport,
  SpawnPointController,
  Unsubscribe,
} from '../types';
import type { GizmoType } from '../../utils/gizmo';
import { BevySceneContext } from './BevySceneContext';

/**
 * A minimal Bevy {@link IRenderer} — the conformance spike.
 *
 * This is the *contract surface* for the pluggable Bevy renderer, stood up
 * before the bevy-explorer wasm is wired in. It implements the same boundary the
 * Babylon and Three renderers do, with its own {@link BevySceneContext} (a CRDT
 * subscriber). It has **no engine yet**: the real bevy-explorer runs
 * out-of-process in an iframe (see the feasibility study), and this class is what
 * the inspector's {@link RemoteRenderer} will eventually drive — or, once an
 * in-process path exists, what mounts directly.
 *
 * Everything that needs the wasm (rendering, picking, gizmos, camera control) is
 * an honest no-op/stub that satisfies the interface and reports empty, so the
 * inspector degrades gracefully rather than assuming a scene graph. The camera
 * pose is tracked in memory purely so `setPose`/`getPose` cohere (the contract,
 * and the conformance suite, require a set pose to be reflected back).
 *
 * Scope (spike): satisfy `createRendererConformanceSuite`. Real editing — the
 * gizmo `gizmoCommit` reverse channel, the collider-layer pick, the
 * VirtualCamera rig — is the next slice, and maps almost 1:1 from bevy-editor's
 * scene-side implementation (see the gizmo mapping in the feasibility study).
 */
export class BevyRenderer implements IRenderer {
  readonly events: Emitter<RendererEvents> = mitt<RendererEvents>();

  readonly context: BevySceneContext;
  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly viewport: RendererViewport;
  readonly spawnPoints: SpawnPointController;
  readonly debug: RendererDebug;

  // In-memory camera pose. No wasm camera yet; this exists so the pose getters
  // are coherent (setPose → getPose) as the contract requires.
  #cameraPosition: Vector3 = DclVector3.create(8, 12, 24);
  #cameraTarget: Vector3 = DclVector3.create(8, 0, 8);
  #speed = 4;
  #gridVisible = true;
  #disposed = false;

  constructor() {
    this.context = new BevySceneContext();

    this.camera = this.#createCamera();
    this.gizmos = this.#createGizmoStub();
    this.metrics = this.#createMetrics();
    this.viewport = this.#createViewport();
    this.spawnPoints = this.#createSpawnPointStub();
    this.debug = { isVisible: () => false, toggle: () => {} };

    // Signal readiness once construction completes (deferred to a microtask so a
    // consumer subscribing synchronously after `new BevyRenderer()` still gets
    // it), matching the Babylon and Three renderers. `cameraChange` is not
    // emitted: with no wasm camera there is no user-driven camera motion yet.
    queueMicrotask(() => {
      if (!this.#disposed) this.events.emit('ready', undefined);
    });
  }

  #createCamera(): RendererCamera {
    return {
      getSpeed: () => this.#speed,
      reset: () => {
        this.#cameraPosition = DclVector3.create(8, 12, 24);
        this.#cameraTarget = DclVector3.create(8, 0, 8);
      },
      // No wasm camera to frame with yet; the pose stays put.
      focusOnEntity: () => {},
      setInvertRotation: () => {},
      zoom: () => {},
      getPose: () => ({
        position: DclVector3.create(
          this.#cameraPosition.x,
          this.#cameraPosition.y,
          this.#cameraPosition.z,
        ),
        target: DclVector3.create(this.#cameraTarget.x, this.#cameraTarget.y, this.#cameraTarget.z),
        // A sensible fixed fov until the wasm camera reports one.
        fov: Math.PI / 3,
      }),
      setPose: (position, target) => {
        this.#cameraPosition = DclVector3.create(position.x, position.y, position.z);
        this.#cameraTarget = DclVector3.create(target.x, target.y, target.z);
      },
      setControlEnabled: () => {},
    };
  }

  #createViewport(): RendererViewport {
    return {
      onFrame: (cb): Unsubscribe => this.context.onFrame(cb),
      getGroundPlanes: (): GroundPlane[] => [],
      getEntityWorldPositions: (entities: Entity[]): Map<Entity, Vector3> =>
        this.context.getEntityWorldPositions(entities),
    };
  }

  #createMetrics(): RendererMetrics {
    // No renderer to introspect yet — report zeros. The contract explicitly
    // allows this; the inspector degrades gracefully rather than assuming a
    // scene graph exists.
    return {
      getSceneMetrics: () => ({ triangles: 0, bodies: 0, materials: 0, textures: 0 }),
      getEntitiesOutsideLayout: () => [],
      onChange: () => () => {},
    };
  }

  // Editor manipulation not yet implemented for Bevy — honest stubs. These map
  // to bevy-editor's scene-side gizmo/TextureCamera composite in the next slice.
  #createGizmoStub(): RendererGizmos {
    return {
      isEnabled: () => false,
      setEnabled: () => {},
      setMode: (_mode: GizmoType) => {},
      isWorldAligned: () => true,
      setWorldAligned: () => {},
      isWorldAlignmentDisabled: () => true,
      onChange: () => () => {},
    };
  }

  #createSpawnPointStub(): SpawnPointController {
    return {
      getSelectedIndex: () => null,
      getSelectedTarget: () => null,
      isHidden: () => false,
      select: () => {},
      selectCameraTarget: () => {},
      setVisible: () => {},
      onSelectionChange: () => () => {},
      onVisibilityChange: () => () => {},
      attachGizmo: () => {},
      detachGizmo: () => {},
      setPosition: () => {},
    };
  }

  setSelection(_entities: Entity[]): void {
    // Selection visuals map to bevy-editor's `/highlight` in the next slice;
    // no-op proof stub for now.
  }

  async getPointerWorldPoint(): Promise<Vector3 | null> {
    // Needs the wasm raycast (bevy-editor's collider-layer pick); not available
    // in the spike.
    return null;
  }

  async getEntityAnimations(_entity: Entity): Promise<RendererAnimation[]> {
    // Needs the loaded GLTF in the wasm engine; none in the spike.
    return [];
  }

  setGridVisible(visible: boolean): void {
    this.#gridVisible = visible;
  }

  /** Spike-only: whether the editor grid would be shown (no renderer to toggle yet). */
  isGridVisible(): boolean {
    return this.#gridVisible;
  }

  dispose(): void {
    this.#disposed = true;
    this.context.dispose();
    this.events.all.clear();
  }
}
