import type { Entity } from '@dcl/ecs';
import type { Vector3, Quaternion } from '@dcl/ecs-math';

import type { GizmoType } from '../utils/gizmo';

/**
 * Renderer-agnostic boundary for the inspector.
 *
 * The inspector owns the authoritative scene state as an `@dcl/ecs` engine. A
 * renderer is a *projection* of that state into pixels, plus the input device
 * that turns viewport interactions back into ECS mutations. Everything the
 * inspector's React tree and hooks need from "the thing that draws the scene"
 * is expressed here — and nowhere else.
 *
 * Design rules (these are what make the boundary actually swappable):
 *
 *  1. The contract speaks **entity IDs and plain scalars/vectors**, never
 *     renderer objects. No live engine node (a `BABYLON.Mesh`, a WASM handle,
 *     …) crosses this line. A method that would otherwise take an engine node
 *     is re-expressed to take an `Entity` and resolve the node internally.
 *
 *  2. Vectors use `@dcl/ecs-math` (`Vector3`/`Quaternion`) — the same plain
 *     data types the ECS already uses — so they serialize trivially when a
 *     renderer runs out-of-process (iframe/Worker/WASM) behind a postMessage
 *     transport.
 *
 *  3. The interface is **layered by portability**, not flattened:
 *       - `IRenderer` (core): selection, gizmo mode, camera, picking, focus —
 *         every renderer must implement these.
 *       - `RendererMetrics` (delegated): triangle/material/texture counts and
 *         layout-bounds checks are inherently renderer-specific introspection.
 *         A renderer that cannot compute them returns zeros; the inspector
 *         degrades gracefully rather than reaching into a scene graph.
 *       - `SpawnPointController`: editor state that happens to be rendered as
 *         3D handles today; exposed as its own sub-API.
 *       - `RendererDebug` (optional): the Babylon Inspector overlay and similar
 *         renderer-native dev tools. Optional by construction.
 */

/** Unsubscribe handle returned by every `on*` subscription. */
export type Unsubscribe = () => void;

/**
 * Read-only view of the reverse-channel event bus that the inspector exposes to
 * consumers: they may subscribe (`on`/`off`) but not `emit` or `clear`. Only the
 * renderer implementation (which holds the full `Emitter`) emits events — that
 * exclusivity is the integrity guarantee of the reverse channel.
 *
 * Unlike the other subscription APIs here (`onFrame`/`onChange`/…), `on` returns
 * `void` rather than an `Unsubscribe` — this mirrors the `mitt` `Emitter` it
 * directly proxies, so a renderer can expose its raw emitter as `events` with no
 * wrapper. Unsubscribe via `off` with the same handler reference.
 */
export interface EventSubscriber<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(type: K, handler: (event: Events[K]) => void): void;
  off<K extends keyof Events>(type: K, handler: (event: Events[K]) => void): void;
}

// ---------------------------------------------------------------------------
// Reverse channel: events the renderer emits back to the inspector.
// These are the viewport interactions that must become ECS mutations. The
// inspector — not the renderer — decides what each one does to the scene.
// ---------------------------------------------------------------------------

export type PickModifiers = {
  /** Multi-select intent (Shift or Ctrl held at pick time). */
  multi: boolean;
};

/**
 * What the user clicked in the viewport. The renderer does the picking and
 * classification (it owns the scene graph); the inspector owns the response.
 *  - `entity`: an ECS entity's mesh was clicked.
 *  - `spawnPoint`: a player spawn-point/camera-target handle was clicked. The
 *    renderer has already updated its own spawn-point selection state; the
 *    inspector only needs to mirror the ECS selection (Player vs Root).
 *  - `empty`: sky/ground — deselect.
 */
export type PickTarget =
  | { kind: 'entity'; entity: Entity }
  | { kind: 'spawnPoint'; selected: boolean }
  | { kind: 'empty' };

