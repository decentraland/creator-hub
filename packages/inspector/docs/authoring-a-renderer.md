# Authoring an inspector renderer

The Decentraland inspector is **renderer-agnostic**. It owns the scene as
`@dcl/ecs` state (a CRDT-synced entity/component graph) and talks to whatever
draws that scene through a single interface, `IRenderer`. Babylon.js is the
default renderer; Three.js ships as a second one. You can add your own (Unity,
Bevy, PlayCanvas, a custom WebGL/WebGPU engine, …) without modifying the
inspector core.

This document is the contract spec. The public API lives at `@dcl/inspector`
(see `src/lib/renderer/index.ts`).

---

## The mental model

```
            CRDT stream (entities + components)
inspector  ───────────────────────────────────►  your renderer's @dcl/ecs engine
(authoritative)                                    │
   ▲                                               ▼  project components → your scene
   │   reverse channel (pick / gizmo events)       (Transform, GltfContainer, …)
   └───────────────────────────────────────────────┘
```

Two directions:

1. **Forward — state → pixels.** Your renderer runs its *own* `@dcl/ecs`
   `Engine`, connected to the inspector's CRDT stream. The full scene replays
   into it; you subscribe to component changes (`onChangeFunction`) and project
   them into your scene graph. This is the bulk of the work, and it's entirely
   yours — the inspector doesn't care how you draw.
2. **Reverse — interaction → edits.** The renderer is also the input device. It
   *emits* what the user did (clicked an entity, dragged a gizmo) and the
   inspector turns those into ECS edits. Your renderer never mutates scene
   state directly.

You do **not** implement CRDT, selection logic, undo/redo, or the data layer —
those are the inspector's. You implement drawing + input.

---

## Coordinate system & conventions

- **Right-handed, Y-up, meters.** Same as the SDK. (Babylon is left-handed
  internally; its adapter converts. Three.js is right-handed and maps directly.)
- **Vectors on the boundary are plain data**: `{ x, y, z }` (`@dcl/ecs-math`
  `Vector3`) and `{ x, y, z, w }` quaternions. **Never** pass a live engine
  object (a `THREE.Object3D`, a `BABYLON.Mesh`) across the contract — only IDs,
  scalars, and plain vectors. This is what lets a renderer run out-of-process.
- **Entities are numbers** (`@dcl/ecs` `Entity`). The root is entity `0`.

---

## The `IRenderer` interface

```ts
interface IRenderer {
  readonly events: Emitter<RendererEvents>;     // reverse channel (you emit)
  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly viewport: RendererViewport;
  readonly spawnPoints: SpawnPointController;
  readonly debug?: RendererDebug;                // optional native dev tools

  setSelection(entities: Entity[]): void;
  getPointerWorldPoint(): Promise<Vector3 | null>;
  getEntityAnimations(entity: Entity): Promise<string[]>;
  setGridVisible(visible: boolean): void;
  dispose(): void;
}
```

### Reverse-channel events (you emit these)

| Event | When to emit | Inspector does |
|---|---|---|
| `ready` | once your renderer is up | — |
| `pick` | user clicks the viewport | selects the entity / deselects on empty |
| `gizmoCommit` | a gizmo drag produced new transform(s) | writes Transform to ECS |
| `gizmoCommitEnd` | the drag finished | flushes the batch as one undo step |
| `cameraChange` | the user moved the camera | mirrors framing/minimap |
| `cameraSpeedChange` | camera speed changed | updates the speed HUD |

`pick` payload: `{ target: { kind: 'entity', entity } | { kind: 'empty' } | { kind: 'spawnPoint', selected }, modifiers: { multi } }`.
Raycast on click; if you hit an entity's geometry emit `kind: 'entity'`, else
`kind: 'empty'`. `multi` = shift/ctrl held.

`gizmoCommit` carries `{ transforms: Array<{ entity, position?, rotation?, scale? }> }`
— the *final* values (emit on drag-end, then `gizmoCommitEnd`). Do **not** stream
every frame across the boundary; move your own nodes locally during the drag and
only commit the result.

