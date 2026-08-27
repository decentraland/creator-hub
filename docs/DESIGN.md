# Inspector Design System

The visual language for the **`@dcl/inspector`** web UI (the Babylon.js scene inspector and its panels, including the UI Designer). It is the reference for every color, spacing, focus, and motion decision in inspector `.css`/`.tsx`.

**Scope.** This documents the _inspector_. The creator-hub Electron shell renders the inspector inside an `<iframe>` and uses `decentraland-ui2` (MUI) for its _own_ chrome — a separate system with its own theme that cannot cross the iframe boundary. Do not import ui2 tokens here, and do not apply this file to creator-hub renderer code.

**Not our brand kit.** Anthropic brand assets (Poppins/Lora, orange `#d97757`, etc.) and the `brand-guidelines` skill do **not** apply to this codebase. The inspector's brand is Decentraland: pink `--primary-main #ff2d55`, the cyan UI-Designer accent, and Inter.

---

## Where tokens live

All tokens are CSS custom properties on `:root` in **`packages/inspector/src/theme/vars.css`**, loaded with `theme/index.css` (fonts + a few resets). Several tokens pass through VS Code webview variables (`--vscode-*`) with a fallback, so the inspector adopts the host editor theme when embedded there.

**The one rule:** style with these tokens. Do not introduce new hardcoded hex/`rgba()` in inspector CSS — if a needed color isn't a token, add a token.

---

## Palette by role

### Surfaces (backgrounds)

| Token | Value | Use |
| --- | --- | --- |
| `--main-bg-color` | `--vscode-editor-background` → `--background` | App/editor background |
| `--tree-bg-color` | `--base-20` `#161518` | Panels, trees, **dropdown/popover surfaces** |
| `--modal-content-bg-color` | `--tree-bg-color` | Modals |
| `--ui-designer-panel-bg` | `--base-19` `#242129` | UI Designer panel frame (Figma `#25212a`, within 1/255) |
| `--ui-designer-control-bg` | `#35333b` | Inputs/selects/textarea chrome, and UI Designer menus |
| `--disabled-bg-color` | `#323036` | Disabled control fill |

### Foreground (text)

| Token            | Value       | Use                               |
| ---------------- | ----------- | --------------------------------- |
| `--title`        | `#eeeeef`   | Primary text **on dark surfaces** |
| `--sub-text`     | `#ffffffcf` | Secondary text on dark            |
| `--text-primary` | `#000000de` | Text **on light surfaces**        |

The UI Designer names its own three steps, from the Figma's Neutrals ramp: `--ui-designer-text` `#fcfcfc` (labels, group titles), `--ui-designer-text-value` `#cfcdd4` (the value inside a field), `--ui-designer-text-muted` `#a09ba8` (hints, secondary). Glyphs take `--ui-designer-glyph` `#716b7c`, or `--ui-designer-glyph-on-control` when they sit on a field fill instead of the frame — see the contrast note in `vars.css`.

`UIDesigner.css` repoints `--gray-0`, `--title` and `--sub-text` to those tokens **inside** `.ui-designer` / the two rails, so every shared control in the designer takes the design's surface and foreground without per-selector overrides. The 3D EntityInspector keeps the global values.

There is no single `--text` token — pick the foreground that matches the surface. **Never rely on `color: inherit` for a control on a themed surface** (that is exactly how the white-on-white callback autocomplete happened); set an explicit foreground.

### Borders, focus & accent

| Token | Value | Use |
| --- | --- | --- |
| `--ui-designer-control-border` | `rgba(255,255,255,.1)` | Control borders (Figma White 10) |
| `--ui-designer-hairline` | `rgba(255,255,255,.07)` | Subtle dividers |
| `--border-focused` | `#127fd4` | Focus ring (VS Code blue) |
| `--ui-designer-accent` | `rgb(80,200,255)` | **Canvas** selection cyan |
| `--ui-designer-accent-80/-40/-12/-08/-05` | cyan @ .8/.4/.12/.08/.05 | Canvas hover/selection fills, drop targets |
| `--ui-designer-control-accent` | `#63b4f6` | **Panel** focus rings, the Anchor pin, bind affordances, selected rows |
| `--ui-designer-control-accent-62/-21/-15` | blue @ .62/.21/.15 | Panel hover borders and fills |
| `--ui-designer-control-hover-bg` | `rgba(255,255,255,.06)` | Hover fill on a segmented cell |
| `--ui-designer-control-selected-bg` | `rgba(255,255,255,.1)` | Hover/selected fill on a menu **row** |
| `--ui-designer-control-active-bg` | `#63b4f6` (→ accent) | Fill of a selected/active **toggle** |
| `--ui-designer-control-active-fg` | `#35333b` Charcoal | Glyph sitting on that accent fill |

