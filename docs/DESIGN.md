# Creator Hub & Inspector Design System

The visual language for the two UIs in this repo: the **`@dcl/inspector`** web UI (the Babylon.js scene inspector and its panels, including the UI Designer) and the **Creator Hub** Electron renderer around it. It's the reference for every color, spacing, focus, and motion decision in their `.css`/`.tsx`.

**Scope: two systems, one boundary.** Creator Hub renders the inspector inside an `<iframe>`, and no token crosses that boundary. Inspector code uses only the `vars.css` tokens documented in most of this file. Creator Hub renderer code uses only `decentraland-ui2` and `theme.css` ([Creator Hub (renderer)](#creator-hub-renderer)). Don't import ui2 tokens into the inspector, and don't apply `vars.css` to Creator Hub.

**Not our brand kit.** Anthropic brand assets (Poppins/Lora, orange `#d97757`, etc.) and the `brand-guidelines` skill do **not** apply to this codebase. The inspector's brand is Decentraland: pink `--primary-main #ff2d55`, the cyan UI-Designer accent, and Inter.

---

## Figma source

Both UIs are specified in one Figma file, **📗️ Design System | Creator Tools** (file key `5ecKgNHjChZEe05LUwKGku`). [Node `20420:50646`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20420-50646) is its COVER page. Tokens live on the pages under **Tokens** (Colors, Typography, Tags / Labels); components and screens live on the section pages, so start from the frame URL for the surface you're changing. A page whose name contains `🟡 Outdated` is superseded: don't pull from it.

Read `.ai/skills/figma/SKILL.md` before pulling a frame. It covers the Figma MCP, the Claude-in-Chrome fallback when the MCP's call cap is hit, and syncing palette changes back into this file.

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
| `--ui-designer-panel-bg` | `--base-19` `#242129` | UI Designer panel frame (Figma Neutrals/Charcoal `#25212a`, within 1/255) |
| `--ui-designer-control-bg` | `#35333b` | Inputs/selects/textarea chrome, and UI Designer menus (Figma Neutrals/Onix) |
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
| `--ui-designer-control-active-fg` | `#35333b` Onix | Glyph sitting on that accent fill |

Figma's Neutrals swatches name `#35333b` **Onix** and `#25212a` **Charcoal**. The `vars.css` comments call `#35333b` Charcoal; read "Charcoal" there as Onix until the comments are refreshed.

#### Selected and active toggles are accent-blue

Per the 08/26 Figma states matrix, a selected or active toggle takes a solid accent-blue fill with a dark Onix glyph — one treatment for both the segmented cells (Flow direction, Text alignment, Fill mode) and the standalone toggles (Flow wrap, the aspect lock). A checkbox is separate and carries its state on the tick alone (see `--ui-designer-checkbox-border`).

- **Selected/active toggle:** `--ui-designer-control-active-bg` (accent-blue) fill with a `--ui-designer-control-active-fg` (Onix) glyph.
- **Hover:** a faint `--ui-designer-control-hover-bg` white tint, never the accent.

| Pairing                              | Contrast  |
| ------------------------------------ | --------- |
| Onix glyph on the accent fill        | **5.6:1** |
| Accent fill vs. the card (`#242129`) | **7.1:1** |

A white glyph is deliberately **not** used on the accent fill — it lands ~2.2:1, below the 3:1 non-text minimum — so the glyph is Onix. Selection reads as a hue-and-luminance jump, never hue alone. Keep the Onix glyph if the fill value moves.

Two assets ignore `color` because their white is baked in: the checkbox tick (a data-URI SVG with `fill="white"`) and the indeterminate dash (a solid block). Both are re-declared dark in `PropertyPanel.css`, scoped `:not(.disabled)` so the shared disabled styling still wins the specificity tie.

#### ⚠️ Two accents, and which one you want depends on what it sits on

The UI Designer has **two** accent families. Picking the wrong one is a real bug, not a style preference:

- **Canvas → cyan.** The canvas renders the _author's own UI_ in arbitrary colours. A selection ring in a brand colour disappears the moment they use that colour themselves — and `#ff2d55` is precisely what the palette encourages. Because the backdrop is unknowable, WCAG 1.4.11's ≥3:1 cannot be verified against it; a hue authors are unlikely to pick is the mitigation. Use for node selection/hover, resize handles, drop targets, reorder indicators.
- **Panel → blue `#63b4f6`.** Panel chrome always sits on `--base-20` (`#161518`), a surface we control, so contrast is fixed and testable. Use for focus rings, active tab underlines, hover borders/fills, bind affordances, selected rows, selected/active toggle fills (with an Onix glyph — see above), and the Anchor row's pinned edge. It is Figma's System/Blue Light 1.

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

## Typography

`--font-family` → **Inter** (system-ui fallbacks), the only family on Figma's Typography page. `--font-monospace` → **Inconsolata** (code/callback editors) has no Figma counterpart and is an intentional deviation. Use `font-variant-numeric: tabular-nums` for numeric readouts (zoom %, counters). Both worlds declare the same two font tokens, each in its own file.

Figma's Font frame assigns weights by role: **titles** Inter Bold (700), **titles and buttons** Inter Semi Bold (600), **descriptions** Inter Regular (400).

### Type scale

From the Typography page's Size frame ([node `20717:350`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20717-350)), labelled "Perfect Fourth (1,5)". Every step is Inter, line-height 100% (the 48px rows use Figma's `normal`), letter-spacing 0. Neither token file declares a size or weight token, so every size below is a literal in component CSS or an MUI `variant` today; the proposed tokens are listed in the handoff, not here.

| Figma style | Size | Weight | Note |
| --- | --- | --- | --- |
| H1 Semi / H1 Regular (display) | 48px | 600 / 400 | Local styles only, not variables |
| `H1 Semi` | 30px | 600 |  |
| `H2 Semi` | 24px | 600 |  |
| `H3 Semi` | 22px | 600 |  |
| `H4 Semi` | 20px | 600 |  |
| `H5 Semi` / `H5 Regular` | 18px | 600 / 400 |  |
| `H6 Semi Caps` / `H6 Semi` / `H6 Regular` | 16px | 600 / 600 / 400 | Caps = uppercase |
| `H7 Bold Caps` / `H7 Semi Caps` / `H7 Semi` / `H7 Regular` | 14px | 700 / 600 / 600 / 400 | Caps = uppercase |
| `H8 Semi` / `H8 Regular` | 12px | 600 / 400 |  |

Two text styles live outside the scale and carry MUI-style metrics: `Body/Body - 14` (14px, 400, line-height 1.43, letter-spacing 0.17px) and `Other/Overline` (12px, 400, line-height 2.66, letter-spacing 1px, uppercase). They are MUI's default `body2` and `overline` metrics, which ui2 keeps (its `theme/typography.js` only sets the family), so Creator Hub takes them from the `Typography` variant rather than declaring them.

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

## Creator Hub (renderer)

Creator Hub's own chrome (home, scenes list, editor shell, settings, and modals) is styled by MUI through `decentraland-ui2`, plus a small set of CSS variables. The focus, contrast, ARIA, and motion rules in [Component & CSS conventions](#component--css-conventions) apply here too. The tokens don't.

### Creator Hub token sources

- **Theme:** `ThemeProvider theme={dark}` from `decentraland-ui2/dist/theme`, set in `packages/creator-hub/renderer/src/index.tsx`. Inside styled components, read palette, spacing, typography, and breakpoints from `theme`.
- **CSS variables:** `:root` in `packages/creator-hub/renderer/src/themes/theme.css`, for plain CSS and values the ui2 theme doesn't cover.

### `theme.css` by role

| Role | Tokens |
| --- | --- |
| Surfaces | `--bg` `#16141a`, `--background` `#18141a`, `--card` / `--modal` / `--secondary` `#242129`, `--darker-gray` `#242129`, `--toast` `#3d3b43`, `--dimmer` `#000000dd` |
| Text | `--text` `#ffffff`, `--text-on-secondary` `#ffffffb2`, `--secondary-text` `#676370`, `--dcl-silver` `#a09ba8` |
| Brand and actions | `--primary` / `--dcl` `#ff2d55`, `--primary-hover` `#ff3d61`, `--dcl-hover` `#f70038`, `--dcl-dark` `#9c1c34` |
| Status | `--success` `#34ce77`, `--danger` `#ffa900`, `--error` `#ff0000` |
| Lines | `--divider` `#67637033`, `--text-area-border` `#676370`, `--clear-divider` `#a09ba8` |
| AI assistant | `--ai-selected`, `--ai-menu-bg`, `--ai-input-bg`, `--ai-session-selected` and their `-hover` steps |
| ui2 overrides | `--mui-shape-borderRadius` `6px`, `--mui-palette-action-disabled`, `--mui-palette-secondary-contrast` |

The brand pink matches the inspector's `--primary-main`, but it's defined separately on each side of the iframe. Change both, or neither.

### Conventions

- Styled components follow CLAUDE.md → "Styled Components Conventions": import from `decentraland-ui2`, use object syntax, take values from the theme, and keep them in `Component.styled.ts`.
- Reuse a component the renderer already imports, from `decentraland-ui2` or an existing `@mui/material` import, before you build one. Don't add an import of an MUI module the renderer doesn't use yet. Pulling a not-yet-bundled module into a running dev session retriggers Vite's dependency optimizer. When no imported component fits, hand-roll it, as the settings Accordion is.
- ui2 pins secondary-text buttons to a grey `secondary.contrast` at high specificity. Overriding their color takes a repeated-`&` selector (see `Tabs/AiTab/component.tsx`), not `!important`.

---

## Figma variables → tokens

Reconciled on October 16, 2026 from the Colors page ([node `20752:6024`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20752-6024), frame "Colors Dark" `20755:6429`) with `get_variable_defs` on the frame plus `get_design_context` on the Neutrals, INFO, Transparencies and Gradients columns, whose swatches are not all bound to variables. Status: **match** (same value), **drift** (a token exists for the role but holds another value), **missing** (no token in that world), **deviation** (documented and kept on purpose). A `—` means the world has no token for it and needs none yet. ui2 paths name `decentraland-ui2`'s dark theme (`theme/colorSchemes.js`, `theme/colors.js`).

### Brand and primary

| Figma variable | Value | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) | Status |
| --- | --- | --- | --- | --- |
| Primary/Primary · Brand/Ruby | `#FF2D55` | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` | match |
| Primary/Primary Dark 1 | `#F70038` | `--primary-dark` | `--dcl-hover` · ui2 `palette.primary.dark` | match |
| Primary/Primary Dark 2 | `#D80029` | — | ui2 `colors.primaryDark2` | missing in inspector |
| Primary/Primary Light 1 | `#FF6280` | — | `--primary-hover` `#ff3d61` · ui2 `palette.primary.light` `#F70038` · ui2 `colors.primaryLight1` `#F8919D` | **drift**, three ways: Figma hover pink vs `theme.css` vs ui2 |
| Primary/Primary Light 2 | `#FF93A8` | — | ui2 `colors.primaryLight2` `#FFC9D5` | drift (ui2 upstream) |
| Primary Alt/Primary Alt · Brand/Orange | `#FF7439` | `--secondary-main` | — | match |
| Primary Alt/Primary Alt Dark 1 | `#F45708` | `--secondary-dark` `#e65002` | — | drift |
| Primary Alt/Primary Alt Dark 2 | `#D84900` | — | — | missing |
| Primary Alt/Primary Alt Light 1 | `#FFAD8D` | `--secondary-light` `#ff8d5e` | — | drift |
| Primary Alt/Primary Alt Light 2 | `#FFCDBA` | — | — | missing |
| Brand/Yellow | `#FFC95B` | `--yellow`, `--warning-main` | — | match (`--warning-main` doubles as the status colour, see below) |
| Brand/Melon | `#FFA25A` | `--melon` | — | match |
| Brand/Lavender | `#C640CD` | `--lavender`, `--smart-item-icon-bg-color` | — | match |
| Brand/Violet | `#A524B3` | `--violet` | — | match |
| Brand/Purple | `#691FA9` | `--purple` | `--purple-banner` `#691ea9` | drift (1/255 in Creator Hub) |
| Brand/Flare · Cerise · Amin | gradients: Ruby→Yellow, Ruby→Lavender, Lavender→Purple | — | `--metaverse-gradient` is a different gradient | missing (no consumer yet) |

