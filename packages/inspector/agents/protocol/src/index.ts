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

/**
 * agent → inspector (`to: 'page'`). Viewport interaction results:
 *  - `pick`: entity under the click (entity 0 = clean miss / deselect).
 *  - `gizmoCommit`: the committed transform(s) of a gizmo drag (position only
 *    today; the inspector merges into the entity's real Transform).
 *  - `gizmoCommitEnd`: flush — commit the batch as one undo step.
 */
export type AgentToPage =
  | { kind: 'pick'; entity: number; shift: boolean; ctrl: boolean }
  | { kind: 'gizmoCommit'; transforms: { entity: number; position?: BusVec3 }[] }
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
  | { kind: 'set-selection'; entity: number | null; position: BusVec3 | null }
  | { kind: 'query-drop-point'; id: number };

/** Every message is wrapped so a peer ignores its own posts / the wrong direction. */
export interface BusEnvelope {
  to: 'page' | 'scene';
  msg: AgentToPage | PageToScene;
}
