---
title: UI Editor Named Callback Props for Event Handlers
category: feature-implementation
tags: [ui-editor, codegen, react-ecs, events, property-panel, tsx-generation]
components: [UiEventsSection, UiPropertyPanel, generate-tsx, file-operations, ui-editor redux slice]
branch: feat/ui-editor-event-handlers
date: 2026-03-01
status: completed
---

# UI Editor Named Callback Props for Event Handlers

Users can assign named callback props to UI elements in the property panel. The codegen produces a typed React component that accepts those callbacks as props, so users wire up behavior from their scene code without editing the generated `.tsx` file.

**Example generated output:**

```tsx
interface MyUIProps {
  onBuyButtonMouseDown?: () => void
  onSearchInputSubmit?: (value: string) => void
}

export function MyUI({ onBuyButtonMouseDown, onSearchInputSubmit }: MyUIProps) {
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
      <Button value="Buy" onMouseDown={onBuyButtonMouseDown} />
      <Input placeholder="Search..." onSubmit={onSearchInputSubmit} />
    </UiEntity>
  )
}
```

---

## Key Architectural Decisions

### Event support is data-driven, not hardcoded per component

A single `ELEMENT_EVENT_SUPPORT` map in `types.ts` defines which events each element type supports and their TypeScript signatures. Every consumer — the property panel, the codegen, the integration code helper — reads from this one map.

**Why:** Adding a new element type or event requires a single map entry. No switch statements to update across files. The map is the source of truth for what the SDK supports per component.

**Impact:** The property panel dynamically shows/hides event fields based on this map. Label elements show no Events section. If `@dcl/react-ecs` adds new events to a component, support is a one-line map change.

### Event names are user-defined strings, not auto-generated

Users type a custom prop name (e.g. `onBuyClick`) into a text field rather than getting an auto-generated name. Empty strings mean "no event handler."

**Why:** Auto-generated names like `onButton1MouseDown` are meaningless in scene code. Letting users name their callbacks produces a clean, self-documenting component interface. Empty-by-default means no interface is emitted for documents that don't use events — zero noise for existing workflows.

### The generated file stays read-only; behavior lives in scene code

The `.tsx` file declares callback props as optional in the interface. The user's scene code passes the actual implementations when rendering the component.

**Why:** This preserves the current contract where the UI editor owns the generated file. Users never need to merge hand-written code with regenerated output. The integration code snippet (`getIntegrationCode`) shows stub callbacks so users know exactly what to pass.

---

## SDK Event Support Per Element Type

| Component | onChange | onSubmit | onMouseDown | onMouseUp | onMouseEnter | onMouseLeave |
|-----------|---------|----------|-------------|-----------|--------------|--------------|
| Container | - | - | `() => void` | `() => void` | `() => void` | `() => void` |
| Label | - | - | - | - | - | - |
| Button | - | - | `() => void` | `() => void` | `() => void` | `() => void` |
| Input | `(value: string) => void` | `(value: string) => void` | - | - | - | - |
| Dropdown | `(value: number) => void` | - | `() => void` | `() => void` | `() => void` | `() => void` |

---

## Data Flow: Property Panel to Generated Code

```
User types "onBuyClick" in Button's onMouseDown field
  → UiEventsSection dispatches updateElementEvents({ elementId, events: { onMouseDown: 'onBuyClick' } })
  → Redux reducer shallow-merges into el.events, pushes undo, sets dirty
  → On save: generateTsx() reads document
    → collectEventProps() scans all elements, finds { onBuyClick: '() => void' }
    → Emits interface block + typed function signature
    → renderEventProps(el) emits onMouseDown={onBuyClick} on the <Button>
  → getIntegrationCode() shows: <MyUI onBuyClick={() => console.log('onBuyClick')} />
```

---

## Validation

`UiEventsSection` validates prop names on every keystroke:

1. **Valid JS identifier** — must match `/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`
2. **Cross-element uniqueness** — scans all other elements' event prop names via `useMemo`. A prop name used by another element shows an error.

Empty values pass validation (they mean "no handler assigned").

---

## Backward Compatibility

`loadUiDocument` backfills `events: { onMouseDown: '', onMouseUp: '', onMouseEnter: '', onMouseLeave: '', onChange: '', onSubmit: '' }` on any element missing the `events` field. Existing `.ui.json` files load without errors and behave identically — no events are emitted in the generated code until the user explicitly assigns prop names.

---

## Key Files

| File | Role |
| --- | --- |
| `UiEditor/types.ts` | `UiEventsData` interface, `ELEMENT_EVENT_SUPPORT` map, `EventSignature` / `SdkEventName` types |
| `UiEditor/element-defaults.ts` | `DEFAULT_EVENTS` constant, included in `createDefaultElement` and `createDefaultDocument` |
| `redux/ui-editor/index.ts` | `updateElementEvents` reducer (shallow merge, undo, dirty) |
| `UiPropertyPanel/UiEventsSection.tsx` | Property panel section: dynamic fields per element type, validation |
| `UiPropertyPanel/UiPropertyPanel.tsx` | Renders `<UiEventsSection>` after type-specific sections |
| `codegen/generate-tsx.ts` | `renderEventProps`, `collectEventProps`, interface + typed signature generation |
| `UiEditor/file-operations.ts` | `loadUiDocument` backfill, `getIntegrationCode` stub callbacks |

---

## Known Risks / Watch Points

- **Prop name collisions across documents:** Validation only checks uniqueness within a single document. If two UI documents are used in the same scene file, the user must avoid collisions manually. This matches how component names already work.
- **SDK event signature changes:** If `@dcl/react-ecs` changes a callback signature (e.g. `Dropdown.onChange` takes an object instead of a number), the `ELEMENT_EVENT_SUPPORT` map must be updated. Generated files from before the change would have stale signatures.