### Neutrals

The Figma ramp has 13 swatches; 10 are variables and three (Onix, Onix Dark 1, Charcoal) are swatch fills only. ui2 mirrors the ramp as `colors.neutral` (`softWhite`, `gray5…gray0`, `softBlack2`, `softBlack1`).

| Figma | Value | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) | Status |
| --- | --- | --- | --- | --- |
| Neutrals/White | `#FFFFFF` | `--white`, `--base-01` | `--white`, `--text` · ui2 `neutral.white` | match |
| Neutrals/Snow | `#FCFCFC` | `--ui-designer-text` | ui2 `neutral.softWhite` | match |
| Neutrals/Pearl | `#ECEBED` | — | ui2 `neutral.gray5` | missing in inspector |
| Neutrals/Gray | `#CFCDD4` | `--ui-designer-text-value` | ui2 `neutral.gray4` | match |
| Neutrals/Silver | `#A09BA8` | `--ui-designer-text-muted`, `--neutral-grey-3` | `--dcl-silver`, `--clear-divider` · ui2 `neutral.gray3` | match |
| Neutrals/Cloudy Sky | `#716B7C` | `--ui-designer-glyph` | `--dropdown` · ui2 `neutral.gray2` | match |
| Neutrals/Graffito | `#5E5B67` | — | `--light-gray` · ui2 `neutral.gray1` | missing in inspector |
| Neutrals/Pale Black | `#43404A` | `--gray-0` | `--dark-gray` · ui2 `neutral.gray0` | match |
| Onix (swatch) | `#35333B` | `--ui-designer-control-bg`, `--ui-designer-control-active-fg` | — | match |
| Onix Dark 1 (swatch) | `#2D2A33` | — | `--title-bar-button` | missing in inspector |
| Charcoal (swatch) | `#25212A` | `--ui-designer-panel-bg` → `--base-19` `#242129` | `--card`, `--modal`, `--secondary`, `--darker-gray` `#242129` · ui2 `neutral.softBlack2` `#242129` | **deviation**: both worlds follow ui2's `#242129`, 1/255 from Figma; keep |
| Neutrals/Shadow | `#161518` | `--base-20`, `--tree-bg-color` | `--black` · ui2 `neutral.softBlack1` | match; `--bg` `#16141a` and `--background` `#18141a` are near-misses (drift) |
| Neutrals/Black | `#000000` | `--black`, `--base-21` | `--bg-inspector` · ui2 `neutral.black` | match |
| — | `#676370` | `--neutral-grey-4` | `--secondary-text`, `--text-area-border`, `--popup`, and the `#676370xx` alpha family (`--divider`, `--secondary-on-modal`, `--card-on-modal`) | **not in Figma**; nearest is Graffito `#5E5B67` |