> Editor concerns you haven't built yet (gizmos, spawn-point handles, metrics)
> may be honest no-ops/zeros. The interface must be satisfied, but a renderer
> that can't answer something degrades gracefully — the inspector never assumes
> a particular scene graph exists.

### Sync getters

`camera.getSpeed()/getPose()`, `gizmos.isEnabled()/isWorldAligned()`,
`viewport.getGroundPlanes()/getEntityWorldPositions(ids)`, `metrics.getSceneMetrics()`
etc. are **synchronous** and may be called per-frame (the minimap reads
positions ~10Hz). Answer from local state; never block. (For an out-of-process
renderer, the inspector keeps a mirror fed by your pushed snapshots — see below.)

`getPointerWorldPoint()` resolves the world point under the pointer (for drop
placement); `getEntityAnimations(entity)` resolves a loaded GLTF's clip names.
Both are `Promise`-returning and one-shot.

---

## Registering your renderer

```ts
import { registerRenderer, connectReverseChannel } from '@dcl/inspector';

registerRenderer({
  id: 'my-org.my-renderer',
  label: 'My Renderer',
  mount(ctx) {
    // ctx: { canvas, container, loadAsset, connectReverseChannel }
    const myRenderer = new MyRenderer(ctx.container, ctx.loadAsset);

    // Wire input → ECS. Your scene engine provides the operations surface.
    const disconnect = ctx.connectReverseChannel({
      engine: myRenderer.engine,
      operations: myRenderer.operations,         // createOperations(engine)
      editorComponents: myRenderer.editorComponents, // createEditorComponents(engine)
      Transform: myRenderer.Transform,
      rendererEvents: myRenderer.events,          // the same bus IRenderer.events exposes
    });

    return {
      renderer: myRenderer,        // your IRenderer
      engine: myRenderer.engine,   // your @dcl/ecs engine (inspector wires CRDT to it)
      dispose: () => { disconnect(); myRenderer.dispose(); },
    };
  },
});
```

Register at module load. The inspector lists registered renderers in the
toolbar picker; selecting yours persists the choice and reloads with it active.

`ctx.loadAsset(src)` fetches asset bytes (GLBs, textures) from the inspector's
data layer — use it instead of `fetch`; the inspector owns where assets live.

The forward path: connect your `engine` to CRDT (the inspector does this from
your returned `engine`), and project component changes. The cleanest template is
`src/lib/renderer/three/ThreeSceneContext.ts` — a ~150-line CRDT subscriber that
turns `Transform`/`GltfContainer`/`MeshRenderer` into a Three scene graph.

---

## Out-of-process renderers (Unity, Bevy, WASM)

A renderer that isn't JS-in-the-same-heap (a Unity WebGL build, a Bevy/Rust→WASM
app) runs in a **child iframe** and talks to the inspector over `postMessage`
RPC. Inside your renderer document:

```ts
import { startRendererIframe } from '@dcl/inspector';

startRendererIframe({
  parentOrigin: 'https://the-inspector-origin',
  createRenderer: (loadAsset) => new MyEngineRenderer(loadAsset),
});
```

The inspector side runs a `RemoteRenderer` (an `IRenderer` proxy) that mirrors
your pushed state so its sync getters stay synchronous, and forwards commands /
your events over the wire. Everything crossing the boundary is JSON-serializable
by construction (IDs, scalars, vectors, `Uint8Array` asset bytes). `loadAsset`
requests asset bytes back across the boundary.

---

## Verifying your implementation

Run the conformance suite against your `IRenderer` (see
`src/lib/renderer/conformance.ts`):

```ts
import { createRendererConformanceSuite } from '@dcl/inspector';

createRendererConformanceSuite(() => buildMyRendererForTest());
```

It checks the contract's observable behavior: building scene objects from ECS
changes, `pick` emission, camera pose round-trips, graceful degradation of
unimplemented features, and clean `dispose`.

---

## Scope guidance

A minimal-but-useful renderer implements: Transform + GltfContainer/MeshRenderer
projection, a camera (even just programmatic pose), and click-pick. That's
enough to view and select. Gizmo manipulation, materials/text/video, selection
highlighting, and camera-fly controls are additive — implement them as your
renderer matures; the inspector degrades gracefully without them.
