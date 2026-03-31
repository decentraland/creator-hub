# Fix Plan: Set Coordinates Confirm Button Disabled When No Changes

**Date:** 2026-03-31

## Problem Summary

When clicking on the "Set Coordinates" (advanced mode) section in the Scene Layout inspector, the **Confirm** button does nothing if the user hasn't made any changes. The button should be disabled when no changes have been made.

## Root Cause Analysis

**File:** `packages/inspector/src/components/EntityInspector/SceneInspector/Layout/ModeAdvanced/ModeAdvanced.tsx`

Two bugs:
1. The `disabled` prop (grid error state) declared in `Props` is **never destructured** from the component's props, so parent-computed errors (disconnected parcels, missing base parcel, zero parcels) silently have no effect on the Confirm button.
2. There is **no "no changes" detection** — the button is enabled as long as the fields are non-empty, even if the values exactly match the original `value` prop passed by the parent.

Current disabled check:
```tsx
const disabled = !coords.length || !base.length;  // only checks emptiness
```

## Relevant Files

| File | Role |
|---|---|
| `packages/inspector/src/components/EntityInspector/SceneInspector/Layout/ModeAdvanced/ModeAdvanced.tsx` | Component with the bug |
| `packages/inspector/src/components/EntityInspector/SceneInspector/Layout/ModeAdvanced/types.ts` | Props type — `disabled: boolean` already declared |
| `packages/inspector/src/components/EntityInspector/SceneInspector/Layout/Layout.tsx` | Parent — passes `disabled={!!gridError}` |
| `packages/inspector/src/components/EntityInspector/SceneInspector/Layout/ModeAdvanced/ModeAdvanced.spec.tsx` | New test file (to be created) |

## Proposed Changes

- [ ] **Fix 1:** Destructure `disabled` prop (as `isDisabled`) and include it in the disabled check.
- [ ] **Fix 2:** Add `hasNoChanges` detection: `coords === value.coords && base === value.base`.
- [ ] **Fix 3:** Combine all three conditions: `isDisabled || !coords.length || !base.length || hasNoChanges`.
- [ ] **Fix 4:** Fix `useCallback` dependency arrays — remove unused `coords`, `base`, `value` from handler deps; add `onSubmit` to `handleSubmit` deps.
- [ ] **Test:** Write `ModeAdvanced.spec.tsx` covering:
  - Confirm enabled when values changed and fields non-empty
  - Confirm disabled when no changes (values match original)
  - Confirm disabled when either field is empty
  - Confirm disabled when `disabled` prop is `true`

## Acceptance Criteria

- Confirm button is disabled when `coords` and `base` match the original `value` prop
- Confirm button is disabled when either field is empty
- Confirm button is disabled when `disabled` prop is `true` (grid error from parent)
- Confirm button is enabled when user has made valid changes

## Build / Test Commands

```bash
# From /packages/inspector
npm run build
npm test
```
