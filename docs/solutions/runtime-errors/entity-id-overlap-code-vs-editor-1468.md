---
module: Inspector
date: 2026-08-05
problem_type: design_spec
component: bevy_renderer
symptoms:
  - "A newly added editor entity replaces / overwrites a code-created entity (e.g. the barrel)"
  - "After undo, a code-created child entity is sent to 0,0,0 (its parent looks gone)"
  - "Dragging in a new entity visibly moves an unrelated code-created entity"
root_cause: entity_id_allocation_overlap
resolution_type: design_proposal
severity: high
status: proposed
issue: 1468
tags: [entity-id, allocation, composite, forward-edits, new_entity, bevy, sdk]
---

# Spec: Entity IDs from code overlap with editor-added entities (#1468)

> Status: **proposed / not yet implemented.** This is a design writeup so the fix can be
> chosen deliberately — a wrong allocation scheme renumbers or collides *persisted* entity
> ids and can corrupt scenes, so it should not be patched blind.

## Problem

In a scene that has **both** editor-authored entities and entities created at runtime by the
scene's **code**, adding a new entity in the editor can land on top of a code-created entity:

- The new entity "replaces" a code entity (the reporter's barrel).
- Undo then sends a code-created **child** to `0,0,0` (it assumes its parent no longer exists).
- Variant: dragging in a particle system moves the barrel; Stop reveals the particle where it
  was dropped but the barrel gone; Undo sends the particle to `0,0,0`; Stop again "fixes" it.

Reporter's own theory (correct): *"we're assigning this new entity the same ID as the entity
done by code — the highest in the composite + 1 — and that clashes with the code entity."*
Repro scene: `Archive.zip` attached to the issue.

## Root cause: two allocators grow into the same id range

Entity ids are 16-bit numbers. `@dcl/ecs`'s `createEntityContainer` seeds its counter at
`max(RESERVED_STATIC_ENTITIES=512, DCL_MAX_COMPOSITE_ENTITY + 1)`
(`node_modules/@dcl/ecs/dist/engine/entity.js`).

- **Authored entities** live in the composite at ids `512 … N`.
- **`DCL_MAX_COMPOSITE_ENTITY`** is an esbuild `define` set by `@dcl/sdk-commands` at **build
  time** (`logic/bundle.js`, from `getAllComposites().maxCompositeEntity`). It makes the
  **running scene's** `engine.addEntity()` start at `N+1`, so code-created entities sit *above*
  the composite — collision-free **in a normal build**.
- The **inspector's data-layer engine** allocates a new authored entity with `engine.addEntity()`
  too, and its counter is likewise seeded past the loaded composite → also **`N+1`**.

So the editor's *next authored id* and the running scene's *first code id* are **both `N+1`** →
they overlap. The build-time guard doesn't help the live editor, because the editor adds
authored entities **without rebuilding**, growing the composite straight into the range the
already-running scene's code entities occupy.

### Why it surfaces in the Bevy renderer specifically

Babylon renders in-process from the same engine/CRDT, so authored and code entities share one id
space and there is no cross-engine id pinning. The **Bevy** renderer runs the scene in a
**separate** engine; the forward-edit bridge pins the inspector's id into that engine via
`/new_entity --ids <id>` (so inspector ids == engine ids, which the pick/gizmo round-trip relies
on). That pinning is where the overlap turns destructive:

1. Editor adds entity `N+1`; `ensureInstantiated` sends `/new_entity … --ids N+1`
   (`src/lib/renderer/bevy/forward-edits.ts`).
2. `N+1` is already live as a **code** entity → the engine's `new_entity` replies
   *"could not allocate"* (`crates/scene_inspector/src/write_commands.rs`) → the console command
   rejects → `ensureInstantiated` catches it and clears `instantiated`.
3. But the queued `set_component N+1 <Component>` **still runs**, writing the editor's
   Transform/GltfContainer onto id `N+1` — the **code entity** — overwriting the barrel.
4. Undo/redo now operate on ids that mean different things in the composite vs the running
   engine → the orphaned child gets `0,0,0`.

This is closely related to the "renumbered to 513" observation in #1460.

## Why it's deferred (risk)

Entity ids are **persisted** to the composite / scene files and referenced by other data
(parenting, `SyncComponents.componentIds`, trigger `actions[].id` / `conditions[].id`). Any fix
that renumbers or reallocates ids must preserve every reference, or it corrupts saved scenes.
That's why this needs a deliberate design choice, not a quick patch — and why it couldn't be
verified as safely as the other batch fixes.

## Options

### A. Editor allocates from a high reserved band (editor-only) — *insufficient alone*
Give editor-added entities a high base (e.g. start at 32768) away from the low range code grows
into. **Problem:** it recurses — once high-id editor entities are saved, the next build's
`DCL_MAX_COMPOSITE_ENTITY` jumps to the high max and pushes code entities up into the same band.
A fixed code-entity range (SDK change) would still be required, so this doesn't stand on its own.

### B. Split the id space into fixed, non-overlapping ranges (SDK/engine) — *cleanest long-term*
Convention: authored/editor entities use `[512, K)`, runtime code entities use `[K, 65535)`.
`engine.addEntity()` at **runtime** allocates from `[K, …)` regardless of composite max; the
editor allocates authored ids from `[512, K)`. Collisions become impossible by construction.
**Cost:** cross-repo change (`@dcl/ecs` + `@dcl/sdk-commands`), affects all scenes, halves each
range's capacity, needs a migration story for existing scenes. Best permanent fix.

### C. Editor adopts engine-allocated ids (editor-only) — *large refactor*
Let the engine allocate a collision-free id (`/new_entity` **without** `--ids`) and adopt the
returned id. **Cost:** breaks the inspector-id == engine-id invariant the pick/gizmo/selection
round-trip depends on, so it needs an id-translation layer across the whole bridge. And the id
still has to be unique in the inspector's own engine + composite.

### D. Detect the collision and re-allocate (editor-only) — *recommended near-term*
The editor already gets a failure signal: `/new_entity --ids N+1` **fails** when the id is live.
Turn that silent failure into a correct outcome:
1. On `new_entity` failure, **do not** `set_component` to that id (the bug: today it still does).
2. Re-allocate the entity at a **non-colliding** id — allocated above *both* the composite max
   **and** the running engine's current max live id (queryable via `/crdt_snapshot` /
   `/scene_entities`), in the inspector engine + CRDT — and retry.