export type RendererEvents = {
  /** Emitted once the renderer has mounted and is ready to receive state. */
  ready: void;

  /**
   * The user clicked in the viewport (a committed click, post drag-detection).
   * The renderer reports *what* was hit and the modifier intent; the inspector
   * decides what it means for ECS selection (select/multi-select, expand
   * ancestors, deselect). This is the single path — the renderer never mutates
   * ECS selection itself.
   */
  pick: { target: PickTarget; modifiers: PickModifiers };

  /**
   * A gizmo drag committed (drag-end). Carries the *final* transform per
   * affected entity. The inspector writes these to the ECS Transform; the
   * authoritative value then flows back to the renderer over the CRDT stream.
   * Per-frame drag deltas intentionally do NOT cross this boundary — the
   * renderer previews the drag locally and only the committed result is sent,
   * so dragging never round-trips and stays smooth out-of-process.
   */
  gizmoCommit: {
    transforms: Array<{
      entity: Entity;
      position?: Vector3;
      rotation?: Quaternion;
      scale?: Vector3;
    }>;
  };

  /**
   * Drag-end flush. Emitted once after the `gizmoCommit`(s) of a single drag,
   * telling the inspector to commit the batch (engine update + undo/redo
   * snapshot). Keeps a multi-entity drag a single undo step, matching the
   * write-then-flush split the gizmo always had.
   */
  gizmoCommitEnd: void;

  /**
   * A LIVE (mid-drag) gizmo update — the same DELTA shape as `gizmoCommit`, but
   * emitted every frame the drag changes rather than once on release. The
   * inspector merges it and re-emits {@link RendererEvents.previewTransforms} for
   * the renderer to preview, WITHOUT touching the CRDT / undo history. A renderer
   * that previews a drag by moving its own meshes (Babylon) never emits this.
   */
  gizmoDrag: {
    transforms: Array<{
      entity: Entity;
      position?: Vector3;
      rotation?: Quaternion;
      scale?: Vector3;
    }>;
  };

  /**
   * LIVE (mid-drag) transforms, already merged into the entity's real Transform
   * (same absolute values a commit would write), derived by the inspector from a
   * {@link RendererEvents.gizmoDrag}. A renderer that edits an out-of-process
   * engine subscribes to preview the move WITHOUT a CRDT write / undo entry per
   * frame — the authoritative write is the drag-end `gizmoCommit`. Renderers that
   * move their own meshes during a drag (Babylon) ignore this.
   */
  previewTransforms: {
    transforms: Array<{
      entity: Entity;
      position: Vector3;
      rotation: Quaternion;
      scale: Vector3;
      // The entity's parent (from its current Transform), so a renderer that
      // REPLACES the whole component when previewing (Bevy's `set_component`)
      // doesn't reset it. Undefined for a root-parented entity.
      parent?: Entity;
    }>;
  };

  /** The camera moved (user-driven). Lets the inspector mirror framing/minimap state. */
  cameraChange: void;

  /** Camera movement speed changed (mouse-wheel while moving). */
  cameraSpeedChange: { speed: number };
};

// ---------------------------------------------------------------------------
// Camera: the inspector controls intent (focus, reset, preferences); the
// renderer owns the actual transform + per-frame control. No camera object
// ever leaves the renderer — only the scalars the UI genuinely needs.
// ---------------------------------------------------------------------------

export interface RendererCamera {
  /** Current movement speed (m/s) for the speed HUD. */
  getSpeed(): number;
  /** Reset to the default editor framing. */
  reset(): void;
  /**
   * Animate the camera to frame an entity. Takes an entity ID — the renderer
   * resolves it to a node and does the frustum-fit math internally (this was
   * `centerViewOnEntity(babylonNode)` before the boundary existed).
   */
  focusOnEntity(entity: Entity): void;
  /** Invert free-camera rotation (a user preference). */
  setInvertRotation(invert: boolean): void;
  /** Zoom by a signed step (positive = in). Replaces direct `getDirection` math in callers. */
  zoom(step: number): void;
  /** Read the pose the minimap/axis-helper need, as plain vectors. */
  getPose(): { position: Vector3; target: Vector3; fov: number };
  /** Position + aim the camera (used by the scene RPC server). */
  setPose(position: Vector3, target: Vector3): void;
  /** Detach/reattach viewport control — used while an overlay interaction owns the pointer. */
  setControlEnabled(enabled: boolean): void;
}

// ---------------------------------------------------------------------------
// Viewport: read-only spatial data the inspector needs to draw 2D overlays
// (the scene minimap today). The inspector owns the drawing; the renderer only
// supplies world-space data.
//
// Deliberately *batched*: per-frame reads take an array of entity IDs and
// return all positions in one call, rather than a per-entity getter. In-process
// this reads like a granular getter; out-of-process it stays one message per
// frame instead of N. Ground planes change rarely, so they have their own
// getter meant to be called on scene-change, not every frame.
// ---------------------------------------------------------------------------

export interface GroundPlane {
  /** World-space center of the parcel plane. */
  x: number;
  z: number;
}

