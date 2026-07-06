/**
 * PB serializer-safe baseline for freshly-created UI render components.
 *
 * The generated CRDT encoder walks `repeated` / required fields unconditionally —
 * `core::UiBackground.uvs` in particular crashes the serializer if absent
 * ("message.uvs is not iterable"). The default UV winding is documented in
 * `ui_background.proto` as `[0,0,0,1,1,0,1,0]`.
 *
 * These are the intent-neutral fields BOTH callers that create a UI component write
 * identically: the property panel (adding a component to an existing node) and
 * node creation (`add-ui-node`). Each spreads this baseline, then overrides the
 * *visual* fields it actually cares about (background color, input placeholder,
 * dropdown options) — those defaults diverge by design and stay at the call site.
 * Keep ONLY the shared, neutral fields here so the serializer-safety contract lives
 * in one place.
 */
export const UI_REQUIRED_FIELD_DEFAULTS: Record<string, Record<string, unknown>> = {
  'core::UiBackground': {
    textureMode: 2, // BackgroundTextureMode.STRETCH — the most common case (nine-slices needs slice tuning)
    uvs: [0, 0, 0, 1, 1, 0, 1, 0],
  },
  'core::UiInput': {
    disabled: false,
  },
  'core::UiDropdown': {
    acceptEmpty: false,
    disabled: false,
    selectedIndex: 0,
  },
};