The inspector's `--base-02 … --base-18` and `--accent-blue-*` ramps are VS Code's, not Figma's; they predate the design system and are kept for the embedded-webview theme. `--ui-designer-accent` (cyan) is the documented canvas deviation above.

### System (status) and INFO

ui2's dark theme carries Figma's System ramp verbatim (`palette.success` / `.warning` / `.error` / `.info`, each with `main`, `dark` = Dark 1, `light` = Light 1), so Creator Hub reads status colours from the theme. The inspector's status tokens are Material's defaults, not Figma's.

| Figma variable | Value | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) | Status |
| --- | --- | --- | --- | --- |
| System/Green | `#34CE77` | `--success-main` `#4caf50` | `--success` · ui2 `palette.success.main` | drift in inspector |
| System/Green Dark 1 / Light 1 | `#00B453` / `#65D890` | `--success-dark` `#388e3c` / `--success-light` `#66bb6a` | ui2 `palette.success.dark` / `.light` | drift in inspector |
| System/Green Dark 2 / Light 2 | `#00A146` / `#C1EECF` | — | — | missing |
| System/Orange | `#FE9C2A` | `--warning-main` `#ffc95b` (= Brand/Yellow) | `--danger` `#ffa900` · ui2 `palette.warning.main` | drift in both `.css` files |
| System/Orange Dark 1 / Light 1 | `#F38025` / `#FFB95B` | `--warning-dark` `#ef6c00` / — | ui2 `palette.warning.dark` / `.light` | drift in inspector |
| System/Orange Dark 2 / Light 2 | `#EC7122` / `#FFCD88` | — | — | missing |
| System/Red | `#FB3B3B` | `--error-main` `#f44336` | `--error` `#ff0000` · ui2 `palette.error.main` | drift in both `.css` files |
| System/Red Dark 1 / Light 1 | `#EC303A` / `#E97177` | `--error-dark` `#d32f2f` / `--error-light` `#ef5350` | ui2 `palette.error.dark` / `.light` | drift in inspector |
| System/Red Dark 2 / Light 2 | `#CC1D2C` / `#FFCDD4` | — | — | missing |
| Blue (swatch) | `#2196F3` | — | ui2 `palette.info.main` | missing in inspector |
| Blue Dark 1 (swatch) | `#1A75D2` fill; its label reads `#1F87E5` | — | ui2 `palette.info.dark` `#1A75D2` | missing in inspector; the Figma label is stale, the fill is the value |
| Blue Dark 2 (swatch) | `#244B7D` fill; its label reads `#1764C0` | — | `--ai-session-selected` | match on the fill; Figma label stale |
| Blue Dark 3 (swatch) | `#243852` | — | `--ai-session-selected-hover` | match |
| System/Blue Light 1 | `#63B4F6` | `--ui-designer-control-accent` | ui2 `palette.info.light` | match |
| Blue Light 2 (swatch) | `#BBDEFB` | — | — | missing |
| — | `#214272` / `#2E4A7A` | — | `--ai-selected` / `--ai-selected-hover` | not in Figma |
| — | `#127FD4` | `--border-focused` | — | not in Figma (VS Code focus blue); deviation, keep |

