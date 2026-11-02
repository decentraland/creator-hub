# Tween editor: continuous movement modes, unsupported-mode preservation, analytics fix

## Overview

Extends the inspector's Tween editor with the two continuous tween modes from the SDK protocol (`moveContinuous`, `rotateContinuous`), stops the editor from silently destroying tween modes it can't edit (e.g. `textureMove`), and fixes the remove-component analytics event that reported the wrong component name.

All changes are contained in `packages/inspector/src/components/EntityInspector/TweenInspector/`.

## Continuous tween modes

### Behavior

- The Tween Type dropdown now offers **Move Continuous** and **Rotate Continuous** alongside Move/Rotate/Scale Item.
- Continuous modes are velocity-based (`direction` + `speed` in the `PBTween` oneof), so the Start/End vectors and the Duration/Easing controls are hidden for them; instead the editor shows:
  - a **Direction** vector block — labeled `Direction (meters/sec)` for Move Continuous and `Direction (degrees/sec)` for Rotate Continuous,
  - a **Speed** number field (scalar multiplier, defaults to 1).
- Rotate Continuous edits the direction as Euler degrees and converts to the protocol's quaternion using the same Yaw/Pitch/Roll conversion the existing Rotate mode uses (and back via `toEulerAngles` when reading).
- Duration/easing values already stored on the component are retained when switching to a continuous mode (only the controls are hidden), so switching back doesn't lose them.
- The phantom empty dropdown entry produced by `TweenType.KEEP_ROTATING_ITEM` (it had no label and no conversion, so selecting it destroyed the mode) is no longer listed; options are now an explicit list instead of `Object.values(TweenType)`.

### Implementation

- `types.ts`: `ContinuousTweenType` enum (`move_continuous`, `rotate_continuous`), `UNSUPPORTED_TWEEN_TYPE` marker, and `TweenModeType` union; `TweenInput` gains `direction`, `speed`, and `unsupportedMode` fields.
- `utils.ts`: `fromTween`/`toTween` handle the `moveContinuous`/`rotateContinuous` oneof cases; shared `quaternionToAngles`/`anglesToQuaternion` helpers extracted from the previously duplicated Rotate conversion code.
- `TweenInspector.tsx`: conditional rendering of the Start/End/Duration/Easing group vs the Direction/Speed group based on the selected type.

## Unsupported modes are preserved instead of destroyed

### Behavior

Previously, if an entity carried a tween mode the editor doesn't support (`textureMove`, `textureMoveContinuous`, `moveRotateScale`), any edit in the panel silently converted the component to a zero-vector Move. Now:

- The dropdown shows the current mode as a disabled entry, e.g. **Texture Move (not editable)**; only Auto start / Loop remain editable.
- Edits (e.g. toggling Auto start) keep the unsupported mode payload intact.
- Picking a supported type from the dropdown still converts the tween explicitly.

### Implementation

`fromTween` maps unknown `mode.$case` values to the `unsupported` input type (remembering the case name for the label); `toTween` omits the `mode` key entirely for that type, so `useComponentInput`'s `{ ...componentValue, ...toTween(input) }` merge preserves the existing mode.

## Analytics fix

`handleRemove` tracked `Event.REMOVE_COMPONENT` with `componentName: CoreComponents.VIDEO_PLAYER` (copy-paste bug); it now reports `CoreComponents.TWEEN`.

## Testing

- New `utils.spec.ts` (10 tests): component↔input conversion for move/rotate/scale regression, moveContinuous and rotateContinuous (including quaternion↔euler round-trip), unsupported-mode detection, and mode preservation on merge.
- `npx vitest run src/components/EntityInspector/TweenInspector` — 10/10 pass.
- `npm run typecheck`, `npx eslint`, `npx prettier --check` — clean on the package/directory.
- Verified end-to-end in the dev-server inspector with Playwright: added a Tween via the Add Component menu (TweenSequence still auto-added, `{"sequence":[]}` unchanged), selected each new mode and confirmed the engine received `moveContinuous`/`rotateContinuous` values (90° Y input → quaternion `(0, 0.7071, 0, 0.7071)`), and confirmed a `textureMove` tween survives an Auto start toggle intact.
