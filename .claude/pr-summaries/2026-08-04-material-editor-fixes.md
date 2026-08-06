# Material editor: albedo alpha control, zero-value defaults fix, engine-matching texture defaults

## Overview

Three fixes to the inspector's Material editor (`packages/inspector/src/components/EntityInspector/MaterialInspector/`):

1. The PBR `albedoColor` alpha channel is now editable via a "Color Alpha" slider (and preserved for unlit `diffuseColor`).
2. The converter no longer snaps explicit `0` values back to defaults (`||` → nullish/NaN-safe handling).
3. The Texture editor's default wrap/filter modes now match the engine defaults (Clamp / Bilinear instead of Repeat / Point).

## Albedo color alpha

**Behavior:** The PBR material section shows a "Color Alpha" range field (0–1, step 0.01) directly below the Color field, following the same pattern as the ParticleSystem editor's color alphas. Alpha is written into `albedoColor.a` and read back from it. Pasting an 8-digit `#RRGGBBAA` hex into the color field also works: the hex's own alpha wins and syncs back into the slider. Unlit `diffuseColor` (also a `Color4` in `@dcl/ecs`) gets no control, but its alpha now survives edits via a hidden `diffuseColorAlpha` pass-through instead of being forced to 1.

**Implementation:** New `albedoColorAlpha` / `diffuseColorAlpha` fields on `MaterialInput`; a `toColor4WithAlphaOrUndefined` helper in `MaterialInspector/utils.ts` mirrors `TextShapeInspector`'s `toColor4WithAlpha` (8-digit hex keeps its own alpha; empty/NaN alpha keeps the parsed color's alpha). The `PbrMaterial` component takes an optional `albedoColorAlpha` prop and renders the slider only when wired, so `GltfNodeModifiersInspector` (which reuses `PbrMaterial` without the prop) is unaffected.

## Explicit zeros no longer snap back to defaults

**Behavior:** Entering `0` for Metallic, Roughness, Specular/Direct/Emissive intensity, or choosing transparency mode Opaque (value 0) now sticks, instead of reverting to the defaults (0.5 / 1 / Auto).

**Implementation:** `toMaterial` used `Number(value.x || default)`, which treats `'0'` as falsy. Replaced with a `toNumberOrDefault` helper (defined in `Texture/utils.ts`, shared with the texture converter) that falls back only on `undefined`, empty string, or NaN. Also applied to `alphaTest`, whose previous `Number(value ?? 0.5)` turned an empty string into `0`.

## Texture default wrap/filter modes match the engine

**Behavior:** When a texture has no explicit `wrapMode`/`filterMode`, the dropdowns now display Clamp and Bilinear — the engine defaults per the protocol (`default = TextureWrapMode.Clamp`, `default = FilterMode.Bilinear`) — instead of Repeat and Point. On save, the editor writes the engine default values (`TWM_CLAMP` = 1, `TFM_BILINEAR` = 1) rather than leaving the field unset; since these are exactly what the engine uses when unset, materializing them is rendering-neutral for existing scenes, whereas the old code silently switched unset textures to Repeat/Point on any material edit. Explicitly selected Repeat/Point (value 0) is preserved.

**Implementation:** `DEFAULT_WRAP_MODE` / `DEFAULT_FILTER_MODE` constants in `Texture/utils.ts`; `fromTexture` defaults unset modes to them for all three texture kinds (texture, avatarTexture, videoTexture), and `toTexture` uses `toNumberOrDefault` with the same constants (dropping the old `?? '0'` coercion that forced unset to Repeat/Point).

## Testing

- `MaterialInspector/utils.spec.ts`: new cases for explicit zeros surviving `toMaterial` and a full `fromMaterial(toMaterial(...))` round trip; unset/empty numerics falling back to defaults; albedo alpha write/read/round trip incl. alpha 0 and 8-digit hex; unlit diffuse alpha pass-through; updated texture-mode expectations to the new Clamp/Bilinear defaults.
- `Texture/utils.spec.ts`: new cases for unset modes defaulting to Clamp/Bilinear in both directions (all three texture kinds), and explicit Repeat/Point (0) being preserved.
- Verified: `npx vitest run src/components/EntityInspector/MaterialInspector` (41 tests pass), `npm run typecheck`, `npx eslint` and `npx prettier --check` on the MaterialInspector directory — all clean.
- Verified visually in the dev-server inspector (Playwright screenshots): Color Alpha slider default 1, set to 0.25, and a fresh Texture section showing Clamp/Bilinear defaults.