#### Selected and active toggles are accent-blue

Per the 08/26 Figma states matrix, a selected or active toggle takes a solid accent-blue fill with a dark Charcoal glyph — one treatment for both the segmented cells (Flow direction, Text alignment, Fill mode) and the standalone toggles (Flow wrap, the aspect lock). A checkbox is separate and carries its state on the tick alone (see `--ui-designer-checkbox-border`).

- **Selected/active toggle:** `--ui-designer-control-active-bg` (accent-blue) fill with a `--ui-designer-control-active-fg` (Charcoal) glyph.
- **Hover:** a faint `--ui-designer-control-hover-bg` white tint, never the accent.

| Pairing                              | Contrast  |
| ------------------------------------ | --------- |
| Charcoal glyph on the accent fill    | **5.6:1** |
| Accent fill vs. the card (`#242129`) | **7.1:1** |

A white glyph is deliberately **not** used on the accent fill — it lands ~2.2:1, below the 3:1 non-text minimum — so the glyph is Charcoal. Selection reads as a hue-and-luminance jump, never hue alone. Keep the Charcoal glyph if the fill value moves.

Two assets ignore `color` because their white is baked in: the checkbox tick (a data-URI SVG with `fill="white"`) and the indeterminate dash (a solid block). Both are re-declared dark in `PropertyPanel.css`, scoped `:not(.disabled)` so the shared disabled styling still wins the specificity tie.

#### ⚠️ Two accents, and which one you want depends on what it sits on

The UI Designer has **two** accent families. Picking the wrong one is a real bug, not a style preference:

- **Canvas → cyan.** The canvas renders the _author's own UI_ in arbitrary colours. A selection ring in a brand colour disappears the moment they use that colour themselves — and `#ff2d55` is precisely what the palette encourages. Because the backdrop is unknowable, WCAG 1.4.11's ≥3:1 cannot be verified against it; a hue authors are unlikely to pick is the mitigation. Use for node selection/hover, resize handles, drop targets, reorder indicators.
- **Panel → blue `#63b4f6`.** Panel chrome always sits on `--base-20` (`#161518`), a surface we control, so contrast is fixed and testable. Use for focus rings, active tab underlines, hover borders/fills, bind affordances, selected rows, selected/active toggle fills (with a Charcoal glyph — see above), and the Anchor row's pinned edge.

  **Panel chrome is deliberately not pink.** `--primary-main` is reserved for CTAs and main buttons (`.Button.danger`, the event/variable menu `ADD` confirm). A panel control painted with it competes with the one thing on screen that should read as the action.

**Do not copy alpha steps between the two families.** The panel blue's relative luminance is `0.419` against cyan's `0.502`, so the same alpha composites differently. The steps are solved for this surface and named for their true alpha (`-62`, not `-40`) so nothing lies:

| Step  | Contrast on `#161518`                               | Role                         |
| ----- | --------------------------------------------------- | ---------------------------- |
| base  | **8.13:1** — clears ≥3:1 non-text _and_ ≥4.5:1 text | Rings, active borders, icons |
| `-62` | 3.87:1 (vs 1.41:1 resting border) — clears ≥3:1     | Hover / selected borders     |
| `-21` | 1.47:1 · Snow on it 12.03:1                         | Menu / selected row fill     |
| `-15` | 1.30:1                                              | Hover fill                   |

Adding a step means solving for its contrast, not guessing an alpha.

### DCL brand & status

