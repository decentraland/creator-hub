import type { Emitter } from 'mitt';
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
 *     renderer objects. No `BABYLON.Mesh`, no `THREE.Object3D` crosses this
 *     line. A method that today takes a Babylon node (e.g. `centerViewOnEntity`)
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

/** A frame-rate-safe unsubscribe handle returned by every `on*` subscription. */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// Reverse channel: events the renderer emits back to the inspector.
// These are the viewport interactions that must become ECS mutations. The
// inspector — not the renderer — decides what each one does to the scene.
// ---------------------------------------------------------------------------

export type PickModifiers = {
  /** Multi-select intent (Shift or Ctrl held at pick time). */
  multi: boolean;
};

export type RendererEvents = {
  /** Emitted once the renderer has mounted and is ready to receive state. */
  ready: void;

  /**
   * The user clicked an entity in the viewport. `entity` is null when empty
   * space (sky/grid) was clicked — the inspector interprets that as deselect.
   */
  pick: { entity: Entity | null; modifiers: PickModifiers };

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
  /** Geometry/material counts for the scene metrics panel. */
  getSceneMetrics(): {
    triangles: number;
    entities: number;
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
}

// ---------------------------------------------------------------------------
// Optional renderer-native dev tooling (e.g. the Babylon Inspector overlay).
// ---------------------------------------------------------------------------

export interface RendererDebug {
  isVisible(): boolean;
  toggle(): void;
}

// ---------------------------------------------------------------------------
// The core interface every renderer implements.
// ---------------------------------------------------------------------------

export interface IRenderer {
  /** Reverse-channel events (pick, gizmoCommit, cameraChange, …). */
  readonly events: Emitter<RendererEvents>;

  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly spawnPoints: SpawnPointController;
  /** Present only if the renderer ships native dev tooling. */
  readonly debug?: RendererDebug;

  /** Set the editor selection by entity ID (the renderer draws it however it likes). */
  setSelection(entities: Entity[]): void;

  /**
   * Map a viewport coordinate to an entity, if any. Used for drop placement and
   * any picking the inspector initiates (as opposed to user clicks, which arrive
   * as `events.pick`). Returns the ground-plane point too, for snap-to-grid drops.
   */
  pickAt(x: number, y: number): { entity: Entity | null; point: Vector3 | null };

  /**
   * Resolve the world-space point under the pointer on the next pointer tick.
   * This is the drop-placement primitive: the inspector asks "where is the
   * pointer aiming in the scene right now?" without knowing screen coordinates.
   * Returns null if nothing was hit.
   */
  getPointerWorldPoint(): Promise<Vector3 | null>;

  /** Toggle the editor ground grid. */
  setGridVisible(visible: boolean): void;

  /** Tear down all renderer resources. */
  dispose(): void;
}
