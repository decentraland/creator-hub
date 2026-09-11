# ParticleSystem editor: rotation controls, full texture round-trip

## Overview

The inspector's ParticleSystem editor dropped several `PBParticleSystem` fields on every edit
because its save path rebuilds the component from the editor inputs: `initialRotation` and
`rotationOverTime` were never read or written, and only the texture `src` survived (wrap mode,
filter mode, offset, and tiling were discarded). This PR adds UI for all of them and makes the
converters round-trip the full component.

## Rotation controls

**Behavior**

- New "Rotation" section (between Size and Color) with two X/Y/Z rows:
  - Initial Rotation (deg): rotation of each particle at birth.
  - Rotation Over Time (deg/sec): per-axis angular velocity (limited to ±180/axis by the
    quaternion encoding, noted in the tooltip).
- Values are entered as Euler degrees and stored as quaternions, matching the proto
  ("converted to Euler XYZ"). Zero rotation maps back to "unset", so an untouched editor never
  materializes the fields.

**Implementation**

- `utils.ts`: `fromQuaternion` / `eulerDegreesToQuaternion` / `toQuaternion` helpers using
  Babylon's `Quaternion.RotationYawPitchRoll` / `toEulerAngles` (same convention as
  TransformInspector); degrees rounded to 2 decimals for stable round-trips.
- `types.ts`: `EulerInput` added to `ParticleSystemInput`.
- `isValidInput` rejects non-numeric rotation entries.

## Texture wrap/filter/offset/tiling

**Behavior**

- Under "Use Texture": Wrap Mode and Filter Mode dropdowns, plus Offset X/Y and Tiling X/Y
  numeric fields.
- Unset fields stay unset: the dropdowns display the engine defaults (Clamp / Bilinear) and the
  numeric fields show placeholders (0 / 1), but nothing is written to the component until the
  user sets a value. Setting one axis of offset/tiling fills the other with the engine default.

**Implementation**

- `types.ts`: `TextureInput` (empty string = unset), `WRAP_MODE_OPTIONS`, `FILTER_MODE_OPTIONS`,
  `DEFAULT_WRAP_MODE`, `DEFAULT_FILTER_MODE` (from the `@dcl/ecs` `TextureWrapMode` /
  `TextureFilterMode` enums).
- `utils.ts`: `fromTexture` / `toTexture` / `toVector2` converters that preserve unset fields.

## Save-path audit / fixes

- Audited every `PBParticleSystem` field against `toComponent`: with rotation and the full
  texture added, every field in the schema now survives an edit (shape, bursts, sprite sheet,
  limit velocity, etc. were already carried).
- `toComponent` now writes `texture: undefined` explicitly when "Use Texture" is off (previously
  the key was omitted, so the single-entity save path's spread-merge over the current component
  value silently kept the old texture and the checkbox could not actually remove it).

## Testing

- New `ParticleSystemInspector/utils.spec.ts` (15 tests):
  - quaternion <-> Euler conversion in both directions, zero-maps-to-unset;
  - texture field conversion, unset preservation, partial offset/tiling axis defaults;
  - round-trip regression: a fully code-authored `PBParticleSystem` (every field set) survives
    `toComponent(fromComponent(c))` unchanged; bare-texture and empty components keep their
    unset fields unset;
  - `isValidInput` rejection of non-numeric rotation/offset entries.
- `npm run typecheck`, `npx eslint`, `npx prettier --check` pass on the package/directory.
- Verified live in the dev-server inspector: added a ParticleSystem to an entity, typed rotation
  values (which survived the engine round-trip) and enabled the texture fields (screenshots in
  `.claude/screenshots/particle-system-rotation.png` and
  `.claude/screenshots/particle-system-texture-fields.png`).
