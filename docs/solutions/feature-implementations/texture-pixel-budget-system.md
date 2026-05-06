---
title: 'Replace texture count limit with pixel-based texture budget system'
date: 2026-03-31
category: feature-implementations
tags:
  - scene-metrics
  - textures
  - performance
  - inspector
  - gpu-budget
  - babylon-js
component: packages/inspector
severity: moderate
status: implemented
---

# Replace texture count limit with pixel-based texture budget system

## Problem

The old system limited creators by **number of texture files**, not by actual GPU cost. This led to unintuitive outcomes:

- A single 2048x2048 texture was forbidden (max was 1024x1024)
- Dozens of 128x128 textures were allowed, even though they are _worse_ for performance than a single large atlas
- Texture count scaled logarithmically: `floor(log2(parcels + 1) * 10)`
- Visual quality was capped even when scenes could afford better textures
- Foundation-owned content regularly broke the public guidelines

## Root Cause

The metric being tracked (file count) did not correlate with the actual performance cost (GPU pixel throughput). A pixel-based budget better approximates real GPU cost.

## Solution

### Approach

Replace texture count with a **pixel budget** measured as total UV space occupied per material. Each parcel gets a budget of one 2048x2048 texture (4,194,304 pixels). All four texture layers (albedo, normal, emissive, alpha/ORM) share the same UV space, so the budget is expressed as a single number.

For each material, the **max pixel count across its layers** is taken as the representative cost. This is because all layers must have matching dimensions and UVs. The per-material max is then summed across all materials in the scene.

### Key Design Decision: Max-per-material vs sum-all-textures

Two approaches were considered:

- **Option A (sum all):** Sum pixels of ALL unique textures, budget = `parcels * 4 * 2048 * 2048`. Simple but misleading — a material with only an albedo would show 6% usage when it's really using 25% of one layer's UV space.
- **Option B (max per material):** For each material, take the largest layer's pixel count. Budget = `parcels * 2048 * 2048`. More accurate — reflects actual UV space occupied.

**Option B was chosen** because it aligns with how texture atlases work (all layers are mirrors of the same UV layout).

### Files Changed

| File | Change |
| --- | --- |
| `redux/scene-metrics/types.ts` | Added `texturePixels: number` to `SceneMetrics` |
| `redux/scene-metrics/index.ts` | Added `texturePixels: 0` to initial state |
| `components/Renderer/Metrics/types.ts` | Added `texturePixels` to `Metrics` interface and `Limits` enum (`2048 * 2048` per parcel) |
| `components/Renderer/Metrics/utils.ts` | Refactored `collectTexturesFromMaterial` to return `{uniqueTextures, maxLayerPixels}`, added `formatPixels()`, updated `getSceneLimits` for linear scaling |
| `components/Renderer/Metrics/Metrics.tsx` | Per-material pixel collection, info-only texture count, prominent budget warnings with specific messaging |
| `components/Renderer/Metrics/Metrics.css` | `BudgetExceeded` and `BudgetWarning` highlight styles |
| `lib/rpc/scene-metrics/scene-metrics.spec.ts` | Added `texturePixels` to mock data |
| `components/ImportAsset/texture-validation.ts` | **NEW** — GLB/GLTF parsing, image dimension extraction, texture constraint validation, auto-resize, GLB reconstruction |
| `components/ImportAsset/types.ts` | Added `textureIssues`, `textureImages` to `ModelAsset`; added `'texture'` to `ValidationError` type |
| `components/ImportAsset/utils.ts` | Integrated `validateTexturesInModel` call in `getModel()` |
| `components/ImportAsset/Slider/Slider.tsx` | Added `TEXTURE_WARNINGS` step, `handleFixTextures` with GLB/external image auto-resize |
| `components/ImportAsset/Slider/TextureWarnings.tsx` | **NEW** — Warning UI showing per-asset texture issues with Fix/Back actions |
| `components/ImportAsset/Slider/TextureWarnings.css` | **NEW** — Warning component styles |
| `components/ImportAsset/texture-validation.spec.ts` | **NEW** — Unit tests for `isPowerOfTwo` and `nextPowerOfTwo` |

### Code Examples

**Budget calculation (utils.ts):**

