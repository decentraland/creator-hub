---
title: Entity-Level Warnings — Surfacing validation errors in entity tree and component headers
category: feature-implementation
tags: [validation, entity-errors, inspector, ecs, redux, entity-tree, error-indicator]
components:
  - packages/inspector/src/lib/sdk/validation/types.ts
  - packages/inspector/src/lib/sdk/validation/entity-validators.ts
  - packages/inspector/src/lib/sdk/validation/entity-validators.spec.ts
  - packages/inspector/src/components/EntityValidation/EntityValidation.tsx
  - packages/inspector/src/components/Tree/Tree.tsx
  - packages/inspector/src/redux/entity-validation/index.ts
branch: feat/entity-errors
date: 2026-03-24
status: completed
issue: https://github.com/decentraland/creator-hub/issues/928
---

# Entity-Level Warnings

**Issue:** [#928](https://github.com/decentraland/creator-hub/issues/928)

## Problem

When a component field has a validation error (e.g., invalid GLTF path, invalid audio URL), the error was only visible as a red border on the specific field inside the component inspector panel. If the component section was collapsed or the user hadn't scrolled to it, the error was completely invisible. Users had no way to know an entity had problems without manually expanding every component.

## Solution

Surface validation errors to two new locations:

1. **Entity tree (left panel):** A red circle icon appears next to any entity that has one or more invalid component values. The icon includes a tooltip explaining the issue.
2. **Component section headers (right panel):** The existing warning indicator on collapsed component sections signals which component contains the problematic field, so users can locate it without expanding every section.

## Architecture

The implementation follows the existing **out-of-bounds warning** pattern (yellow triangle on entities outside scene boundaries).

### Data flow

```
ECS Engine (CRDT PUT/DELETE events)
       |
       v
EntityValidation component (headless)
       |  filters by component IDs derived from validator registry
       |  debounces at 100ms
       |  runs validateAllEntities()
       |  skips Redux dispatch if result unchanged (fast-deep-equal)
       v
Redux: entityValidation.entitiesWithErrors (number[])
       |
       v
Tree component reads selector, recursively checks children, shows ErrorIcon
```

### Why centralized validation?

Component inspectors only mount for the **selected** entity. The entity tree needs to show errors for **all** entities simultaneously. The solution reads component values directly from the ECS engine and runs the same validation functions that inspectors use, but for every entity in the scene.

## Validator registry

Each `EntityValidator` is a self-describing object with `componentIds` (which ECS components to watch) and `validate` (the check itself). The `EntityValidation` component derives its change filter from the registry, so adding a new validator automatically updates the set of watched components.

```ts
export type EntityValidator = {
  componentIds: (sdk: SdkContextValue) => number[];
  validate: (sdk: SdkContextValue, entity: Entity, assetCatalog: AssetCatalogResponse | undefined) => boolean;
};
```

A safety-net test scans `EntityInspector/` for files exporting `entityValidator` and asserts the count matches the registry, catching forgotten registrations at CI time.

### Validated components

| Component | Validation | Source |
| --- | --- | --- |
| GltfContainer | `src` path exists in asset catalog | `GltfInspector/utils.ts` |
| AudioSource | `audioClipUrl` exists in asset catalog | `AudioSourceInspector/utils.ts` |
| AudioStream | `url` is a valid HTTPS URL | `AudioStreamInspector/utils.ts` |
| VideoPlayer | `src` is a valid URL or file in catalog | `VideoPlayerInspector/utils.ts` |
| NftShape | `urn` matches URN format regex | `NftShapeInspector/utils.ts` |
| Placeholder | `src` path exists in asset catalog | `PlaceholderInspector/utils.ts` |
| Material | All texture `src` paths (texture, alpha, bump, emissive) valid in catalog | `MaterialInspector/Texture/utils.ts` |

## Behavior details

- **Child propagation:** If a child entity has an error, the parent entity also shows the icon (same recursive check as out-of-bounds warnings).
- **Coexistence:** Both the yellow out-of-bounds warning and the red validation error icon can appear simultaneously.
- **Empty values:** Empty fields are treated as valid (consistent with inspector behavior).
- **Asset catalog loading:** Validators that depend on the asset catalog skip validation until the catalog loads, then re-validate automatically.
- **Debouncing:** Validation runs are debounced at 100ms to avoid excessive re-computation during rapid edits.
- **Dispatch optimization:** Results are compared with `fast-deep-equal` before dispatching to Redux, so tree nodes only re-render when the error set actually changes.

## How to add a new validator

1. Export an `entityValidator` from the component's `utils.ts`:
   ```ts
   export const entityValidator: EntityValidator = {
     componentIds: sdk => [sdk.components.MyComponent.componentId],
     validate: (sdk, entity, assetCatalog) => {
       const comp = sdk.components.MyComponent.getOrNull(entity);
       return !comp || !assetCatalog || isValidInput(assetCatalog, comp.someField);
     },
   };
   ```
2. Import and add it to the `entityValidators` array in `entity-validators.ts`.
3. Optionally pass `indicator={hasInvalidField}` to the component's `<Container>` for header-level feedback.
4. The safety-net test and `componentIds` derivation handle the rest automatically.
