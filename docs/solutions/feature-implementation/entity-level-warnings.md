---
title: Entity-Level Warnings — Surfacing validation errors in entity tree and component headers
category: feature-implementation
tags: [validation, entity-errors, inspector, ecs, redux, entity-tree, error-indicator]
components:
  - packages/inspector/src/redux/entity-validation/index.ts
  - packages/inspector/src/lib/sdk/validation/entity-validators.ts
  - packages/inspector/src/components/EntityValidation/EntityValidation.tsx
  - packages/inspector/src/components/Tree/Tree.tsx
  - packages/inspector/src/components/Container/Container.tsx
branch: feat/entity-errors
date: 2026-03-24
status: completed
issue: https://github.com/decentraland/creator-hub/issues/928
related:
  - docs/solutions/best-practices/entity-validation-registry-pattern.md
---

# Entity-Level Warnings

**Issue:** [#928](https://github.com/decentraland/creator-hub/issues/928)

## Problem

When a component field has a validation error (e.g., invalid GLTF path, invalid audio URL), the error was only visible as a red border on the specific field inside the component inspector panel. If the component section was collapsed or the user hadn't scrolled to it, the error was completely invisible. Users had no way to know an entity had problems without manually expanding every component.

## Solution

Surface validation errors to two new locations:

1. **Entity tree (left panel):** A red circle icon appears next to any entity that has one or more invalid component values. This is visible at all times without selecting the entity.
2. **Component section headers (right panel):** A red error circle appears on collapsed component sections that contain errors, so users can spot the problematic component without expanding every section.

## Architecture

The implementation follows the existing **out-of-bounds warning** pattern, which already shows a yellow triangle on entities that are outside scene boundaries.

### Data flow

```
ECS Engine (component values)
       |
       v
EntityValidation component (headless, listens for changes)
       |  runs validateAllEntities() on every PUT/DELETE event (debounced 100ms)
       v
Redux: entityValidation.entitiesWithErrors (number[])
       |
       v
Tree component reads selector, shows red ErrorIcon
```

### Why centralized validation?

Component inspectors only mount for the **selected** entity. The entity tree needs to show errors for **all** entities simultaneously. The solution reads component values directly from the ECS engine and runs the same validation functions that inspectors use, but for every entity in the scene.

## Files

### New files

| File | Purpose |
|---|---|
| `packages/inspector/src/redux/entity-validation/index.ts` | Redux slice: `entitiesWithErrors: number[]` state, action, and selector |
| `packages/inspector/src/lib/sdk/validation/entity-validators.ts` | Registry array + `validateAllEntities(sdk, assetCatalog)` that iterates all entities and runs each registered validator |
| `packages/inspector/src/lib/sdk/validation/types.ts` | `EntityValidator` type definition — standardized signature for all validators |
| `packages/inspector/src/lib/sdk/validation/entity-validators.spec.ts` | Safety-net test ensuring all `entityValidator` exports are registered |
| `packages/inspector/src/components/EntityValidation/EntityValidation.tsx` | Headless React component that listens for ECS changes, runs validation, and dispatches results to Redux |
| `packages/inspector/src/components/EntityValidation/index.ts` | Barrel export |

### Modified files

| File | Change |
|---|---|
| `packages/inspector/src/redux/store.ts` | Registered `entityValidation` reducer |
| `packages/inspector/src/components/Renderer/Renderer.tsx` | Mounted `<EntityValidation />` component |
| `packages/inspector/src/components/Tree/Tree.tsx` | Added red `ErrorIcon` with recursive child propagation (same pattern as out-of-bounds `WarningIcon`) |
| `packages/inspector/src/components/Tree/Tree.css` | Added `.ErrorIcon` style (`color: var(--error-main)`) and spacing for both icons |
| `packages/inspector/src/components/Container/Container.tsx` | Unified indicator icon to `IoAlertCircleOutline` (red error circle) |
| `packages/inspector/src/components/Container/Container.css` | Indicator color set to `var(--error-main)` |
| `packages/inspector/src/components/EntityInspector/GltfInspector/GltfInspector.tsx` | Added `indicator={files && !isValid}` to Container |
| `packages/inspector/src/components/EntityInspector/AudioSourceInspector/AudioSourceInspector.tsx` | Added `indicator={files && !isValid}` to Container |
| `packages/inspector/src/components/EntityInspector/AudioStreamInspector/AudioStreamInspector.tsx` | Added `indicator={!isValid}` to Container |
| `packages/inspector/src/components/EntityInspector/VideoPlayerInspector/VideoPlayerInspector.tsx` | Added `indicator={files && !isValid}` to Container |
| `packages/inspector/src/components/EntityInspector/NftShapeInspector/NftShapeInspector.tsx` | Added `indicator={!isValid}` to Container, extracted `isValid` from hook |
| `packages/inspector/src/components/EntityInspector/PlaceholderInspector/PlaceholderInspector.tsx` | Added `indicator={files && !isValid}` to Container |
| `packages/inspector/src/components/EntityInspector/MaterialInspector/MaterialInspector.tsx` | Added `indicator={hasInvalidTexture}` to Container |

## Validated components

Each component exports an `entityValidator` from its `utils.ts`, registered in the central array:

| Component | Validation | Source |
|---|---|---|
| GltfContainer | `src` path exists in asset catalog | `GltfInspector/utils.ts` |
| AudioSource | `audioClipUrl` exists in asset catalog | `AudioSourceInspector/utils.ts` |
| AudioStream | `url` is a valid HTTPS URL | `AudioStreamInspector/utils.ts` |
| VideoPlayer | `src` is a valid URL or file in catalog | `VideoPlayerInspector/utils.ts` |
| NftShape | `urn` matches URN format regex | `NftShapeInspector/utils.ts` |
| Placeholder | `src` path exists in asset catalog | `PlaceholderInspector/utils.ts` |
| Material | All texture `src` paths (texture, alpha, bump, emissive) valid in catalog | `MaterialInspector/Texture/utils.ts` |

## Behavior details

- **Child propagation:** If a child entity has an error, the parent entity also shows the red icon (same recursive check as out-of-bounds warnings).
- **Coexistence:** Both the yellow out-of-bounds warning and the red validation error icon can appear simultaneously on the same entity.
- **Empty values:** Empty fields are treated as valid (consistent with inspector behavior).
- **Asset catalog loading:** Validators that depend on the asset catalog skip validation until the catalog loads, then re-validate automatically.
- **Debouncing:** Validation runs are debounced at 100ms to avoid excessive re-computation during rapid changes (undo/redo, drag operations).

## How to extend

See [Entity Validation Registry Pattern](../best-practices/entity-validation-registry-pattern.md) for the full step-by-step guide on adding validation for a new component.