### Transparencies

Figma names four steps per base colour, Backdrop 60% · Blurry 40% · Soft 20% · Subtle 10%, plus the component-level `Transparencies/White 10` and `White 20`. The alpha is not in the variable value (`get_variable_defs` returns the opaque hex), so take it from the swatch label.

| Figma | Value | Inspector (`vars.css`) | Creator Hub (`theme.css`) | Status |
| --- | --- | --- | --- | --- |
| White Subtle · White 10 | `rgba(255,255,255,.1)` | `--ui-designer-control-border`, `--ui-designer-control-selected-bg` | — | match |
| White Soft · White 20 | `rgba(255,255,255,.2)` | `--ui-designer-control-border-strong` | — | match |
| White Blurry · White 40 | `rgba(255,255,255,.4)` | `--ui-designer-checkbox-border` | — | match |
| White Backdrop | `rgba(255,255,255,.6)` | — | — | missing (no consumer) |
| Black Subtle · Black 10 | `rgba(0,0,0,.1)` | — | — | missing (no consumer) |
| Black Soft | `rgba(0,0,0,.2)` | `--contexify-separator-color` | — | match |
| Black Blurry | `rgba(0,0,0,.4)` | — | — | missing (no consumer) |
| Black Backdrop | `rgba(0,0,0,.6)` | `--modal-overlay-bg-color` | — | match |
| — | `.05` / `.06` / `.07` white | `--ui-designer-control-empty-bg`, `--ui-designer-control-hover-bg`, `--ui-designer-hairline` | `--transparent-gray-dark` `.05` | not Figma steps; deviation, keep (solved for contrast, see the accent note) |
| — | `.23` white · `#ffffffb2` (70%) · `#000000dd` (87%) | — | `--transparent-gray-light`, `--text-on-secondary`, `--dimmer` | not Figma steps |