| Token | Value | Use |
| --- | --- | --- |
| `--primary-main` / `--primary-dark` | `#ff2d55` / `#f70038` | Brand pink — **CTAs and main buttons only**, plus the "armed/active tool" signal. Not for panel chrome (that's `--ui-designer-control-accent`); don't use it for field errors. |
| `--secondary-main` | `#ff7439` | Brand orange |
| `--success-main` / `--error-main` / `--warning-main` | `#4caf50` / `#f44336` / `#ffc95b` | Status |

---

## ⚠️ The neutral ramp runs LIGHT → DARK

`--base-01 … --base-21` go **light to dark**:

```
--base-01 #ffffff   (lightest)
--base-02 #f0f0f0
--base-06 #ccc
--base-10 #808080
--base-12 #606060
--base-20 #161518
--base-21 #000       (darkest)
```

**Low indices are LIGHT.** This is the #1 source of "dark fallback that renders light" bugs: a rule like `background: var(--base-02, #1e1e22)` looks dark (the `#1e1e22` fallback is a decoy) but actually renders near-white, because `--base-02` resolves to `#f0f0f0`. Read the token's real value, not the fallback.

### Correct dark-surface pairing (dropdowns, popovers, suggestion lists)

```css
.some-dark-surface {
  background: var(--ui-designer-control-bg); /* the raised UI Designer menu surface */
  border: 1px solid var(--ui-designer-control-border);
  color: var(--ui-designer-text); /* explicit light fg, NOT inherit */
}
.some-dark-surface .row:hover,
.some-dark-surface .row[aria-selected='true'] {
  background: var(--ui-designer-control-accent-21); /* panel surface → blue */
}
.some-dark-surface :focus-visible {
  outline: 2px solid var(--border-focused);
  outline-offset: -1px;
}
```

`VariablePicker.css` is the canonical example.

---

## Spacing & sizing

4px scale — use it instead of ad-hoc px:

`--uid-space-1: 4px` · `2: 8px` · `3: 12px` · `4: 16px` · `5: 20px` · `6: 24px`

Give interactive controls a consistent height (define a local `--uid-control-height`, ~28px, per panel) so rows align. Interactive hit targets should be ≥24px.

Corners in the UI Designer come from two tokens, `--ui-designer-radius-field` (6px — inputs, dropdowns, segmented cells, the anchor preview) and `--ui-designer-radius-menu` (12px — option lists and popovers). The shared components hardcode 4px, so a panel-scoped override applies them.

## Fonts

`--font-family` → **Inter** (system-ui fallbacks). `--font-monospace` → **Inconsolata** (code/callback editors). Use `font-variant-numeric: tabular-nums` for numeric readouts (zoom %, counters).

---

## Component & CSS conventions

Derived from the Vercel Web Interface Guidelines (`web-design-guidelines` skill) and applied throughout the inspector:

- **Focus:** every interactive element has a visible `:focus-visible` ring — `--border-focused` or `--ui-designer-control-accent` in panels, `--ui-designer-accent` on the canvas. Prefer `:focus-visible` over `:focus`. **Never** `outline: none` without a replacement ring.
- **Contrast (WCAG AA):** text ≥ **4.5:1**, non-text/UI (borders, focus rings, canvas markers, icons) ≥ **3:1** against their background.
- **ARIA/semantics:** icon-only buttons need `aria-label`; use `<button>` for actions and `<a>`/`<Link>` for navigation (never `<div onClick>`); tie every input to a `<label>` or `aria-label`; async updates use `aria-live="polite"`.
- **Motion:** honor `prefers-reduced-motion` (reduced/none variant); animate only `transform`/`opacity`; **never** `transition: all` — list properties.
- **During drag:** `user-select: none` + `touch-action: manipulation`.
- **Content:** truncate/clamp long text (flex children need `min-width: 0`); handle empty states; placeholders end with `…`.
- **Color:** tokens only — no new hardcoded hex.
- **A background on a `<Box>` root does nothing.** `Box.css` paints `--main-bg-color` on the `.content` div it wraps children in, which covers the root. Put panel surfaces on `<yourClass> > .content`.
- **Pickers and bound values.** Popover pickers (event, variable) are a raised `--ui-designer-control-bg` card at the 12px menu radius: rows highlight on `--ui-designer-control-accent-21`, the selected row carries a leading checkmark, and a diamond-plus `Add New …` row reveals a `Description` field and an auto-width `--primary-main` `ADD` confirm (dimmed to 40% until the name is valid). Event fields are horizontal — a left label and a full-width rounded pill: `--ui-designer-control-bg` when a handler is bound (with the name and an inline clear) and a fainter fill reading `Bind an event handler` in `--ui-designer-text-muted` when empty. The pill is neutral, not accent — an event is not a bound-variable field.

Reviewing UI against these? Run the `web-design-guidelines` skill over the changed files.

---

## Related standards

- [`coding-standards.md`](./coding-standards.md) — React patterns (controlled-input prop-sync, memoized components).
- [`testing-standards.md`](./testing-standards.md) — E2E/Playwright patterns.