```typescript
export function getSceneLimits(parcels: number): Metrics {
  return {
    // ...other metrics...
    textures: Number.MAX_SAFE_INTEGER, // info-only, no cap
    // TODO: apply a hard cap for very large scenes once the team defines the max value
    texturePixels: parcels * Limits.texturePixels, // linear scaling
  };
}
```

**Per-material pixel collection (utils.ts):**

```typescript
// For each material, tracks max pixels across layers (albedo, normal, emissive, alpha)
// since all layers share UV space and must have matching dimensions
for (const key in material) {
  const value = (material as any)[key];
  if (value && typeof value === 'object' && 'getInternalTexture' in value) {
    const size = texture.getSize();
    const pixels = (size?.width ?? 0) * (size?.height ?? 0);
    if (pixels > maxLayerPixels) maxLayerPixels = pixels;
  }
}
```

**Metrics display (Metrics.tsx):**

- Texture count shown without a limit (e.g., "13")
- Pixel budget shown as megapixels (e.g., "4.2 / 4.2 MP")
- Budget warning appears first with specific text: "Texture budget exceeded. Textures will be automatically compressed when published, resulting in lower quality."

## Open Items

### Hard cap for large scenes

Budget scales linearly without a ceiling. A 400-parcel scene gets 1,677 MP budget. The team needs to define a max value via profiling. Implementation is a one-liner: `Math.min(parcels * Limits.texturePixels, HARD_CAP)`.

### Import validation (implemented)

Texture validation runs at model import time. When a GLTF/GLB is dropped into the Inspector, we:

1. Parse the GLTF JSON (for GLB: extract JSON+BIN chunks; for GLTF: parse directly)
2. Extract image dimensions using `createImageBitmap` (works for both embedded and external images)
3. Validate three constraints:
   - **Power of two:** width and height must both be powers of 2
   - **Square:** width must equal height
   - **Layer consistency:** all texture layers in a material (baseColor, normal, emissive, occlusion, metallicRoughness) must have the same dimensions
4. Show a `TextureWarnings` screen in the import dialog with three options:
   - **Back:** return to the upload screen
   - **Fix & Import:** auto-resize textures to the nearest power-of-2 square dimension

Auto-resize uses `OffscreenCanvas` for image processing. For GLB files, the entire binary is reconstructed with resized embedded images. For GLTF with external images, only the affected image files are replaced.

**Files:**

- `ImportAsset/texture-validation.ts` — validation logic, GLB parsing, image resizing, GLB reconstruction
- `ImportAsset/Slider/TextureWarnings.tsx` — warning UI component
- `ImportAsset/Slider/TextureWarnings.css` — warning styles

### Remaining work from shape document

- **Publish-time warnings:** Creator Hub deploy flow has no pixel budget awareness yet
- **Naming conventions:** `_atlas`, `_albedo`, `_normal`, `_emissive`, `_alpha` — handled by Blender plugin, not enforced in Creator Hub

## Prevention Strategies

- **When adding new metric types:** Follow the same pattern — add to `SceneMetrics` type, `Limits` enum, initial state, and `getSceneLimits`. Consider whether the metric is "info-only" or has a hard budget.
- **When modifying texture collection:** The `for...in` iteration on Babylon materials with `as any` is fragile. Consider migrating to `material.getActiveTextures()` API for type safety.
- **When modifying import validation:** The GLB parser in `texture-validation.ts` handles standard GLB chunk layout (JSON + BIN). Non-standard chunk ordering or multiple BIN chunks are not supported. The `rebuildGlb` function reconstructs the entire binary — changes to bufferView layout must keep 4-byte alignment.
- **Texture size timing:** `texture.getSize()` can return `{width: 0, height: 0}` briefly before textures finish loading. This is a known transient edge case consistent with how all other metrics behave — not worth special-casing.

## References

- Shape document: "Texture budget (no automated atlases)" — Nicolas Earnshaw
- Kickoff meeting notes: March 30, 2026
- Related constants: `packages/inspector/src/components/Renderer/Metrics/types.ts`
- Existing metrics UI: `packages/inspector/src/components/Renderer/Metrics/Metrics.tsx`
- RPC interface: `packages/inspector/src/lib/rpc/scene-metrics/`