Everything not listed in the four tables above and present in `vars.css` is either VS Code-derived (`--vscode-*` passthroughs, `--dropdown-*`, `--list-item-*`, `--accent-blue-*`) or a Smart Item colour (`--list-smart-item-*`, `--ground-icon-bg-color`) with no Figma counterpart. Value changes and new tokens arising from this table go to the user first (names are theirs), ship with before/after screenshots of every consumer, and land in the same commit as their row here.

---

## Pages inventory

Harvested October 16, 2026 from the Figma file's own page list (`store.getState().mirror.appModel.pagesList` in the web client; the ids were spot-checked against the URL after clicking into eight pages). 52 pages: 8 section headers, 1 cover, 35 in scope, 8 skipped. **Pages whose name contains `🟡 Outdated` are not sources.** Address a page as `?node-id=<id with : as ->`, or pass the id to `get_metadata` to list its frames; pass frame or set ids, never the page id, to `get_variable_defs`.

| Page | Section | Node id | Status |
| --- | --- | --- | --- |
| COVER | — | `20420:50646` | cover |
| ↓ Tokens | Tokens | `20717:461` | section header |
| Colors | Tokens | `20752:6024` | in scope (tokens, synced above) |
| Typography | Tokens | `20717:313` | in scope (tokens, synced above) |
| Tags / Labels | Tokens | `20755:7456` | in scope (component page: Place, Privacy Public/Private, Role tag Owner/Collaborator/Tenant; references Snow, Silver, Pale Black, White 10, System/Orange, System/Blue Light 1, `H6 Regular`; defines no token) |
| ↓ Feedback | Feedback | `20762:23667` | section header |
| Progress | Feedback | `20450:17811` | in scope |
| Snackbars | Feedback | `20450:17639` | in scope |
| Tooltips | Feedback | `20819:271` | in scope |
| ↓ Navigation | Navigation | `20757:439` | section header |
| Header | Navigation | `20448:15582` | in scope |
| Tabs | Navigation | `20757:522` | in scope |
| ↓ Surfaces | Surfaces | `20762:23670` | section header |
| Accordion | Surfaces | `20932:5254` | in scope |
| Background | Surfaces | `20759:13588` | in scope |
| Cards | Surfaces | `20910:7505` | in scope |
| Cards 🟡 Outdated | Surfaces | `21457:1660` | skipped: outdated |
| Menu | Surfaces | `20747:59496` | in scope |
| Icons | Surfaces | `20450:15495` | in scope |
| Modals | Surfaces | `20423:75560` | in scope |
| Modals 🟡 Outdated | Surfaces | `21457:14856` | skipped: outdated |
| Scrollbar | Surfaces | `20937:5631` | in scope |
| Sections Titles | Surfaces | `20448:15585` | in scope |
| TitleBar | Surfaces | `20530:79669` | in scope |
| Profile Snapshot | Surfaces | `20772:841` | in scope |
| ↓ Inputs | Inputs | `20705:10838` | section header |
| Buttons | Inputs | `20705:10837` | in scope |
| Checkbox | Inputs | `20932:3958` | in scope |
| Dropdown | Inputs | `20780:6256` | in scope |
| Filter / Sort / Search bar | Inputs | `20448:15583` | in scope |
| Radio | Inputs | `20932:3959` | in scope |
| Search Bar | Inputs | `20768:1310` | in scope |
| Switch | Inputs | `20907:5707` | in scope |
| Text Field | Inputs | `20810:667` | in scope |
| ↓ Graphic Assets | Graphic Assets | `20423:75578` | section header |
| Avatars | Graphic Assets | `21232:42259` | in scope |
| Cards Thumbnails 🟡 Outdated | Graphic Assets | `21457:18423` | skipped: outdated |
| Download 🟡 Outdated | Graphic Assets | `21457:18035` | skipped: outdated |
| Logo | Graphic Assets | `21454:39192` | in scope |
| Scene's Thumbnails | Graphic Assets | `21454:39301` | in scope |
| Section | Graphic Assets | `21457:18415` | in scope |
| ↓ Settings | Settings | `20423:51482` | section header |
| App Settings | Settings | `21454:39027` | in scope |
| Settings 🟡 Outdated | Settings | `21454:13370` | skipped: outdated |
| Editor | Editor | `20421:50640` | section header |
| AI Assistant | Editor | `21206:31202` | in scope |
| Cleanup wizard 🟡 Outdated | Editor | `21023:15344` | skipped: outdated |
| Scene Editor 🟡 Outdated | Editor | `20533:81937` | skipped: outdated |
| UI Editor | Editor | `21028:15887` | in scope |
| Viewport | Editor | `20506:34918` | in scope |
| Toolbar | Editor | `21023:11034` | in scope |
| Publish (WIP) 🟡 Outdated | Editor | `20423:50468` | skipped: outdated |

---

## Related standards

- [`coding-standards.md`](./coding-standards.md) — React patterns (controlled-input prop-sync, memoized components).
- [`testing-standards.md`](./testing-standards.md) — E2E/Playwright patterns.
