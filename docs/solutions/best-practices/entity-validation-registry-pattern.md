---
title: Entity-level validation registry with material texture support and icon consistency
category: best-practices
tags:
  [validation, entity-errors, registry-pattern, safety-net-test, material, texture, inspector, ecs]
components:
  - packages/inspector/src/lib/sdk/validation/types.ts
  - packages/inspector/src/lib/sdk/validation/entity-validators.ts
  - packages/inspector/src/lib/sdk/validation/entity-validators.spec.ts
  - packages/inspector/src/components/EntityInspector/MaterialInspector/Texture/utils.ts
  - packages/inspector/src/components/EntityInspector/MaterialInspector/MaterialInspector.tsx
  - packages/inspector/src/components/Container/Container.tsx
  - packages/inspector/src/components/Tree/Tree.tsx
branch: feat/entity-errors
date: 2026-03-24
status: completed
related:
  - docs/solutions/best-practices/dynamic-s3-catalog-sdk-compat-gate-Inspector-20260224.md
  - docs/entity-level-warnings.md
---

# Entity Validation Registry Pattern

## Problem

The entity-level validation system in the Decentraland Inspector had three distinct issues:

1. **Missing texture validation** — Material texture `src` paths were never checked, so invalid paths went undetected and produced no user-facing error.
2. **Brittle if/else chain** — `entity-validators.ts` hardcoded each component's validation logic inline. Adding a new component required remembering to also update this file; there was no structural enforcement.

## Solution

Four coordinated changes address the three issues.

### Registry Pattern

The central `entity-validators.ts` was refactored from a manual if/else chain to a registry array of typed validators.

**Before** — validation logic hardcoded inline per component:

```ts
function hasValidationErrors(sdk, entity, assetCatalog): boolean {
  const { GltfContainer, AudioSource, ... } = sdk.components;
  const gltf = GltfContainer.getOrNull(entity);
  if (gltf && assetCatalog && !isValidGltfInput(assetCatalog, gltf.src)) return true;
  const audioSource = AudioSource.getOrNull(entity);
  if (audioSource && assetCatalog && !isValidAudioSourceInput(...)) return true;
  // ... repeated for each component
  return false;
}
```

**After** — each component owns its validator; the central file holds only the registry:

```ts
// types.ts — shared signature
export type EntityValidator = (
  sdk: SdkContextValue,
  entity: Entity,
  assetCatalog: AssetCatalogResponse | undefined,
) => boolean;

// entity-validators.ts — registry
export const entityValidators: EntityValidator[] = [
  gltfValidator,
  audioSourceValidator,
  audioStreamValidator,
  videoPlayerValidator,
  nftShapeValidator,
  placeholderValidator,
  materialTextureValidator,
];

function hasValidationErrors(sdk, entity, assetCatalog): boolean {
  return entityValidators.some(validator => !validator(sdk, entity, assetCatalog));
}
```

Each component's `utils.ts` exports its own validator with the standardized signature:

```ts
// e.g. GltfInspector/utils.ts
export const entityValidator: EntityValidator = (sdk, entity, assetCatalog) => {
  const gltf = sdk.components.GltfContainer.getOrNull(entity);
  if (gltf && assetCatalog && !isValidInput(assetCatalog, gltf.src)) return false;
  return true;
};
```

### Safety-Net Test

A structural test in `entity-validators.spec.ts` prevents future omissions by scanning the filesystem at test time:

```ts
function findUtilsWithEntityValidator(dir: string): string[] {
  // Recursively scans EntityInspector for utils.ts files
  // that export `export const entityValidator`
}

it('should register all entityValidator exports', () => {
  const utilsWithValidators = findUtilsWithEntityValidator(ENTITY_INSPECTOR_DIR);
  expect(entityValidators).toHaveLength(utilsWithValidators.length);
});
```

If a developer adds `export const entityValidator` to a new `utils.ts` but forgets to register it in the array, this test fails at CI time.

### Material Texture Validation

A new `entityValidator` in `MaterialInspector/Texture/utils.ts` validates all four texture slots — `texture`, `alphaTexture`, `bumpTexture`, and `emissiveTexture` — across both PBR and Unlit material types. It checks each slot's `src` path against the asset catalog and returns `false` if any path is invalid.

`MaterialInspector`'s Container was also updated to pass `indicator={hasInvalidTexture}` so the error surfaces visually in the inspector panel.

## How to Add Validation for a New Component

1. Open (or create) the component's `utils.ts` inside `EntityInspector/<ComponentName>/`.
2. Import `EntityValidator` from `../../../lib/sdk/validation/types`.
3. Export a validator — return `true` when valid or absent, `false` when invalid:
   ```ts
   export const entityValidator: EntityValidator = (sdk, entity, assetCatalog) => {
     const component = sdk.components.MyComponent.getOrNull(entity);
     if (component && assetCatalog && !isValidInput(assetCatalog, component.someField))
       return false;
     return true;
   };
   ```
4. Import the validator in `entity-validators.ts` and add it to the `entityValidators` array.
5. Pass `indicator={hasInvalidField}` to the component's `<Container>` so errors are visible in the inspector panel.
6. Run tests — the safety-net test will catch any count mismatch.

## Prevention

### Safety-net test catches missing registrations

The filesystem-scanning test counts files under `EntityInspector/` that export `entityValidator` and asserts that count matches the registry array length. If someone adds the export but forgets to register it, CI fails. The inverse case (a registry entry with no corresponding export) surfaces as a TypeScript import error.

### Standardized type prevents signature drift

The `EntityValidator` type ensures all validators share the same `(sdk, entity, assetCatalog) => boolean` contract. Any deviation is a type error at build time.

### Remaining gaps

- **Naming convention is not enforced by tooling.** The test assumes validators are in files named `utils.ts` under `EntityInspector/` with the exact export name `entityValidator`.
- **The test does not verify correctness.** A validator that always returns `true` would pass the safety-net test. Per-validator unit tests guard against silent no-ops.
- **No enforcement that a new component must have a validator.** If a component has validation needs but no one creates `entityValidator`, nothing complains. The checklist above is procedural, not tooling-enforced.

## Key Files

| File | Purpose |
| --- | --- |
| `packages/inspector/src/lib/sdk/validation/types.ts` | `EntityValidator` type definition |
| `packages/inspector/src/lib/sdk/validation/entity-validators.ts` | Central registry array and `validateAllEntities` |
| `packages/inspector/src/lib/sdk/validation/entity-validators.spec.ts` | Filesystem-based safety-net test |
| `packages/inspector/src/components/EntityInspector/MaterialInspector/Texture/utils.ts` | Material texture validator (4 texture slots, PBR + Unlit) |
| `packages/inspector/src/components/EntityInspector/MaterialInspector/MaterialInspector.tsx` | `indicator={hasInvalidTexture}` on Container |

## Related

- [Entity-Level Warnings](../../entity-level-warnings.md) — original feature design document for the entity tree error system this refactor builds upon.
- [Dynamic S3 Catalog + SDK Compat Gate](./dynamic-s3-catalog-sdk-compat-gate-Inspector-20260224.md) — related Inspector validation at asset-drop time.
