---
title: Fix: DebugConsole text copy (Ctrl+C / Cmd+C blocked by global hotkey)
type: fix
date: 2026-03-31
---

# Fix: DebugConsole text copy (Ctrl+C / Cmd+C blocked by global hotkey)

Users can select text in the Creator Hub's embedded DebugConsole, but Ctrl+C / Cmd+C does not copy
it to the clipboard. The native browser copy action is cancelled by the Inspector's global `COPY`
hotkey handler before it can execute.

## Root Cause Analysis

`useHotkey` in `packages/inspector/src/hooks/useHotkey.ts` registers hotkeys via `hotkeys-js` and
**always** calls `event.preventDefault()` before invoking the callback:

```ts
hotkeys(formattedKeys, { element: targetDocument }, (event, handler) => {
  event.preventDefault();          // ← unconditional
  callbackRef.current(event, handler);
});
```

In `Renderer.tsx:186`, the COPY hotkeys are registered on `document.body` (bubble phase):

```ts
useHotkey([COPY, COPY_ALT], copySelectedEntities, document.body);
```

`hotkeys-js`'s built-in `filter` only exempts `<input>`, `<textarea>`, `<select>`, and
`contentEditable` elements — not plain `div`s. So when the user presses Ctrl+C while text is
selected in `.DebugConsole-logs`, the hotkey fires, calls `preventDefault()`, and kills native copy.

No other handler intercepts Ctrl+C (the `PlayerTree` capture-phase listener only handles
Delete / Backspace / Ctrl+D).

## Relevant Files

- `packages/inspector/src/hooks/useHotkey.ts` — hook wrapping hotkeys-js; unconditional preventDefault
- `packages/inspector/src/components/Renderer/Renderer.tsx:186` — registers COPY/COPY_ALT hotkeys
- `packages/inspector/src/components/Assets/DebugConsole.tsx` — the affected console component
- `packages/inspector/src/components/Assets/DebugConsole.css` — styles (no user-select issue)
- `packages/inspector/src/components/Assets/Assets.tsx` — tab container, embeds DebugConsole

## Institutional Learnings

- No prior docs/solutions entries for this domain.
- `e.stopPropagation()` on a React synthetic event does NOT stop native DOM listeners (like
  hotkeys-js); `e.nativeEvent.stopImmediatePropagation()` would be needed for that approach.
- hotkeys-js listens in bubble phase on `document.body`, so a `shouldSkip` predicate checked
  BEFORE `preventDefault()` is the cleanest intercept point.

## User Flows & Edge Cases

**Happy path**: User runs a scene → DebugConsole shows error → user selects text → presses
Ctrl+C → text is copied to clipboard.

**Edge cases**:
- Selecting text in DebugConsole and pressing Ctrl+C should NOT trigger entity copy
- Pressing Ctrl+C when no text is selected (and entities are selected in the 3D canvas) should
  still copy entities
- macOS Cmd+C and Windows/Linux Ctrl+C must both work
- Predicate must not break when `event.target` is null / not an Element

## Proposed Changes

- [ ] **`useHotkey.ts`**: Add optional 4th param `shouldSkip?: (event: KeyboardEvent) => boolean`.
      If it returns `true`, bail BEFORE calling `event.preventDefault()` and the callback.
- [ ] **`Renderer.tsx`**: Pass `shouldSkip` to the `useHotkey([COPY, COPY_ALT], …)` call so that
      when the event target is inside `.DebugConsole-logs`, the hotkey is skipped.
- [ ] **`useHotkey.spec.ts`** (new file): Unit tests verifying that `shouldSkip` prevents both
      `preventDefault()` and the callback when the predicate returns `true`, and that normal
      hotkey behaviour is unchanged when it returns `false`.

## Acceptance Criteria

- [ ] Selecting text in the DebugConsole and pressing Ctrl+C / Cmd+C copies the text to the clipboard
- [ ] Pressing Ctrl+C without any text selected still copies selected 3D entities (entity copy
      behaviour is unchanged)
- [ ] `useHotkey` unit tests pass for both the skip and non-skip paths
- [ ] `npm run test` (inspector), `make typecheck`, `make lint` all pass

## Build & Test Commands

```bash
# From packages/inspector
npm run test           # vitest unit tests
npm run typecheck      # tsc type check

# From repo root
make lint              # ESLint all packages
make typecheck         # TypeScript all workspaces
make test              # Unit tests all packages
```

## References

- Similar implementation: `packages/inspector/src/hooks/useHotkey.ts`
- Root-cause hotkey registration: `packages/inspector/src/components/Renderer/Renderer.tsx:186`
