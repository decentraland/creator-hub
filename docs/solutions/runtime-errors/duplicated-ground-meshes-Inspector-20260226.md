---
module: Inspector
date: 2026-02-26
problem_type: runtime_error
component: frontend_stimulus
symptoms:
  - "Ground meshes visually duplicated when opening a scene with a ground entity"
  - "Two overlapping sets of ground tile meshes rendered in Babylon scene"
root_cause: async_timing
resolution_type: code_fix
severity: high
tags: [race-condition, gltf-loading, ground-tiles, async-callback, babylon]
---

# Troubleshooting: Duplicated Ground When Opening a Scene

## Problem

When opening a scene that has a ground entity, ground tile meshes were rendered twice (overlapping), caused by a race condition between composite loading and the Scene component's `putSceneComponent` handler.

## Environment

- Module: Inspector (Babylon renderer)
- Affected Component: `editorComponents/scene.ts`, `sdkComponents/gltf-container.ts`
- Date: 2026-02-26

## Symptoms

- Ground meshes visually duplicated when opening a scene with a ground entity
- Two overlapping sets of ground tile meshes rendered in Babylon scene
- Only occurs on initial scene load, not on subsequent layout changes

## What Didn't Work

**Direct solution:** The problem was identified through code analysis and fixed on the first attempt after tracing the race condition lifecycle.

## Solution

Three coordinated fixes were applied:

### Fix 1: Skip `setGround` on initial load (`scene.ts`)

The `null -> Layout` transition in `setLayout` is initialization, not a genuine change. Gate `setGround` on `previousLayout !== null`.

**Code changes:**

```typescript
// Before (broken):
const lm = getLayoutManager(context.scene);
const didChange = lm.setLayout(value.layout);

if (didChange) {
  // setGround runs on every "change", including null → layout init
  // ...
}

// After (fixed):
const lm = getLayoutManager(context.scene);
const previousLayout = lm.getLayout();
const didChange = lm.setLayout(value.layout);

// skip on initial load (null -> layout) since composite already created the tiles
if (didChange && previousLayout !== null) {
  // ...
}
```

### Fix 2: Guard GLTF callback against disposed entities (`gltf-container.ts`)

Add `entity.isDisposed()` check in `tryLoadGltfAsync`'s callback to catch entities disposed during async load.

### Fix 3: Load version counter pattern (`gltf-container.ts`)

A `WeakMap<EcsEntity, number>` tracks a monotonically increasing version per entity. The version is bumped in `removeGltf` (invalidates in-flight loads) and at the start of each load in `tryLoadGltfAsync`. The callback checks both `isDisposed()` and version mismatch.

**Code changes:**

```typescript
// Load version tracking - invalidates stale async GLTF callbacks
const gltfLoadVersion = new WeakMap<EcsEntity, number>();

function getLoadVersion(entity: EcsEntity): number {
  return gltfLoadVersion.get(entity) ?? 0;
}

function incrementLoadVersion(entity: EcsEntity): number {
  const version = getLoadVersion(entity) + 1;
  gltfLoadVersion.set(entity, version);
  return version;
}

// In removeGltf:
export function removeGltf(entity: EcsEntity) {
  // ...
  incrementLoadVersion(entity); // invalidate in-flight loads
  // ...
}

// In tryLoadGltfAsync callback:
const loadVersion = incrementLoadVersion(entity);
loadAssetContainer(file, scene, assetContainer => {
  if (entity.isDisposed() || getLoadVersion(entity) !== loadVersion) {
    cleanupAssetContainer(scene, assetContainer);
    entity.resolveGltfPathLoading(filePath);
    loadAssetFuture.resolve();
    return;
  }
  // ... normal processing
});
```

## Why This Works

The root cause was a race condition in this sequence:

1. Composite loads -> Ground entity + Tile children created -> each tile's `GltfContainer` triggers **async** GLTF loading
2. Scene component loads -> `putSceneComponent` -> `setLayout()` returns `didChange = true` (layout goes from `null` -> scene layout)
3. `didChange` is true -> `setGround()` removes old Ground tiles and creates new ones
4. `removeGltf` on old tiles is a **no-op** because `entity.gltfContainer` / `entity.gltfAssetContainer` are still null (async load in flight)
5. Old async loads complete -> `processGLTFAssetContainer` -> `addAllToScene()` adds orphaned meshes
6. New tiles also load -> second set of meshes

**Fix 1** prevents step 3 entirely on initial load. The composite already created the correct tiles; the `null -> Layout` transition is initialization, not a genuine layout change.

**Fixes 2 & 3** are defensive layers: even if a race condition occurs through other code paths, the async callback will detect that the entity was disposed or its GLTF was invalidated, and clean up instead of adding orphaned meshes. The `WeakMap` ensures no memory leaks since entries are GC'd with their entities.

## Prevention

- **Async callback guards**: Any async operation that modifies scene state should check entity validity before applying results. Use a version/generation counter pattern rather than relying solely on `isDisposed()`.
- **Distinguish initialization from change**: When a state manager transitions from `null` to an initial value, consider whether downstream side effects should fire. Null-to-value is often initialization, not a user-initiated change.
- **`removeGltf` limitations**: Be aware that `removeGltf` is a no-op when the GLTF hasn't finished loading yet (`gltfContainer` and `gltfAssetContainer` are null). The load version counter compensates for this gap.

## Related Issues

No related issues documented yet.
