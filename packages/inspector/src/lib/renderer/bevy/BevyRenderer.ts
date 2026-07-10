import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';
import type { Vector3 } from '@dcl/ecs-math';

import type {
  EditorCameraMode,
  GroundPlane,
  IRenderer,
  RendererAnimation,
  RendererCamera,
  RendererDebug,
  RendererEditorCamera,
  RendererEvents,
  RendererGizmos,
  RendererMetrics,
  RendererViewport,
  SpawnPointController,
  Unsubscribe,
} from '../types';
import type { GizmoType } from '../../utils/gizmo';
import { BevySceneContext } from './BevySceneContext';
import type { EngineWindow } from './console';

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
  readonly editorCamera: RendererEditorCamera;

  // In-memory camera pose. No wasm camera yet; this exists so the pose getters
  // are coherent (setPose → getPose) as the contract requires.
  #cameraPosition: Vector3 = DclVector3.create(8, 12, 24);
  #cameraTarget: Vector3 = DclVector3.create(8, 0, 8);
  #speed = 4;
  #gridVisible = true;
  #disposed = false;
  // The engine's window, once its iframe has booted (attachEngine). Null until
  // then (and in the conformance path, which runs the renderer with no engine).
  #engineWindow: EngineWindow | null = null;
  // Resolves the ground point under the pointer for drag-drop placement. The
  // engine's raycast lives in the editor-agent scene, reached over the bus, so
  // `register` wires this to the drop-point bridge. Null until wired (and in the
  // conformance path) → getPointerWorldPoint falls back to null like the stub.
  #resolveDropPoint: (() => Promise<Vector3 | null>) | null = null;
  // Editor camera (avatar ⇄ free fly). The mode change is enacted by the agent
  // over the bus; `register` injects the poster. Mode state + subscribers live
  // here so the toolbar toggle reflects the current mode.
  #editorCameraMode: EditorCameraMode = 'avatar';
  #postCameraMode: ((mode: EditorCameraMode) => void) | null = null;
  #cameraModeHandlers = new Set<(mode: EditorCameraMode) => void>();

  constructor() {
    this.context = new BevySceneContext();

    this.camera = this.#createCamera();
    this.editorCamera = this.#createEditorCamera();
    this.gizmos = this.#createGizmoStub();
    this.metrics = this.#createMetrics();
    this.viewport = this.#createViewport();
    this.spawnPoints = this.#createSpawnPointStub();
    this.debug = { isVisible: () => false, toggle: () => {} };
  }

  /**
   * Called by `register` once the engine iframe has booted and its console API
   * is live. This is when the renderer is truly ready — it's what flips the
   * inspector's boot gate. Until the wasm is fed the CRDT (a later slice) the
   * engine renders nothing, but the boundary is established. Emitting `ready`
   * here (not from the constructor) ties readiness to the real engine.
   */
  attachEngine(engineWindow: EngineWindow): void {
    if (this.#disposed) return;
    this.#engineWindow = engineWindow;
    this.events.emit('ready', undefined);
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

  /**
   * Wire the drag-drop ground raycast (the editor-agent answers it over the bus).
   * `register` calls this after mounting the engine; without it (conformance
   * path) getPointerWorldPoint stays a null stub.
   */
  setDropPointResolver(resolve: () => Promise<Vector3 | null>): void {
    this.#resolveDropPoint = resolve;
  }

  /**
   * Wire the editor-camera mode change to the agent (over the bus). `register`
   * calls this after mounting the engine; without it (conformance path) the mode
   * toggle just tracks state locally with no effect.
   */
  setCameraModePoster(post: (mode: EditorCameraMode) => void): void {
    this.#postCameraMode = post;
  }

  #createEditorCamera(): RendererEditorCamera {
    return {
      getMode: () => this.#editorCameraMode,
      setMode: (mode: EditorCameraMode) => {
        if (mode === this.#editorCameraMode) return;
        this.#editorCameraMode = mode;
        this.#postCameraMode?.(mode);
        for (const cb of this.#cameraModeHandlers) cb(mode);
      },
      onModeChange: (cb: (mode: EditorCameraMode) => void): Unsubscribe => {
        this.#cameraModeHandlers.add(cb);
        return () => this.#cameraModeHandlers.delete(cb);
      },
    };
  }

  async getPointerWorldPoint(): Promise<Vector3 | null> {
    // The ground raycast lives in the editor-agent scene (the wasm can't be
    // reached in-process); delegate to the bus-backed resolver when wired.
    return this.#resolveDropPoint ? this.#resolveDropPoint() : null;
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

  /** The booted engine window, or null before `attachEngine` (the next slice
   * drives CRDT/gizmo/pick console commands through this). */
  get engineWindow(): EngineWindow | null {
    return this.#engineWindow;
  }

  dispose(): void {
    this.#disposed = true;
    this.#engineWindow = null;
    this.context.dispose();
    this.events.all.clear();
  }
}
