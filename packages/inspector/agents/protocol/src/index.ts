/**
 * The `dcl-editor-bus` message protocol — the SINGLE source of truth for the
 * same-origin BroadcastChannel between the inspector (host page) and the Bevy
 * editor-agent scene (`agents/bevy`, which runs in the engine's wasm sandbox).
 *
 * A standalone, dependency-free package (`@dcl/inspector-bevy-protocol`) both
 * sides depend on via `file:` — so neither reaches into the other's source. It
 * MUST stay pure types + constants with ZERO imports: the two sides build with
 * different toolchains/SDKs, and only a dependency-free module resolves + bundles
 * cleanly in both (the same reason bevy-editor keeps its bus protocol in a
 * pure-types `@dcl-editor/contract`). Vectors are plain `{x,y,z}`, entity ids are
 * numbers — no `@dcl/ecs` types cross the wire.
 */

/** The BroadcastChannel name both sides open. */
export const EDITOR_BUS_CHANNEL = 'dcl-editor-bus';

/** A plain position on the wire (no engine vector type). */
export interface BusVec3 {
  x: number;
  y: number;
  z: number;
}

/** A plain quaternion on the wire (no engine quaternion type). */
export interface BusQuat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Which gizmo the agent should show/drag. Mirrors the inspector's `GizmoType`
 * (POSITION/ROTATION/SCALE/FREE) as plain strings so no `@dcl/*` enum crosses the
 * wire. `free` = no gizmo (nothing selected for transform).
 */
export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'free';

/**
 * The editor camera. `avatar` = the engine's native player camera; `free` = an
 * editor fly-camera the agent drives (avatar input disabled while active).
 */
export type CameraMode = 'avatar' | 'free';

/**
 * agent → inspector (`to: 'page'`). Viewport interaction results:
 *  - `pick`: entity under the click (entity 0 = clean miss / deselect).
 *  - `gizmoCommit`: the committed transform(s) of a gizmo drag (position only
 *    today; the inspector merges into the entity's real Transform).
 *  - `gizmoCommitEnd`: flush — commit the batch as one undo step.
 */
export type AgentToPage =
  | { kind: 'pick'; entity: number; shift: boolean; ctrl: boolean }
  // A committed gizmo drag. Only the field(s) the active mode changes are sent;
  // the inspector merges them into the entity's existing Transform, preserving
  // the rest. The agent can't read the entity's base transform (separate engine),
  // so rotation/scale are DELTAS the inspector composes onto the current value:
  //  - position: ABSOLUTE world point (the agent is given the anchor up front).
  //  - rotation: a DELTA quaternion → newRotation = current ⊗ delta.
  //  - scale:    a per-axis MULTIPLIER → newScale = current * factor.
  | {
      kind: 'gizmoCommit';
      transforms: {
        entity: number;
        position?: BusVec3;
        rotation?: BusQuat;
        scale?: BusVec3;
      }[];
    }
  | { kind: 'gizmoCommitEnd' }
  // Reply to `query-drop-point`: the world point under the engine's current
  // pointer on the scene ground plane (null if the pointer ray misses / isn't
  // available). `id` correlates the reply with its request.
  | { kind: 'drop-point'; id: number; position: BusVec3 | null };

/**
 * inspector → agent (`to: 'scene'`).
 *  - `set-selection`: the agent can't read the inspected scene's Transform from
 *    its own engine, so the inspector supplies the selected entity's world
 *    position for the gizmo to anchor to (null = cleared).
 *  - `query-drop-point`: ask the agent to raycast the ground under the current
 *    pointer (for placing a drag-dropped asset); answered by `drop-point`. `id`
 *    correlates request/reply.
 */
export type PageToScene =
  | {
      kind: 'set-selection';
      entity: number | null;
      position: BusVec3 | null;
      // The entity's world rotation, so the scale gizmo can align its handles to
      // the entity's local axes (scale is only meaningful on local axes — the
      // scale gizmo is ALWAYS locally aligned, independent of the align-to-world
      // setting, matching the Babylon ScaleGizmo). Null when nothing is selected.
      rotation: BusQuat | null;
      // Which gizmo to show for the selection (translate/rotate/scale), or `free`
      // when none is active. Drives which handles the agent draws + how a drag
      // commits. The inspector owns the mode (its Gizmos toolbar writes it to the
      // Selection component); it's forwarded here so the agent needn't read it.
      mode: GizmoMode;
    }
  | { kind: 'query-drop-point'; id: number }
  // Toggle the editor camera. `avatar` = the engine's native player camera (walk
  // /look/zoom); `free` = an editor fly-camera the agent drives (WASD + mouse-
  // look), with avatar input disabled. The inspector's camera toggle sends this.
  | { kind: 'set-camera'; mode: CameraMode }
  // Frame an entity with the editor camera (the inspector's focusOnEntity / F).
  // The agent can't read the inspected scene's Transform, so the inspector sends
  // the target's WORLD position; the agent switches to the fly-camera and tweens
  // it to a standoff aimed at the target.
  | { kind: 'focus-camera'; position: BusVec3 }
  // Reset the editor camera to a default framing of the scene (toolbar / Space).
  // The inspector sends the scene-local point to frame (its center); the agent
  // tweens the fly-camera to a fixed default standoff looking at it.
  | { kind: 'reset-camera'; position: BusVec3 };

/** Every message is wrapped so a peer ignores its own posts / the wrong direction. */
export interface BusEnvelope {
  to: 'page' | 'scene';
  msg: AgentToPage | PageToScene;
}
