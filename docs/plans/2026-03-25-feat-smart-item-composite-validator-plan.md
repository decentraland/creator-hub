---
title: "feat: Smart item composite validator — CI validation rules for asset packs"
type: feat
date: 2026-03-25
---

# feat: Smart item composite validator — CI validation rules for asset packs

## PR Description

```
## Summary

Adds a composite validation system to the asset-packs CI pipeline that checks component dependencies in smart item `composite.json` files. This catches broken items **before** they reach production.

Motivated by PR #1154, which silently broke 7 smart items by removing collision-related components during the placeholder migration. The existing validator only checked that trigger action refs had non-null `id` and `name` — it had no awareness of component dependencies.

### What it does

Expands `make validate-asset-packs` (already runs in CI on every asset-packs PR) with 9 validation rules that check component relationships across all 214 smart items.

### Validation rules

**Errors (block CI):**

1. **`pointer-events-requires-collider`** — If an entity has `PointerEvents` or an `on_input_action`/`on_click` trigger, it must have a collider (MeshCollider or GltfContainer)
2. **`invisible-collider-needs-collision-mask`** — If an entity has `VisibilityComponent(visible: false)` + `GltfContainer`, at least one collision mask must be > 0 (otherwise it has no effect at runtime). Skips items that use `set_visibility` to toggle at runtime
3. **`trigger-action-references-must-resolve`** — Self-referencing trigger actions must point to an action name that actually exists in the entity's Actions component
4. **`animator-requires-gltf`** — If an entity has `Animator`, it must have `GltfContainer` (animations live inside GLTF models)
5. **`video-player-requires-display`** — If an entity has `VideoPlayer`, it must have a texture source (`GltfNodeModifiers` or `Material`) and a render surface (`GltfContainer` or `MeshRenderer`)
6. **`trigger-conditions-reference-valid-components`** — Trigger conditions referencing states (`when_state_is`) or counters (`when_counter_equals`) must have the corresponding `States` or `Counter` component on the entity

**Warnings (don't block CI):**

7. **`states-must-be-referenced`** — If an entity defines `States`, they should be referenced somewhere in triggers or actions
8. **`actions-unique-names`** — Action names within an `Actions` component should be unique
9. **`text-shape-mutually-exclusive`** — `TextShape` should not coexist with `MeshRenderer` or `GltfContainer` on the **same entity** (they are mutually exclusive per SDK spec). Multi-entity composites where TextShape is on a child entity are fine

### Files

- `packages/asset-packs/src/validation/rules.ts` — All 9 validation rules
- `packages/asset-packs/src/validation/helpers.ts` — Shared utilities (component lookup, collision mask checks)
- `packages/asset-packs/src/validation/index.ts` — Orchestrator
- `packages/asset-packs/scripts/validate.ts` — Updated entry point

### How it integrates

No changes to the GitHub Actions workflow needed — `make validate-asset-packs` already runs in `.github/workflows/asset-packs.yml` on every PR that touches `packages/asset-packs`.

## Test plan

- [ ] `make validate-asset-packs` passes with 0 errors on all 214 current smart items
- [ ] Introducing a broken composite (e.g. PointerEvents without collider) fails the validator
- [ ] Warnings are printed but don't block the pipeline
```

## Implementation

### Files created/modified

```
packages/asset-packs/
├── scripts/
│   └── validate.ts                    ← modified: calls validateComposite() per asset
├── src/
│   └── validation/
│       ├── index.ts                   ← new: orchestrator
│       ├── rules.ts                   ← new: 9 validation rules
│       └── helpers.ts                 ← new: component lookup + collision helpers
```

### CI integration

```
CI (asset-packs.yml)
  → make validate-asset-packs
    → npm run validate
      → ts-node scripts/validate.ts
        → per asset:
           1. existing validation (trigger id/name not null)
           2. NEW: validateComposite(asset) → runs all rules
           3. reports errors with asset name + rule + detail
```

No changes to GitHub Actions workflow — `make validate-asset-packs` already runs on every asset-packs PR.

## References

- PR #1154 (placeholder migration): https://github.com/decentraland/creator-hub/pull/1154
- PR #1255 (click/trigger area fix): https://github.com/decentraland/creator-hub/pull/1255
- Existing validator: `packages/asset-packs/scripts/validate.ts`
- CI workflow: `.github/workflows/asset-packs.yml` (line 58-59)
- Collision layers: `packages/asset-packs/src/enums.ts:150-171`
- Trigger types: `packages/asset-packs/src/trigger-enums.ts`
- Action handlers: `packages/asset-packs/src/actions.ts`
