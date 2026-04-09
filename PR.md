# Named Callback Props for UI Editor Event Handlers

## Why

The UI editor generates static `.tsx` files with `@dcl/react-ecs` components, but until now there was no way to wire up behavior — users had to manually edit the generated file to add `onMouseDown`, `onChange`, etc. This breaks the "generated file is read-only" contract and creates merge conflicts whenever the UI is re-saved.

This change lets users assign named callback props to elements directly in the property panel. The codegen produces a typed component interface so behavior is wired up from scene code, not inside the generated file.

## What changed

### New types and data model (`types.ts`, `element-defaults.ts`)

- Added `UiEventsData` — six string fields (`onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`, `onChange`, `onSubmit`), each holding a user-defined prop name or empty string.
- Added `ELEMENT_EVENT_SUPPORT` — a data-driven map that defines which events each element type supports and their TypeScript callback signatures. This is the single source of truth consumed by the property panel, codegen, and integration code.
- Added `events` field to `UiElementNode` with `DEFAULT_EVENTS` (all empty strings).

### Redux (`redux/ui-editor/index.ts`)

- Added `updateElementEvents` reducer following the existing `updateElementBackground` pattern: shallow-merges partial events, pushes undo, sets dirty.

### Property panel (`UiEventsSection.tsx`, `UiPropertyPanel.tsx`)

- New `UiEventsSection` component renders a collapsed "Events" section with text fields for each supported event on the selected element type.
- Dynamically shows/hides based on `ELEMENT_EVENT_SUPPORT` — Labels get no section, Buttons get mouse events, Inputs get onChange/onSubmit, etc.
- Validates prop names: must be a valid JS identifier and unique across all elements in the document.

### Codegen (`generate-tsx.ts`)

- `collectEventProps(doc)` scans all elements and collects non-empty event prop names with their signatures.
- If any event props exist, generates a `Props` interface with each prop as optional and the correct type signature, and changes the function signature to destructure from the typed props.
- `renderEventProps(el)` appends JSX attributes like `onMouseDown={propName}` to each element's output.
- If no event props are defined, the output is identical to before (no interface, no-args function).

### File operations (`file-operations.ts`)

- `loadUiDocument` backfills `events: DEFAULT_EVENTS` on any element missing the field, so existing `.ui.json` files load without errors.
- `getIntegrationCode` now shows stub callbacks in the usage example when event props are present, e.g. `onBuyClick={() => console.log('onBuyClick')}`.

## How to verify

1. Open the UI editor, select a **Button** — the "Events" section appears (collapsed) with fields for onMouseDown, onMouseUp, onMouseEnter, onMouseLeave.
2. Select an **Input** — shows onChange, onSubmit fields.
3. Select a **Label** — no Events section appears.
4. Type `onBuyClick` in the Button's onMouseDown field — save and check the generated `.tsx` has the interface + typed prop + JSX attribute.
5. Type the same prop name on a different element — validation error appears on the TextField.
6. Undo (Ctrl+Z) after editing an event name — reverts correctly.
7. Load an existing `.ui.json` created before this feature — no errors, events default to empty.

## Files changed

| File | Change |
| --- | --- |
| `packages/inspector/src/components/UiEditor/types.ts` | Added `UiEventsData`, `EventSignature`, `SdkEventName`, `ELEMENT_EVENT_SUPPORT`; added `events` to `UiElementNode` |
| `packages/inspector/src/components/UiEditor/element-defaults.ts` | Added `DEFAULT_EVENTS`; included in `createDefaultElement` and `createDefaultDocument` |
| `packages/inspector/src/redux/ui-editor/index.ts` | Added `updateElementEvents` reducer and export |
| `packages/inspector/src/components/UiEditor/UiPropertyPanel/UiEventsSection.tsx` | **New file** — Events property panel section |
| `packages/inspector/src/components/UiEditor/UiPropertyPanel/UiPropertyPanel.tsx` | Imported and rendered `<UiEventsSection>` |
| `packages/inspector/src/components/UiEditor/codegen/generate-tsx.ts` | Added `renderEventProps`, `collectEventProps`; updated `generateTsx` for interface + typed signature |
| `packages/inspector/src/components/UiEditor/file-operations.ts` | Backward-compat backfill in `loadUiDocument`; event props in `getIntegrationCode` |
| `docs/solutions/feature-implementation/ui-editor-event-handlers.md` | **New file** — Feature documentation |