export interface RendererViewport {
  /**
   * Subscribe to a render tick. The callback fires once per rendered frame so
   * the inspector can refresh frame-coupled overlays. The inspector throttles
   * its own redraw cadence; the renderer just signals "a frame happened".
   */
  onFrame(cb: () => void): Unsubscribe;

  /** World-space centers of the ground/parcel planes. Call on scene-change. */
  getGroundPlanes(): GroundPlane[];

  /**
   * Batched world positions for the given entities. Entities with no node, or
   * currently disabled, are omitted from the result map — callers should treat
   * a missing id as "not drawable this frame".
   */
  getEntityWorldPositions(entities: Entity[]): Map<Entity, Vector3>;
}

// ---------------------------------------------------------------------------
// Gizmos: the inspector owns *semantics* (which mode, world/local, enabled);
// the renderer owns rendering + drag interaction and reports commits as events.
// ---------------------------------------------------------------------------

export interface RendererGizmos {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  setMode(mode: GizmoType): void;
  isWorldAligned(): boolean;
  setWorldAligned(aligned: boolean): void;
  isWorldAlignmentDisabled(): boolean;
  /** Fired when the renderer-side gizmo state changes (mode/alignment). */
  onChange(cb: () => void): Unsubscribe;
}

// ---------------------------------------------------------------------------
// Metrics: delegated, renderer-specific introspection. A renderer that cannot
// answer returns zeros — the inspector must never assume a scene graph exists.
// ---------------------------------------------------------------------------

export interface RendererMetrics {
  /**
   * Geometry/material counts for the scene metrics panel. `bodies` is the
   * count of drawable objects (meshes); entity *count* stays inspector-side
   * since it derives from the ECS Nodes tree, not the renderer.
   */
  getSceneMetrics(): {
    triangles: number;
    bodies: number;
    materials: number;
    textures: number;
  };
  /** Entity IDs whose geometry currently falls outside the scene layout bounds. */
  getEntitiesOutsideLayout(): Entity[];
  /** Fired when anything affecting the above changed (mesh/material load/remove). */
  onChange(cb: () => void): Unsubscribe;
}

// ---------------------------------------------------------------------------
// Spawn points: editor state rendered as 3D handles today. Pure ID/index API.
// ---------------------------------------------------------------------------

export type SpawnPointTarget = 'position' | 'cameraTarget';

export interface SpawnPointController {
  getSelectedIndex(): number | null;
  getSelectedTarget(): SpawnPointTarget | null;
  isHidden(name: string): boolean;
  select(index: number | null): void;
  selectCameraTarget(index: number): void;
  setVisible(index: number, name: string, visible: boolean): void;
  onSelectionChange(
    cb: (e: { index: number | null; target: SpawnPointTarget | null }) => void,
  ): Unsubscribe;
  onVisibilityChange(cb: (e: { name: string; visible: boolean }) => void): Unsubscribe;

  /**
   * Attach a move-handle to a spawn point (or its camera target), reporting the
   * dragged position back. The renderer draws/manipulates the handle however it
   * likes; the inspector only supplies index + target and consumes positions. A
   * renderer without spawn-point handles may no-op (the panel still edits values
   * via the form).
   */
  attachGizmo(
    index: number,
    target: SpawnPointTarget,
    onPositionChange: (index: number, position: Vector3) => void,
  ): void;
  /** Detach the spawn-point move-handle. */
  detachGizmo(): void;
  /** Force a spawn point's (or camera target's) position — used for out-of-bounds correction. */
  setPosition(index: number, target: SpawnPointTarget, position: Vector3): void;
}

// ---------------------------------------------------------------------------
// Optional renderer-native dev tooling (e.g. the Babylon Inspector overlay).
// ---------------------------------------------------------------------------

export interface RendererDebug {
  isVisible(): boolean;
  toggle(): void;
}

/** The editor camera mode: the engine's native player camera, or an editor fly-camera. */
export type EditorCameraMode = 'avatar' | 'free';

/**
 * Optional capability for renderers whose default camera is NOT already a free
 * editor camera. Babylon's editor camera is always free-fly, so it omits this.
 * The Bevy renderer's native camera is the player avatar, so it implements this
 * to let the user toggle a dedicated editor fly-camera on/off.
 */
export interface RendererEditorCamera {
  getMode(): EditorCameraMode;
  setMode(mode: EditorCameraMode): void;
  /** Notify on mode change (e.g. so a toolbar toggle reflects the current state). */
  onModeChange(cb: (mode: EditorCameraMode) => void): Unsubscribe;
}