3. Record the final id in undo so undo/redo stay consistent.
**Cost:** migrating a half-added entity's components (and any children) to the new id mid-op, and
threading it through the add-asset operation + undo. Contained and editor-only; unblocks users
without an SDK release.

## Recommendation

- **Near-term:** Option **D** — never overwrite a code entity. Gate `set_component` on a
  succeeded `/new_entity`, and on collision re-allocate above the engine's live max. This stops
  the destructive behavior (barrel overwrite, `0,0,0` orphans) with an editor-only change.
- **Long-term:** Option **B** — reserve distinct authored vs runtime id ranges in the SDK so the
  overlap cannot occur, and retire the editor-side workaround.

## Verification plan

Reproduce with the issue's `Archive.zip` (has both authored + code entities, incl. the "Tesstt"
barrel) in the **Bevy editor**:
1. Add a new entity / drag in an asset → confirm it does **not** move or replace the barrel.
2. Undo → confirm no code-created child jumps to `0,0,0`.
3. Drag in a particle system → confirm the barrel stays; Stop/Undo behave consistently.
4. Regression: authored-only and code-only scenes still add/undo entities normally; pick/gizmo
   still select the right entity (inspector-id == engine-id invariant preserved, or the
   translation layer is correct if Option C is ever taken).

## Key references

- `src/lib/renderer/bevy/forward-edits.ts` — `ensureInstantiated` (`/new_entity --ids`), the
  forward path that overwrites the code entity on collision.
- `src/lib/sdk/operations/add-asset/index.ts` — where the editor allocates the new entity id.
- `@dcl/ecs` `createEntityContainer` / `DCL_MAX_COMPOSITE_ENTITY` — the seed of both counters.
- `@dcl/sdk-commands` `logic/bundle.js` — sets `DCL_MAX_COMPOSITE_ENTITY` at build time.
- bevy-explorer `crates/scene_inspector/src/write_commands.rs` — `new_entity` collision reply.
