---
title: 'Performance Degradation on Large GLTF Model Selection in 3D Inspector'
date: 2026-03-04
category: performance-issues
tags:
  - babylon.js
  - HighlightLayer
  - selection
  - performance
  - memory-leak
  - gpu-rendering
  - gltf
  - InstancedMesh
component: packages/inspector
severity: high
symptom: |
  Selecting large GLTF models (20+ sub-meshes) caused severe frame rate drops, UI freezes and a dark black shadow covers the entire model, making it unusable for editing.
  Some large models caused TypeError crashes: "Cannot read properties of undefined (reading 'add')"
root_cause: |
  Primary: New HighlightLayer created per individual mesh in selection (O(N) GPU passes). Each HighlightLayer
  performs stencil + 2 blur + composition passes = 60-80+ extra render passes/frame for a 20-mesh model.
  Empty HighlightLayers never disposed on deselection (memory leak).

  Secondary: InstancedMesh lacks onBeforeBindObservable required by HighlightLayer.addMesh(),
  causing TypeError when selection includes InstancedMesh subtypes.
github_issue: https://github.com/decentraland/creator-hub/issues/1175 https://github.com/decentraland/creator-hub/issues/1176
---

## Problem

In the Decentraland Creator Hub 3D editor, selecting large GLTF models caused severe performance lag and sometimes crashes. When users selected complex models with many child meshes (20+), the application would become unresponsive. Some models with `InstancedMesh` children caused a `TypeError: Cannot read properties of undefined (reading 'add')` crash.

## Root Cause

### 1. Performance Degradation (O(N) Render Passes)

In `packages/inspector/src/lib/babylon/decentraland/editorComponents/selection.ts`, the `toggleMeshSelection` function created a **new `HighlightLayer` for every individual mesh**:

```typescript
// OLD - one HighlightLayer per mesh
const highlightedMeshes = new Map<AbstractMesh, HighlightLayer>();

export function toggleMeshSelection(mesh: AbstractMesh, value: boolean) {
  // ...
  const newHl = new HighlightLayer('hl1', mesh.getScene()); // NEW layer per mesh!
  newHl.addMesh(mesh as Mesh, Color3.Yellow());
  newHl.blurHorizontalSize = 0.1;
  newHl.blurVerticalSize = 0.1;
  highlightedMeshes.set(mesh, newHl);
}
```

Each `HighlightLayer` triggers ~3-4 extra GPU render passes (stencil write + horizontal blur + vertical blur + composition). A model with 20 meshes = 60-80 extra passes per frame. Empty layers were never `.dispose()`d after deselection -- only `removeMesh()` was called, leaving orphaned layers running empty render passes (memory leak).

A single shared `HighlightLayer` named `'highlight'` already existed in `setup.ts` but was never used for selection.

### 2. InstancedMesh Crash

`InstancedMesh` extends `AbstractMesh` directly (not `Mesh`). The `onBeforeBindObservable` property is only defined on `Mesh`. When `HighlightLayer.addMesh()` tried to access `mesh.onBeforeBindObservable.add(...)` on an `InstancedMesh`, it threw:

```
TypeError: Cannot read properties of undefined (reading 'add')
  at _ThinHighlightLayer.addMesh (thinHighlightLayer.ts:476)
```

Babylon.js class hierarchy:

```
Node -> TransformNode -> AbstractMesh -> Mesh          (has onBeforeBindObservable)
                                      -> InstancedMesh  (does NOT have onBeforeBindObservable)
```

## Solution

### File: `selection.ts`

1. **Reuse the shared scene-level `HighlightLayer`** instead of creating one per mesh
2. **Changed tracking** from `Map<AbstractMesh, HighlightLayer>` to `Set<AbstractMesh>`
3. **Added `instanceof Mesh` guard** before HighlightLayer operations
4. **Changed `Mesh` from type-only import to value import** for runtime `instanceof` check

```typescript
// NEW - single shared HighlightLayer
import type { AbstractMesh } from '@babylonjs/core';
import { Color3, HighlightLayer, Mesh } from '@babylonjs/core'; // Mesh is value import now

const highlightedMeshes = new Set<AbstractMesh>();

export function toggleMeshSelection(mesh: AbstractMesh, value: boolean) {
  mesh.renderOverlay = value;
  mesh.overlayColor = Color3.White();
  mesh.overlayAlpha = 0.2;
  if (!(mesh instanceof Mesh)) return; // Guard: skip InstancedMesh and other non-Mesh types
  const sharedHl = mesh.getScene().effectLayers.find(l => l.name === 'highlight') as
    | HighlightLayer
    | undefined;
  if (value && !highlightedMeshes.has(mesh)) {
    sharedHl?.addMesh(mesh, Color3.Yellow());
    highlightedMeshes.add(mesh);
  } else if (!value && highlightedMeshes.has(mesh)) {
    sharedHl?.removeMesh(mesh);
    highlightedMeshes.delete(mesh);
  }
}
```

### File: `setup.ts`

Configured the shared `HighlightLayer` blur sizes to match the previous per-mesh appearance:

```typescript
highlightLayer.innerGlow = false;
highlightLayer.outerGlow = true;
highlightLayer.blurHorizontalSize = 0.1; // Added
highlightLayer.blurVerticalSize = 0.1; // Added
```

## Impact

- **Performance**: N layers with ~3-4 render passes each -> 1 layer regardless of mesh count
- **Memory**: No more leaked empty HighlightLayer instances after deselection
- **Stability**: InstancedMesh and other AbstractMesh subtypes no longer crash selection
- **Simplicity**: Less code, simpler data structure (Set vs Map)

## Prevention Strategies

### Babylon.js Effect Layer Rules

1. **Never create effect layers per mesh/entity** -- they are scene-wide resources that trigger full render passes. Always share a single instance and use `addMesh()`/`removeMesh()` to manage membership.
2. **Always guard mesh type before effect layer operations** -- use `instanceof Mesh` before calling `addMesh()`, as `InstancedMesh` and other `AbstractMesh` subtypes lack `Mesh`-specific observables.
3. **Use value imports (not type-only) for runtime checks** -- `import type { Mesh }` strips the class at compile time, making `instanceof` impossible at runtime.

### Babylon.js Class Hierarchy Gotchas

| Class           | Extends        | Has `onBeforeBindObservable` | HighlightLayer compatible |
| --------------- | -------------- | ---------------------------- | ------------------------- |
| `Mesh`          | `AbstractMesh` | Yes                          | Yes                       |
| `InstancedMesh` | `AbstractMesh` | No                           | No                        |
| `LinesMesh`     | `Mesh`         | Yes                          | Yes                       |
| `GroundMesh`    | `Mesh`         | Yes                          | Yes                       |

### Performance Red Flags

- Frame time increases linearly with selected entity count (O(N) behavior)
- Multiple "HighlightLayer" entries in GPU profiler (should be exactly 1)
- `scene.effectLayers.length` growing over time

## Related Files

- `packages/inspector/src/lib/babylon/decentraland/editorComponents/selection.ts` -- Selection highlight logic
- `packages/inspector/src/lib/babylon/setup/setup.ts` -- Scene setup, shared HighlightLayer creation
- `packages/inspector/src/lib/babylon/decentraland/GizmoManager.ts` -- Gizmo lifecycle tied to selection
- `packages/inspector/src/lib/babylon/decentraland/EcsEntity.ts` -- Entity mesh references

## Related Commits

- `915d5def` -- "Refactor: optimize position gizmo performance (#972)"