/**
 * Optional capability for renderers that RUN the scene's SDK7 code live (its
 * systems / timers / onUpdate tick). Such a renderer can freeze the scene to a
 * static subject for editing. Babylon doesn't execute scene code (it renders the
 * authored components only), so it omits this; the Bevy renderer runs the real
 * scene in the engine, so it exposes a run/freeze toggle (default: frozen).
 */
export interface RendererSceneRun {
  /** True when the scene is running live; false when frozen (static). */
  isRunning(): boolean;
  /** Run the scene live (true) or freeze it to a static subject (false). */
  setRunning(running: boolean): void;
  /** Notify on run/freeze change (so a toolbar toggle reflects the state). */
  onRunChange(cb: (running: boolean) => void): Unsubscribe;
  /**
   * Stop: reset the scene to its initial state and freeze it. Play/Pause only
   * run/halt the scene where it is — there's no way back to the start (e.g. a
   * character that walked toward the player). Reset reboots the scene from the
   * realm (its authored initial state) and leaves it frozen. Resolves once the
   * reset completes.
   */
  reset(): Promise<void>;
}

/**
 * An animation clip exposed by a renderer (see `getEntityAnimations`). Only
 * `name` is consumed today; the object shape leaves room to add `duration`,
 * `loopable`, etc. without breaking the public contract.
 */
export interface RendererAnimation {
  name: string;
  /**
   * GLTF-authored / load-time playback defaults, when the renderer can read
   * them. Omitted fields fall back to the inspector's defaults (weight 1, not
   * playing, speed 1, no loop). Carried here so a GLTF that bakes in e.g.
   * `loop: true` isn't silently flattened to the default.
   */
  weight?: number;
  speed?: number;
  loop?: boolean;
  playing?: boolean;
}

// ---------------------------------------------------------------------------
// The core interface every renderer implements.
// ---------------------------------------------------------------------------

export interface IRenderer {
  /**
   * Reverse-channel events (pick, gizmoCommit, cameraChange, …). Consumers
   * subscribe via `on`/`off` only — the renderer is the sole emitter (it holds
   * the underlying `Emitter`); see {@link EventSubscriber}.
   */
  readonly events: EventSubscriber<RendererEvents>;

  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly viewport: RendererViewport;
  readonly spawnPoints: SpawnPointController;
  /** Present only if the renderer ships native dev tooling. */
  readonly debug?: RendererDebug;
  /**
   * Present only if the renderer's default camera isn't already a free editor
   * camera (Babylon's is, so it omits this; Bevy's native camera is the player
   * avatar, so it exposes a toggle to an editor fly-camera).
   */
  readonly editorCamera?: RendererEditorCamera;
  /**
   * Present only if the renderer executes the scene's SDK7 code live (Bevy runs
   * the real scene, so it exposes a run/freeze toggle — default frozen; Babylon
   * only renders authored components, so it omits this).
   */
  readonly sceneRun?: RendererSceneRun;

  /** Set the editor selection by entity ID (the renderer draws it however it likes). */
  setSelection(entities: Entity[]): void;

  /**
   * Resolve the world-space point under the pointer on the next pointer tick.
   * This is the drop-placement primitive: the inspector asks "where is the
   * pointer aiming in the scene right now?" Returns null if nothing was hit.
   *
   * `ndc` optionally supplies the target in normalized device coords (x,y ∈
   * [-1,1], y up) — used when the renderer's own pointer can't be trusted, e.g. an
   * out-of-process (iframe) renderer during an HTML5 drag, where the host captures
   * the cursor and the engine's pointer is stale. Renderers that read their live
   * pointer directly (Babylon) may ignore it.
   */
  getPointerWorldPoint(ndc?: { x: number; y: number }): Promise<Vector3 | null>;

  /**
   * Resolve the animation clips available on an entity's loaded GLTF. Used by
   * the Animator/Action inspectors to populate animation pickers. Waits for the
   * GLTF to load; returns [] if the entity has no GLTF/animations or the
   * renderer can't introspect them. Returns {@link RendererAnimation} objects
   * (not bare strings) so the shape can grow — e.g. with `duration` — without a
   * breaking change.
   */
  getEntityAnimations(entity: Entity): Promise<RendererAnimation[]>;

  /** Toggle the editor ground grid. */
  setGridVisible(visible: boolean): void;

  /** Tear down all renderer resources. */
  dispose(): void;
}
