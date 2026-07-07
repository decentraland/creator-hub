# Bevy editor agent

A minimal **super-user SDK7 scene** that gives the inspector's Bevy renderer its
reverse channel: viewport **pick** (click → select) and a **translate gizmo**
(drag → move). The stock bevy-explorer engine has no console command for viewport
interaction, so this runs *inside* the engine as a portable experience and talks
to the inspector over a same-origin `BroadcastChannel` (`dcl-editor-bus`).

It is a **separate SDK7 project** (own `sdk-commands` build, own `node_modules`),
not part of the inspector's TS build — the inspector's `tsconfig` only includes
`src/`, so this dir is excluded from its typecheck/bundle.

## How it fits

- Loaded into the engine via the iframe's `?systemScene=<this scene's realm>`
  (config `bevySystemScene` in the inspector).
- **Boot order is load-bearing:** it logs in (guest) first — without an identity
  the engine hangs at boot — then pins the inspected scene with `set_scene`, so
  its super-user raycast is routed there.
- **Pick:** raycasts the inspected scene's colliders on pointer-down, posts the
  hit entity → inspector `pick-bridge` → `events.emit('pick')`.
- **Gizmo:** the inspector sends the selected entity + its world position
  (`set-selection`), since the agent can't read another scene's Transform. The
  gizmo attaches there; dragging an axis previews via `set_component` and, on
  release, posts `gizmoCommit` + `gizmoCommitEnd` → the inspector writes the
  authoritative Transform.

Bus message shapes are kept in sync with the inspector's `pick-bridge.ts` /
`selection-bridge.ts`.

## Build / run (for testing)

```
npm install          # once, in this dir
npm run build        # → bin/index.js
npm run start -- --port 8005 --no-browser --no-client
```

Then point the inspector at it — see the `bevy-renderer-testing-setup` runbook
for the full three-server + dual-URL setup.

## Scope / TODO

- Translate only (no rotate/scale, no on-top TextureCamera composite).
- Assumes the selected entity's given world position is meaningful (root-level).
- The engine expansion splits a glTF into separate collider + mesh entities;
  picking selects the hit entity as-is.
