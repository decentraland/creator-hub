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
  RendererSceneRun,
  RendererViewport,
  SpawnPointController,
  SpawnPointTarget,
  Unsubscribe,
} from '../types';
import type { GizmoType } from '../../utils/gizmo';
import type { SceneSpawnPointCoord } from '../../sdk/components';
import { VERSIONS_REGISTRY } from '../../sdk/components/versioning/registry';
import { BevySceneContext } from './BevySceneContext';
import type { EngineWindow } from './console';
import { createSpawnPointController } from './spawn-point-controller';
import type { BevySpawnPointController } from './spawn-point-controller';

/** A spawn-point coordinate resolves to a single value, or a range's midpoint. */
function spawnCoordValue(coord: SceneSpawnPointCoord): number {
  if (coord.$case === 'range') {
    const [a, b] = coord.value;
    return b === undefined ? a : (a + b) / 2;
  }
  return coord.value;
}

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
  readonly sceneRun: RendererSceneRun;

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
  #resolveDropPoint: ((ndc?: { x: number; y: number }) => Promise<Vector3 | null>) | null = null;
  // Resolves an entity's GLTF animation clip names via the editor-agent (over the
  // bus). Null until `register` wires it (and in the conformance path) →
  // getEntityAnimations returns none.
  #resolveAnimations: ((entity: Entity) => Promise<string[]>) | null = null;
  // Editor camera (avatar ⇄ free fly). The mode change is enacted by the agent
  // over the bus; `register` injects the poster. Mode state + subscribers live
  // here so the toolbar toggle reflects the current mode.
  // The editor defaults to the AVATAR camera (the agent boots in avatar mode so
  // the player is walkable — forcing free on boot disabled avatar input before the
  // player activated and broke WASD walking). The toolbar toggle reflects this
  // without waiting on a round-trip from the agent; the user switches to the fly
  // camera when they want it.
  // Free is the editor default camera (QA). The AGENT still boots in avatar and is
  // switched to free once it's ready (on `editor-ready`, after its boot sequence),
  // avoiding the free-on-boot race that disabled avatar input / broke WASD. This
  // just reflects the intended default in the toolbar from the start.
  #editorCameraMode: EditorCameraMode = 'free';
  #postCameraMode: ((mode: EditorCameraMode) => void) | null = null;
  #cameraModeHandlers = new Set<(mode: EditorCameraMode) => void>();
  // Scene run/freeze. The editor default is FROZEN (static — the agent freezes
  // the scene on boot), so this starts false. The toolbar toggle flips it; the
  // poster (injected by `register`) forwards the intent to the agent.
  #sceneRunning = false;
  #postSceneRunning: ((running: boolean) => void) | null = null;
  #sceneRunHandlers = new Set<(running: boolean) => void>();
  // Resets the scene to its initial state (reboot the engine + re-freeze).
  // Injected by `register`; null in the conformance path (reset is then a no-op).
  #sceneResetter: (() => Promise<void>) | null = null;
  // Posts a focus-on-entity to the agent (framing a world position). Injected by
  // `register`; null in the conformance path (focusOnEntity is then a no-op).
  #postFocus: ((position: Vector3) => void) | null = null;
  // Posts a camera reset to the agent (default scene framing). Injected by
  // `register`; null in the conformance path (reset falls back to the in-memory pose).
  #postReset: ((position: Vector3) => void) | null = null;
  // Gizmo world-alignment (the toolbar's "align to world" checkbox). The gizmo
  // itself is drawn/dragged by the editor-agent scene; this renderer owns the
  // SETTING so the toolbar can bind to it, and the selection bridge forwards it
  // to the agent over the bus.
  #gizmosWorldAligned = true;
  #gizmoChangeHandlers = new Set<() => void>();
  // Metrics-change subscribers. The minimap listens here to refresh its ground
  // planes, which are derived from the Scene layout — so we notify these whenever
  // the Scene component changes (see the onChange wiring in the constructor).
  #metricsChangeHandlers = new Set<() => void>();
  // Spawn-point controller + its handle poster (injected by `register` → bus).
  #spawnPointController: BevySpawnPointController;
  #spawnGizmoPoster: ((position: { x: number; y: number; z: number } | null) => void) | null = null;
  // Unsubscribe for the Scene-metadata watcher that re-syncs the spawn handle.
  #offSceneChange: (() => void) | null = null;

  constructor() {
    this.context = new BevySceneContext();

    this.camera = this.#createCamera();
    this.editorCamera = this.#createEditorCamera();
    this.sceneRun = this.#createSceneRun();
    this.gizmos = this.#createGizmos();
    this.metrics = this.#createMetrics();
    this.viewport = this.#createViewport();
    // The spawn-point controller shows its move-handle through a poster we
    // delegate to `#spawnGizmoPoster` — `register` injects the real one (the bus
    // bridge); until then it's a no-op (conformance path).
    this.#spawnPointController = createSpawnPointController(
      { show: position => this.#spawnGizmoPoster?.(position) },
      (index, target) => this.#resolveSpawnPosition(index, target),
    );
    this.spawnPoints = this.#spawnPointController;
    // Keep the spawn handle synced to the Scene metadata: a valid form edit (and
    // the gizmo-commit round-trip) writes the Scene component but never pushes a
    // position to the controller, so re-resolve + re-show the handle whenever the
    // Scene component changes. Mirrors Babylon's `updateFromSceneComponent`.
    // Match ANY SceneMetadata version id, not just this inspector's latest: the
    // data-layer may stream an older version (see scene-metadata-version.ts), so a
    // single cached componentId would miss its changes and the handle/minimap would
    // never refresh.
    const sceneComponentIds = new Set(
      (VERSIONS_REGISTRY['inspector::SceneMetadata'] ?? [])
        .map(v => this.context.engine.getComponentOrNull(v.versionName)?.componentId)
        .filter((id): id is number => id !== undefined),
    );
    this.#offSceneChange = this.context.onChange((_entity, _op, component) => {
      if (component === undefined || !sceneComponentIds.has(component.componentId)) return;
      this.#spawnPointController.refreshHandle();
      // The Scene layout drives the minimap's ground planes; the layout can land
      // AFTER the minimap has mounted (the scene loads async), so notify metrics
      // subscribers to re-read. Without this the minimap's ground planes stay at
      // their empty mount-time value → no parcel grid and collapsed bounds that
      // pile every entity dot onto one point.
      for (const h of [...this.#metricsChangeHandlers]) h();
    });
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
        // Keep the in-memory pose coherent (contract), and ask the agent to fly
        // the editor camera to a default framing of the scene (center of the base
        // parcel, scene-local — the agent adds the scene offset). Reset also
        // engages free-cam so the toolbar reflects it.
        this.#cameraPosition = DclVector3.create(8, 12, 24);
        this.#cameraTarget = DclVector3.create(8, 0, 8);
        if (!this.#postReset) return;
        this.editorCamera.setMode('free');
        this.#postReset(DclVector3.create(8, 0, 8));
      },
      focusOnEntity: (entity: Entity) => {
        // The engine camera lives in the agent; resolve the entity's world
        // position (we own the CRDT) and ask the agent to frame it. Also flip our
        // editor-camera mode to 'free' so the toolbar toggle reflects that focus
        // engaged the fly-camera (the agent switches to free to frame).
        const pos = this.context.getEntityWorldPositions([entity]).get(entity);
        if (!pos || !this.#postFocus) return;
        this.editorCamera.setMode('free');
        this.#postFocus(pos);
      },
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
      // Parcel planes come from the Scene layout metadata (the inspector owns it),
      // so the minimap draws the real parcel grid — no engine round-trip.
      getGroundPlanes: (): GroundPlane[] => this.context.getGroundPlanes(),
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
      // Fires when the Scene layout changes (wired in the constructor). The
      // minimap uses this to re-read ground planes once the scene has loaded.
      onChange: (cb: () => void) => {
        this.#metricsChangeHandlers.add(cb);
        return () => {
          this.#metricsChangeHandlers.delete(cb);
        };
      },
    };
  }

  // Gizmo drawing + dragging live in the editor-agent scene (over the bus); the
  // renderer owns the gizmo SETTINGS the toolbar binds to — world alignment. Mode
  // is driven through the Selection component (not setMode) and enable/disable
  // isn't wired, so those stay honest no-ops.
  #createGizmos(): RendererGizmos {
    return {
      isEnabled: () => false,
      setEnabled: () => {},
      setMode: (_mode: GizmoType) => {},
      isWorldAligned: () => this.#gizmosWorldAligned,
      setWorldAligned: (aligned: boolean) => {
        if (this.#gizmosWorldAligned === aligned) return;
        this.#gizmosWorldAligned = aligned;
        // Iterate a copy: a handler may unsubscribe mid-iteration.
        for (const h of [...this.#gizmoChangeHandlers]) h();
      },
      isWorldAlignmentDisabled: () => false,
      onChange: (cb: () => void) => {
        this.#gizmoChangeHandlers.add(cb);
        return () => {
          this.#gizmoChangeHandlers.delete(cb);
        };
      },
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
  setDropPointResolver(resolve: (ndc?: { x: number; y: number }) => Promise<Vector3 | null>): void {
    this.#resolveDropPoint = resolve;
  }

  /**
   * Wire the GLTF-animation-names lookup to the agent (over the bus). `register`
   * calls this after mounting the engine; without it getEntityAnimations returns
   * none (conformance path).
   */
  setAnimationsResolver(resolve: (entity: Entity) => Promise<string[]>): void {
    this.#resolveAnimations = resolve;
  }

  /**
   * Wire the editor-camera mode change to the agent (over the bus). `register`
   * calls this after mounting the engine; without it (conformance path) the mode
   * toggle just tracks state locally with no effect.
   */
  setCameraModePoster(post: (mode: EditorCameraMode) => void): void {
    this.#postCameraMode = post;
  }

  /** Wire the scene run/freeze poster (forwards run/freeze intent to the agent). */
  setSceneRunPoster(post: (running: boolean) => void): void {
    this.#postSceneRunning = post;
  }

  /** Wire the scene resetter (Stop = reboot the engine to the scene's initial
   * state + re-freeze). Injected by `register`. */
  setSceneResetter(reset: () => Promise<void>): void {
    this.#sceneResetter = reset;
  }

  /** Wire focus-on-entity to the agent (frames a world position over the bus). */
  setFocusPoster(post: (position: Vector3) => void): void {
    this.#postFocus = post;
  }

  /** Wire camera reset to the agent (default scene framing over the bus). */
  setResetPoster(post: (position: Vector3) => void): void {
    this.#postReset = post;
  }

  /** Wire the spawn-point handle poster (shows/hides the handle over the bus). */
  setSpawnGizmoPoster(post: (position: { x: number; y: number; z: number } | null) => void): void {
    this.#spawnGizmoPoster = post;
  }

  /** Route an agent-reported spawn-handle drag to the active spawn point. */
  handleSpawnGizmoCommit(position: { x: number; y: number; z: number }): void {
    this.#spawnPointController.handleGizmoCommit(position);
  }

  /**
   * Read a spawn point's (or camera target's) current scene-local position from
   * the Scene metadata component on the root entity — the same source Babylon's
   * spawn-point manager builds its meshes from. Ranges resolve to their midpoint.
   */
  #resolveSpawnPosition(
    index: number,
    target: SpawnPointTarget,
  ): { x: number; y: number; z: number } | null {
    const scene = this.context.editorComponents.Scene.getOrNull(this.context.engine.RootEntity);
    const sp = scene?.spawnPoints?.[index];
    if (!sp) return null;
    if (target === 'cameraTarget') {
      const ct = sp.cameraTarget;
      return ct ? { x: ct.x, y: ct.y, z: ct.z } : null;
    }
    return {
      x: spawnCoordValue(sp.position.x),
      y: spawnCoordValue(sp.position.y),
      z: spawnCoordValue(sp.position.z),
    };
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

  #createSceneRun(): RendererSceneRun {
    return {
      isRunning: () => this.#sceneRunning,
      setRunning: (running: boolean) => {
        if (running === this.#sceneRunning) return;
        this.#sceneRunning = running;
        this.#postSceneRunning?.(running);
        for (const cb of this.#sceneRunHandlers) cb(running);
      },
      onRunChange: (cb: (running: boolean) => void): Unsubscribe => {
        this.#sceneRunHandlers.add(cb);
        return () => this.#sceneRunHandlers.delete(cb);
      },
      reset: async (): Promise<void> => {
        // Reboot the engine to the scene's authored initial state, then land on
        // frozen (static) — the editor's default — regardless of the prior
        // run/freeze state. `#sceneResetter` reboots and re-freezes; reflect the
        // frozen state locally + notify listeners so the toolbar shows Play.
        if (!this.#sceneResetter) return;
        await this.#sceneResetter();
        if (this.#sceneRunning) {
          this.#sceneRunning = false;
          for (const cb of this.#sceneRunHandlers) cb(false);
        }
      },
    };
  }

  async getPointerWorldPoint(ndc?: { x: number; y: number }): Promise<Vector3 | null> {
    // The ground raycast lives in the editor-agent scene (the wasm can't be
    // reached in-process); delegate to the bus-backed resolver when wired. The
    // NDC target is forwarded so the agent raycasts from the real drop cursor
    // (the engine's own pointer is stale during an HTML5 drag).
    return this.#resolveDropPoint ? this.#resolveDropPoint(ndc) : null;
  }

  async getEntityAnimations(entity: Entity): Promise<RendererAnimation[]> {
    // The GLTF is loaded in the wasm engine; the editor-agent reads its clip names
    // (GltfContainerLoadingState.animationNames) and replies over the bus. We only
    // get names — per-clip GLTF-authored defaults aren't exposed — so weight/speed/
    // loop are omitted and the inspector applies its defaults. Null resolver
    // (conformance path) → no animations.
    if (!this.#resolveAnimations) return [];
    const names = await this.#resolveAnimations(entity);
    return names.map(name => ({ name }));
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
    this.#gizmoChangeHandlers.clear();
    this.#metricsChangeHandlers.clear();
    this.#offSceneChange?.();
    this.#offSceneChange = null;
    this.context.dispose();
    this.events.all.clear();
  }
}
