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
 * A spawn area to draw in the editor (#1374). `center` is the scene-local spawn
 * position (the range midpoint on each axis); `halfExtents` is the box's half-size
 * on X/Z derived from the coordinate ranges (0 when an axis is a single value —
 * i.e. a point, not an area). `isDefault` marks the scene's default spawn point
 * (drawn emphasized). Multiple spawn points → multiple areas.
 */
export interface SpawnArea {
  center: BusVec3;
  halfExtents: { x: number; z: number };
  isDefault: boolean;
  // The avatar's Y rotation (radians) so it faces the camera target, matching the
  // Babylon editor. Omitted/0 when there's no camera target.
  facingY?: number;
  // The spawn point's camera target (scene-local), drawn as its own marker nested
  // under the spawn in the tree. Omitted when the spawn has no camera target.
  cameraTarget?: BusVec3;
  // The spawn point's index in the scene metadata — so a viewport click on this
  // area's avatar/target markers can select the right spawn point / target.
  index: number;
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
  // A committed gizmo drag. Only the field(s) the active mode changes are sent;
  // the inspector merges them into the entity's existing Transform, preserving
  // the rest. The agent can't read the entity's base transform (separate engine),
  // so rotation/scale are DELTAS the inspector composes onto the current value:
  //  - position: ABSOLUTE world point (the agent is given the anchor up front).
  //  - rotation: a WORLD-frame DELTA quaternion about the dragged ring's world
  //    normal → newRotation = delta ⊗ current. (A locally-aligned ring's normal
  //    is the entity's rotated axis, which makes the same composition apply the
  //    delta about the entity's local axis.)
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
  // A LIVE (mid-drag) gizmo update — same delta shape as `gizmoCommit`, emitted
  // every frame the drag changes. The inspector merges it into the entity's real
  // Transform and previews it in the engine WITHOUT touching the CRDT / undo
  // history (that happens once on `gizmoCommit` + `gizmoCommitEnd` at release), so
  // the entity tracks the gizmo continuously but a whole drag stays one undo step.
  | {
      kind: 'gizmoPreview';
      transforms: {
        entity: number;
        position?: BusVec3;
        rotation?: BusQuat;
        scale?: BusVec3;
      }[];
    }
  // Reply to `query-drop-point`: the world point under the engine's current
  // pointer on the scene ground plane (null if the pointer ray misses / isn't
  // available). `id` correlates the reply with its request.
  | { kind: 'drop-point'; id: number; position: BusVec3 | null }
  // A committed spawn-point handle drag (world position). The inspector routes it
  // to the active spawn point's onPositionChange (scene metadata, not a Transform).
  | { kind: 'spawn-gizmo-commit'; position: BusVec3 }
  // A viewport click on a spawn point's avatar or camera-target marker (#2). The
  // inspector selects that spawn point / target (spawn points are scene metadata,
  // not entities, so this is separate from the entity `pick`).
  | { kind: 'spawn-pick'; index: number; target: 'position' | 'cameraTarget' }
  // Reply to `query-animations`: the animation clip names of the entity's loaded
  // GLTF (empty if none / not loaded). The agent reads them from the engine's
  // `GltfContainerLoadingState.animationNames` — a field the inspector's older
  // `@dcl/ecs` can't decode, so it must come from the engine over the bus. `id`
  // correlates the reply with its request.
  | { kind: 'animations'; id: number; names: string[] }
  // The editor (free-fly) camera's live pose, streamed while free-cam is active so
  // the inspector's minimap can track it (the camera lives in the engine). Both
  // vectors are SCENE-LOCAL (the agent subtracts the scene offset) since the
  // inspector works in the scene's origin frame. `target` is a point the camera
  // looks at (position + forward). Throttled by the agent.
  | { kind: 'camera-pose'; position: BusVec3; target: BusVec3 }
  // The agent has booted and is listening. One-shot editor state that the host
  // pushes (rather than the user triggering) — notably the spawn areas (#1374) —
  // is lost if posted before the agent's message listener is up. The agent emits
  // this once its bus is wired so the host can (re)send that state. Also fires
  // after an engine reboot (#1369/#1376), which restarts the agent.
  | { kind: 'editor-ready' };

/** One selected entity's world pose, supplied by the inspector (the agent can't
 * read the inspected scene's Transform from its own engine). */
export interface SelectionEntity {
  entity: number;
  position: BusVec3;
  // World rotation, so gizmos can align their handles to the entity's local axes
  // (single-selection only — a multi-selection gizmo is world/identity aligned,
  // matching the Babylon gizmos).
  rotation: BusQuat;
}

/**
 * inspector → agent (`to: 'scene'`).
 *  - `set-selection`: the agent can't read the inspected scene's Transform from
 *    its own engine, so the inspector supplies every selected entity's world
 *    pose. The gizmo anchors to their centroid; a drag transforms each entity
 *    about that virtual pivot (empty array = cleared).
 *  - `query-drop-point`: ask the agent to raycast the ground under the current
 *    pointer (for placing a drag-dropped asset); answered by `drop-point`. `id`
 *    correlates request/reply.
 */
export type PageToScene =
  | {
      kind: 'set-selection';
      // Every selected entity's world pose. The gizmo anchors to their centroid;
      // each entity's offset from the centroid is cached at drag start and the
      // drag transforms them about that pivot. Empty = nothing selected.
      entities: SelectionEntity[];
      // The toolbar's "align to world" checkbox: true = translate/rotate handles
      // on the WORLD axes, false = on the entity's local axes. Scale ignores it
      // (always local). Local alignment applies to single selection only.
      alignToWorld: boolean;
      // The editor's snap increments (position: world units, rotation: RADIANS,
      // scale: factor) when snapping is enabled, or null when it's off. The
      // agent quantizes drag feedback + committed deltas to these; the inspector
      // additionally snaps the merged Transform authoritatively on commit.
      snap: { position: number; rotation: number; scale: number } | null;
      // Which gizmo to show for the selection (translate/rotate/scale), or `free`
      // when none is active. Drives which handles the agent draws + how a drag
      // commits. The inspector owns the mode (its Gizmos toolbar writes it to the
      // Selection component); it's forwarded here so the agent needn't read it.
      mode: GizmoMode;
    }
  // Ask the agent for the ground point under a viewport position. `ndc` is the
  // drop location in normalized device coords (x,y ∈ [-1,1], y up) so the agent
  // can raycast from the real cursor — during an HTML5 drag the engine's own
  // pointer is stale (the host overlay captures the drag). Omit `ndc` to fall back
  // to the engine's current pointer. `id` correlates the `drop-point` reply.
  | { kind: 'query-drop-point'; id: number; ndc?: { x: number; y: number } }
  // Ask the agent for the animation clip names of an entity's loaded GLTF. The
  // agent reads `GltfContainerLoadingState.animationNames` from the engine (the
  // inspector's `@dcl/ecs` can't decode that field); answered by `animations`.
  // `id` correlates request/reply.
  | { kind: 'query-animations'; id: number; entity: number }
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
  | { kind: 'reset-camera'; position: BusVec3 }
  // Dolly the editor fly-camera along its look direction (the toolbar zoom in/out
  // buttons + scroll). `delta` > 0 zooms IN (move forward), < 0 zooms OUT; its
  // magnitude is a step count. The agent moves a fixed distance per step along the
  // camera forward vector. Only meaningful in free-camera mode (the native avatar
  // camera owns its own zoom); the agent engages free mode so the buttons act.
  | { kind: 'zoom-camera'; delta: number }
  // Show a position-only handle for a spawn point (or its camera target) at the
  // given scene-local position, or hide it (null). Dragging it reports back over
  // `spawn-gizmo-commit`. Spawn points are scene metadata, so this is a bare
  // move-handle, not tied to a scene entity.
  | { kind: 'set-spawn-gizmo'; position: BusVec3 | null }
  // Draw the scene's spawn AREAS (#1374): a translucent box per spawn point,
  // always visible, so the user sees where the avatar can spawn (incl. ranges and
  // multiple points). The inspector recomputes + resends the full set whenever the
  // scene's spawnPoints metadata changes; an empty array clears them.
  | { kind: 'set-spawn-areas'; areas: SpawnArea[] }
  // Freeze (`frozen: true`) or run (`false`) the inspected scene. Frozen = the
  // scene stops ticking (no SDK7 systems / timers / onUpdate) so it's a static
  // subject to edit; the editor agent keeps running regardless. Editor default is
  // frozen; the toolbar toggle sends this. Enacted via the engine's
  // `/freeze_scene` / `/unfreeze_scene` console commands on the pinned scene.
  | { kind: 'set-scene-frozen'; frozen: boolean }
  // Stop/reset the inspected scene to its authored initial state (the toolbar's
  // Stop button, #1376). The agent restarts the scene in place via the engine's
  // `reload <hash>` console command on the pinned scene — fast, scene-scoped
  // (leaves the editor-agent portable running), and re-runs the SDK7 code from
  // scratch so anything that moved (a walking NPC) returns to start. Freeze is
  // re-asserted by the inspector afterwards (a fresh scene starts running).
  | { kind: 'reset-scene' }
  // Vertical fly-camera movement held state (E = up, Q = down). Unlike WASD/Space
  // — which the engine delivers to the fly camera as InputActions — Q has NO
  // Decentraland `InputAction`, so the engine can't read it. The inspector (host)
  // captures E/Q keydown/keyup on the engine window and forwards the held state
  // here; the agent's fly camera adds it to its per-frame move. `up`/`down` are the
  // current held state of each key (keydown → true, keyup → false); both may be
  // true (net zero) or false (no vertical). Ignored outside free-camera mode.
  | { kind: 'set-vertical-input'; up: boolean; down: boolean };

/** Every message is wrapped so a peer ignores its own posts / the wrong direction. */
export interface BusEnvelope {
  to: 'page' | 'scene';
  msg: AgentToPage | PageToScene;
}
