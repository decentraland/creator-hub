# Bevy editor agent

A minimal **super-user SDK7 scene** that gives the inspector's Bevy renderer its
reverse channel: viewport **pick** (click → select) and a **translate gizmo**
(drag → move). The stock bevy-explorer engine has no console command for viewport
interaction, so this runs *inside* the engine as a portable experience and talks
to the inspector over a same-origin `BroadcastChannel` (`dcl-editor-bus`).

It is a **separate SDK7 project** (own `sdk-commands` build, own `node_modules`),
not part of the inspector's TS build — the inspector's `tsconfig` only includes
`src/`, so this dir is excluded from its typecheck/bundle. It builds with the
engine's companion protocol SDK (`@dcl/sdk@7.22.6-…commit-83012ab`), which must
match the engine bundle — a mismatch crashes the engine's asset loader.

> **This package is NOT a workspace** (it lives at `packages/inspector/agents/bevy`,
> outside the root `packages/*` glob) and has its **own `node_modules`**. The
> repo-wide `make init` / root `npm install` does **not** install it — you must
> run `npm install` here (see [Build / run](#build--run-for-testing)). Its one
> dependency, the shared `@dcl/inspector-bevy-protocol` bus contract, is a
> sibling package linked via `file:../protocol`.

## How it fits

- Loaded into the engine via the iframe's `?systemScene=<this scene's realm>`
  (config `bevySystemScene` in the inspector).
- **Boot order is load-bearing:** it logs in (guest) first — without an identity
  the engine hangs at boot — then pins the inspected scene with `set_scene`, so
  its super-user raycast is routed there.
- **Pick:** raycasts the inspected scene's colliders on pointer-down, posts the
  hit entity → inspector `pick-bridge` → `events.emit('pick')`.
- **Gizmo:** the inspector sends the selected entity + its world position
  (`set-selection`), since the agent can't read another scene's Transform. A
  translate gizmo attaches there, rendered on-top via a `TextureCamera` composite
  and grabbed by analytic ray-vs-axis hit-testing (engine raycast is unreliable
  for the small handles). On release it posts `gizmoCommit` + `gizmoCommitEnd`;
  the inspector merges the position into the entity's Transform (preserving
  rotation/scale) and does the authoritative write.

Bus message shapes are the shared `@dcl/inspector-bevy-protocol` package that both
this scene and the inspector (`pick-bridge.ts` / `selection-bridge.ts`) import —
one source of truth, no drift.

## Build / run (for testing)

```
npm install          # once, in this dir
npm run build        # → bin/index.js
npm run start -- --port 8005 --no-browser --no-client
```

Then point the inspector at it — see the `bevy-renderer-testing-setup` runbook
for the full three-server + dual-URL setup.

## Scope / TODO

- Translate only (no rotate/scale gizmo modes yet).
- The engine expansion splits a glTF into separate collider + mesh entities;
  picking selects the hit entity as-is (may be a collider, not the visible mesh).
