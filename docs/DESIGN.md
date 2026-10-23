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

The UI Designer names its own three steps, from the Figma's Neutrals ramp: `--ui-designer-text` (→ `--palette-neutral-softWhite` `#fcfcfc`; labels, group titles), `--ui-designer-text-value` (→ `--palette-neutral-gray4` `#cfcdd4`; the value inside a field), `--ui-designer-text-muted` (→ `--palette-neutral-gray3` `#a09ba8`; hints, secondary). Code outside the UI Designer (the 3D toolbar) uses the `--palette-neutral-*` names directly. Glyphs take `--ui-designer-glyph` (an alias of `--palette-neutral-gray2` `#716b7c`), or `--ui-designer-glyph-on-control` when they sit on a field fill instead of the frame — see the contrast note in `vars.css`.

`UIDesigner.css` repoints `--gray-0`, `--title` and `--sub-text` to those tokens **inside** `.ui-designer` / the two rails, so every shared control in the designer takes the design's surface and foreground without per-selector overrides. The 3D EntityInspector keeps the global values.

There is no single `--text` token — pick the foreground that matches the surface. **Never rely on `color: inherit` for a control on a themed surface** (that is exactly how the white-on-white callback autocomplete happened); set an explicit foreground.

### Borders, focus & accent

| Token | Value | Use |
| --- | --- | --- |
| `--ui-designer-control-border` | `rgba(255,255,255,.1)` | Control borders (Figma White 10) |
| `--ui-designer-hairline` | `rgba(255,255,255,.07)` | Subtle dividers |
| `--focus-ring` | `--ui-designer-text` `#fcfcfc` (Snow) | Keyboard focus on the shared controls: the `:focus-visible` ring of `Button`, the `Dropdown` trigger, `CheckboxField`, `ModeSwitcher` and the `RangeField` thumb, and the focus border of `TextField` and `TextArea`. 17.73:1 on `#161518`, 15.45 on `#242129`, 12.13 on Onix, 9.88 on `--gray-0`. A ring on a light surface takes `--text-primary` instead: the `Pill` remove button sits on the `--base-02` `#f0f0f0` pill, where Snow is 1.11:1 and `--text-primary` about 15:1. That ring draws inside the 11px button (`outline-offset: -2px`), because any outer offset covers the end of the pill's label. UI Designer panels keep `--ui-designer-control-accent` |
| `--border-focused` | `#127fd4` | VS Code blue: `Tree` drop indicators and older UI Designer rules. Not a focus ring: 2.97:1 on Onix, 2.42 on `--gray-0` |
| `--ui-designer-accent` | `rgb(80,200,255)` | **Canvas** selection cyan |
| `--ui-designer-accent-80/-40/-12/-08/-05` | cyan @ .8/.4/.12/.08/.05 | Canvas hover/selection fills, drop targets |
| `--ui-designer-control-accent` | `#63b4f6` | **Panel** focus rings, the Anchor pin, bind affordances, selected rows |
| `--ui-designer-control-accent-62/-21/-15` | blue @ .62/.21/.15 | Panel hover borders and fills |
| `--ui-designer-control-selected-bg` | `rgba(255,255,255,.1)` | Hover/selected fill on a menu **row** |
| `--ui-designer-control-active-bg` | `#244b7d` (→ `--palette-system-blueDark2`) | Fill of a selected/active **toggle** |
| `--ui-designer-control-active-fg` | `#fcfcfc` (→ `--ui-designer-text`, Snow) | Glyph on that fill: 8.61:1 |
| `--palette-whiteTransparent-subtle` | `rgba(255,255,255,.1)` | Figma White Subtle · White 10: checkbox hover halo; `Button` Secondary fill (contained + secondary) and its pressed state; `--ui-designer-control-border` aliases it (ui2 theme-path name) |
| `--palette-whiteTransparent-soft` | `rgba(255,255,255,.2)` | Figma White Soft · White 20: disabled checkbox and large-field border; `Button` Secondary hover and `.active`; `--ui-designer-control-border-strong` aliases it (ui2 theme-path name) |
| `--palette-whiteTransparent-blurry` | `rgba(255,255,255,.4)` | Figma White Blurry · White 40: checkbox and large-field border; `Button variant="outlined"` outline; `--ui-designer-checkbox-border` aliases it (ui2 theme-path name) |
| `--palette-whiteTransparent-backdrop` | `rgba(255,255,255,.6)` | Figma White Backdrop · White 60: large-field hover and filled border; `outlined` pressed outline and `text` pressed label (ui2 theme-path name) |
| `--palette-system-blueDark2` | `#244b7d` | Figma System/Blue Dark 2: the text-selection highlight of every `input` and `textarea`, under Snow text (8.61:1); the selected toggle fill through `--ui-designer-control-active-bg` |
| `--palette-system-blueDark3` | `#243852` | Figma System/Blue Dark 3: the fill of a selected toggle under the pointer (Snow glyph 11.61:1). Darker than Blue Dark 2 on purpose, as Figma draws it |
| `--palette-neutral-gray2` | `#716b7c` | Figma Neutrals/Cloudy Sky (ui2 `neutral.gray2`): the `RangeField` track; `--ui-designer-glyph` aliases it |
| `--palette-neutral-gray3` | `#a09ba8` | Figma Neutrals/Silver (ui2 `neutral.gray3`): the camera button's icon stroke (4.59:1 on Onix); `--ui-designer-text-muted` aliases it |
| `--palette-neutral-gray4` | `#cfcdd4` | Figma Neutrals/Gray (ui2 `neutral.gray4`): the 3D toolbar's resting glyph (11.55:1 on Shadow); `--ui-designer-text-value` aliases it |
| `--palette-neutral-softWhite` | `#fcfcfc` | Figma Neutrals/Snow (ui2 `neutral.softWhite`): the 3D toolbar's hover and selected glyph; `--ui-designer-text` aliases it, and `--focus-ring` reads it through that alias |
| `--palette-neutral-onyx` | `#35333b` | Figma Neutrals/Onyx: the 1px border of an unselected UI Designer tab toggle, at rest, on hover and disabled (1.27:1 against the panel: an edge, not the state cue) |

Figma's Neutrals swatches name `#35333b` **Onix** and `#25212a` **Charcoal**. The two `vars.css` trailing comments that called `#35333b` Charcoal are deleted; the two block comments above the UI Designer control tokens still say Charcoal for it — read Onix.

#### Icon buttons and toggles

Every icon control in the UI Designer panels and canvas takes one of three rules (user decision, October 22, 2026; it overrides the `UI Editor Buttons` sets where they differ, see the ✱ deviations in that section under Component specs). The 2D toolbar leaves these rules for the `ToolbarButton` set and the Viewport Toolbar's 2D variant (user decision October 23, 2026; layer 3a2, implementation pending; until it lands the toolbar still wears them, and the toolbar mentions below describe that current state). Each control keeps its own size, padding, radius and border; the rules own colour and fill. Glyphs paint `currentColor`. A checkbox is separate. The UI Designer rails and the MobileHUD panel draw Checkbox Terciary: an outline box with a Snow tick and no fill (`CheckboxField color="tertiary"`), see Checkbox Terciary. The 3D panels draw Checkbox Primary (`color="primary"`, the default).

- **Icon button** (any icon control that is not a toggle: trash, help, bind link, add, copy, the toolbar's save / undo / redo): Silver `--ui-designer-text-muted` glyph and no container at rest; on hover a Snow `--ui-designer-text` glyph on a White 10 `--palette-whiteTransparent-subtle` container, 4px radius.
- **Tab toggle** (one choice out of a set: TextAlign, Flow direction, the canvas device pair, the device-variant tabs, the interaction-state tabs, the fill-mode chips, the 2D toolbar gizmos): unselected is a Silver glyph, no fill and a 1px `--palette-neutral-onyx` border; unselected + hover is Snow on White 10 with the same Onyx border; selected is a Snow glyph on `--ui-designer-control-active-bg` (Blue Dark 2); selected + hover is Snow on `--palette-system-blueDark3`; disabled is a White 20 glyph with the Onyx border. A selected tab toggle shows no Onyx: its 1px border takes the fill colour, so the box never changes size.
- **Single toggle** (on / off: the node-tree lock and eye, the node-header, GUI-list and MobileHUD eyes, wrap, the aspect lock, the canvas HUD / safe-area toggles, the toolbar Run / Scene Info): the tab-toggle colours with no border in any state. Silver at rest, Snow on White 10 on hover, Snow on Blue Dark 2 when selected, Snow on Blue Dark 3 when selected + hover, White 20 when disabled.
- **State hook:** the ARIA attribute (`aria-pressed`, `aria-checked` or `aria-selected`), never a class. The kind, not the attribute, decides the border.
- **Segmented group** (the tab toggles that sit joined: TextAlign, Flow direction, the canvas device pair, the device-variant tabs, the 2D toolbar gizmos): each cell draws its own 1px border and every cell after the first overlaps its neighbour by `margin-left: -1px`, so a seam is one pixel, never two. The first cell carries the group's left radii and the last its right radii, at the radius the group already had: `--ui-designer-radius-field` (6px) for alignment and flow, 4px for the canvas device pair, the device-variant tabs and the gizmos. The wrapper draws no border of its own. A selected cell (and the hovered one) sits above its neighbours (`z-index: 1`), so the shared seam shows its colour, not Onyx. The fill-mode and interaction-state chips are tab toggles that stand apart (a 2px gap): each keeps its full border and radius.
- **Focus:** one 2px `--ui-designer-control-accent` ring in every state, offset 1px on a standalone control and −2px inside a segmented cell.
- **Disabled:** WrapToggle's Blocked look for every icon control: White 20 `--palette-whiteTransparent-soft` glyph, no fill, no hover; a tab toggle keeps its Onyx border, a single toggle and an icon button draw none. No separate pressed state.
- **Hit target:** a control drawn smaller than 24px is a 24 × 24 transparent button whose Figma-size container is its `::before`. Its focus ring hugs that container (1px outside it, concentric corners), not the 24px box.

| Pairing (on `#242129`) | Contrast |
| --- | --- |
| Silver glyph at rest | **5.85:1** |
| Snow glyph on the White 10 hover container | **11.40:1** |
| Onyx tab-toggle border vs. panel | 1.27:1 (an edge; the glyph and fill carry the state) |
| Snow glyph on Blue Dark 2 / Blue Dark 3 | **8.61:1** / **11.61:1** |
| Blue Dark 2 / Blue Dark 3 fill vs. panel | 1.79:1 / 1.33:1 (the glyph colour carries the state) |
| Accent ring on panel / White 10 / Blue Dark 2 / Blue Dark 3 | 7.09 / 5.23 / **3.95** / 5.33:1 |
| White 20 disabled glyph | 1.91:1 (disabled, exempt) |

An Onix ring on a selected cell would be 1.41:1 on Blue Dark 2, so no selected-state ring override exists. The fills alone are under 3:1 against the panel, so selection is never colour-of-fill alone: the glyph turns Snow.

The checkbox tick and the indeterminate dash ignore `color`: the tick is a mask over `background-color`, the dash a solid block. Recolour them with `background-color`, never with a baked SVG fill.

#### ⚠️ Two accents, and which one you want depends on what it sits on

The UI Designer has **two** accent families. Picking the wrong one is a real bug, not a style preference:

- **Canvas → cyan.** The canvas renders the _author's own UI_ in arbitrary colours. A selection ring in a brand colour disappears the moment they use that colour themselves — and `#ff2d55` is precisely what the palette encourages. Because the backdrop is unknowable, WCAG 1.4.11's ≥3:1 cannot be verified against it; a hue authors are unlikely to pick is the mitigation. Use for node selection/hover, resize handles, drop targets, reorder indicators.
- **Panel → blue `#63b4f6`.** Panel chrome always sits on `--base-20` (`#161518`), a surface we control, so contrast is fixed and testable. Use for focus rings, active tab underlines, hover borders/fills, selected rows, and the Anchor row's pinned edge. Toggle fills are Blue Dark 2 / 3 and the bind affordance is Silver / Snow (see "Icon buttons and toggles"). It is Figma's System/Blue Light 1.

  **UI Designer panel chrome is deliberately not pink.** Its focus rings and selection take the accent blue, and its toggles the Blue Dark 2 / 3 fills. `--primary-main` belongs to CTAs and main buttons (`Button color="primary"`, the event/variable menu `ADD` confirm) and to the value marks Figma draws in Primary: the `RangeField` fill and thumb (Slider) and the MobileHUD "Main" radio. The UI Designer checkbox is not one of them. Figma draws it as Checkbox Terciary ([`21650:4570`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21650-4570)), a Snow tick on no fill, so a checked rail checkbox carries no pink. A mark that carries a value is not chrome; a ring, a row highlight or a toggle fill painted pink would compete with the one thing on screen that should read as the action.

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
| `--primary-main` / `--primary-dark` | `#ff2d55` / `#f70038` | Brand pink — **CTAs and main buttons only**, plus the "armed/active tool" signal. Main: the `.Button.primary` fill and the `text` + `primary` label. Dark: `.Button.primary` pressed. Not for panel chrome (that's `--ui-designer-control-accent`); don't use it for field errors. |
| `--palette-primary-light` | `#ff6280` | Figma Primary Light 1: `.Button.primary` hover and active fill, and the `text` + `primary` hover label (ui2 theme-path name) |
| `--secondary-main` | `#ff7439` | Brand orange |
| `--success-main` / `--error-main` / `--warning-main` | `#34ce77` / `#fb3b3b` / `#fe9c2a` | Status (Figma System/Green, Red, Orange) |
| `--success-dark` / `--success-light` | `#00b453` / `#65d890` | Status shades (no consumers yet) |
| `--error-dark` / `--error-light` | `#ec303a` / `#e97177` | Error shades; `--error-light` is the hover/focus border and the 10–13px error text |
| `--warning-dark` | `#f38025` | Warning shade (no consumers yet) |
| `--secondary-dark` / `--secondary-light` | `#f45708` / `#ffad8d` | Brand orange shades (no consumers yet) |

Contrast of the status text and icon colours (old → new) on the surfaces they sit on: `#161518` inspector page, `#242129` card, modal and UI Designer panel, `#35333b` Onix.

| Token            | on `#161518` | on `#242129` | on `#35333b` |
| ---------------- | ------------ | ------------ | ------------ |
| `--error-main`   | 4.94 → 5.02  | 4.31 → 4.37  | 3.38 → 3.43  |
| `--error-light`  | 5.22 → 6.14  | 4.55 → 5.36  | 3.57 → 4.20  |
| `--warning-main` | 11.92 → 8.66 | 10.39 → 7.55 | 8.15 → 5.93  |

No pair that passed 4.5:1 now fails. `--error-main` text on `#242129` (the `CallbackField` add-name error, 11px, and the `CreateScriptModal` error, 12px) was 4.31 and is 4.37: still under 4.5:1, a gap the alignment does not close (use `--error-light` there if it is fixed). As a border (`TextField`, `TextArea`, `Dropdown`, `CheckboxField`, the callback textarea) every value clears 3:1.

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

| Token | Value | Use |
| --- | --- | --- |
| `--controlHeight-small` | `26px` | Dense `TextField` / `Dropdown` height, the default (Figma UI Editor `Input`; ui2 theme-path name) |
| `--controlHeight-medium` | `40px` | `Button size="medium"` height (Figma TitleBar CTA, Button-Contained-Text-Icon Hug × 40; ui2 theme-path name) |
| `--controlHeight-large` | `46px` | `TextField size="large"` and `Button size="large"` height (Figma Text-Input, Button-Contained-Text; ui2 theme-path name) |
| `--shape-borderRadius` | `6px` | Dense field, dropdown and textarea corners; `--ui-designer-radius-field` aliases it (ui2 theme-path name) |
| `--shape-borderRadiusLarge` | `12px` | Large field, `.Button.medium` and `.Button.large` corners; `--ui-designer-radius-menu` aliases it (ui2 theme-path name) |
| `--borderWidth-strong` | `1.5px` | Kept as the ui2 theme-path name; unused, because Chromium floors a fractional border width — large fields draw 1.5px as a 1px border plus `box-shadow: inset 0 0 0 0.5px`, and `Button variant="outlined"` draws it as `box-shadow: inset 0 0 0 1.5px` with no border, so the outline takes no box |

Give interactive controls a consistent height so rows align: fields take `--controlHeight-small` (dense, the default) or `--controlHeight-large` (forms). Interactive hit targets should be ≥24px.

Corners in the UI Designer come from two tokens, `--ui-designer-radius-field` (6px — inputs, dropdowns, segmented cells, the anchor preview) and `--ui-designer-radius-menu` (12px — option lists and popovers), which alias `--shape-borderRadius` and `--shape-borderRadiusLarge`. The shared `TextField`, `Dropdown` and `TextArea` take 6px by default, so the panel needs no radius override for them; the shared `CheckboxField` and the small `Button` still hardcode their own (5px and 4px).

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

- **Focus:** every interactive element has a visible `:focus-visible` ring — `--focus-ring` (Snow) on the shared controls, `--ui-designer-control-accent` in UI Designer panels, `--ui-designer-accent` on the canvas. Text fields show focus as a `--focus-ring` border instead of a ring. Prefer `:focus-visible` over `:focus`. **Never** `outline: none` without a replacement ring.
- **Contrast (WCAG AA):** text ≥ **4.5:1**, non-text/UI (borders, focus rings, canvas markers, icons) ≥ **3:1** against their background.
- **ARIA/semantics:** icon-only buttons need `aria-label`; use `<button>` for actions and `<a>`/`<Link>` for navigation (never `<div onClick>`); tie every input to a `<label>` or `aria-label`; async updates use `aria-live="polite"`.
- **Motion:** honor `prefers-reduced-motion` (reduced/none variant); animate only `transform`/`opacity`; **never** `transition: all` — list properties.
- **During drag:** `user-select: none` + `touch-action: manipulation`.
- **Content:** truncate/clamp long text (flex children need `min-width: 0`); handle empty states; placeholders end with `…`.
- **Color:** tokens only — no new hardcoded hex. A translucent state of a token, such as the `CheckboxField` checked hover halo at 20%, is `color-mix(in srgb, var(--token) 20%, transparent)`; that is styling with tokens, so it needs no new token name. A disabled control is dimmed with `opacity`, not with a translucent token (`Button`: the whole node at 0.2).
- **A background on a `<Box>` root does nothing.** `Box.css` paints `--main-bg-color` on the `.content` div it wraps children in, which covers the root. Put panel surfaces on `<yourClass> > .content`.
- **Pickers and bound values.** Popover pickers (event, variable) are a raised `--ui-designer-control-bg` card at the 12px menu radius: rows highlight on `--ui-designer-control-accent-21`, the selected row carries a leading checkmark, and a diamond-plus `Add New …` row reveals a `Description` field and an auto-width `--primary-main` `ADD` confirm (dimmed to 40% until the name is valid). Event fields are horizontal — a left label and a full-width rounded pill: `--ui-designer-control-bg` when a handler is bound (with the name and an inline clear) and a fainter fill reading `Bind an event handler` in `--ui-designer-text-muted` when empty. The pill is neutral, not accent — an event is not a bound-variable field.
- **Portalled menus take a scope, not a descendant selector.** A `Dropdown`'s option list renders into `document.body`, so a panel rule like `.my-panel .OptionList` can never reach it. The panel declares `data-dropdown-scope="<name>"` on an ancestor; on open the `Dropdown` finds it with `closest()` and sets the same attribute on its `OptionList`, so the panel styles `.OptionList[data-dropdown-scope="<name>"]` (the UI Designer uses `ui-designer`, `PropertyPanel.tsx` / `PropertyPanel.css`).
- **Keyboard and names on `ui/Dropdown`.** The trigger is a `role="combobox"` in the tab order (`-1` and `aria-disabled` when disabled): Enter, Space, and the arrow keys open it; arrows clamp and skip disabled and header options; Enter selects through the same path as a click; Escape closes without a change; Tab from the search field closes and returns to the trigger. The search field is itself a combobox and carries `aria-activedescendant` while focused. A string `label` names the trigger; a label that comes only from an enclosing `Block` doesn't, so pass `aria-label` there.

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
| Surfaces | `--bg` `#161518`, `--background` `#161518`, `--card` / `--modal` / `--secondary` `#242129`, `--darker-gray` `#242129`, `--toast` `#3d3b43`, `--dimmer` `#000000dd` |
| Text | `--text` `#ffffff`, `--text-on-secondary` `#ffffffb2`, `--secondary-text` `#676370`, `--dcl-silver` `#a09ba8` |
| Brand and actions | `--primary` / `--dcl` `#ff2d55`, `--primary-hover` `#ff6280` (the primary hover), `--dcl-hover` `#f70038` and `--dcl-dark` `#9c1c34` (no consumers) |
| Status | `--success` `#34ce77`, `--danger` `#fe9c2a`, `--error` `#fb3b3b` |
| Lines | `--divider` `#67637033`, `--text-area-border` `#676370`, `--clear-divider` `#a09ba8` |
| AI assistant | `--ai-selected`, `--ai-menu-bg`, `--ai-input-bg`, `--ai-session-selected` and their `-hover` steps |
| ui2 overrides | `--mui-shape-borderRadius` `6px`, `--mui-palette-action-disabled`, `--mui-palette-secondary-contrast` |

The brand pink matches the inspector's `--primary-main`, but it's defined separately on each side of the iframe. Change both, or neither.

**Figma alignment of the status, surface, and hover tokens.** `--error`, `--danger`, `--background`, `--bg`, `--primary-hover` and `--purple-banner` carry Figma's System/Red, System/Orange, Neutrals/Shadow, Primary Light 1 and Brand/Purple values. Names are unchanged.

- `--primary-hover` is the primary-button hover at five sites: the wrapper `components/Button` (`.Button.MuiButton-colorPrimary:hover`), the editor header actions (`EditorPage/styles.css`), both `CreateButton` segments, and the AI `SendButton`. Raw ui2 contained-primary `Button`s (`SignInPage`, `UpdateAvailable`, `WarningModal` and others) still hover to ui2 `palette.primary.dark` `#F70038`. `--dcl-hover` and `--dcl-dark` have no consumers left; removing them is a naming decision for the user. White text on `#ff6280` measures 2.87:1 (Snow `#fcfcfc` 2.80:1); the value is the user's pick from Figma and a known trade-off, not a pass. The fill itself is 6.36:1 against the page.
- `--bg` and `--purple-banner` also have no consumer.
- `--background` paints cards on the page (`HeroStat`, `StatsRow`, `EngagementTab .SocialChart`) and the `Deploy` error-detail block; `--danger` and `--error` paint text, icons and one border.

| Pair (consumer) | Old | New | Threshold |
| --- | --- | --- | --- |
| `--error` text on modal paper `#1d1c20` (`CreateProject`, `RenameFolder`, `AppSettings` Scenes, `DeleteProject`, `Deploy`, `AlternativeServers`, `AddUserForm` CSV, `DeploymentHistory`, `RangeField`) | 4.24 | 4.67 | 4.5 text: old failed, new passes |
| `--error` icon on `#1d1c20` (`ConnectionModal`) | 4.24 | 4.67 | 3 non-text: passes |
| `--error` on page `#16141a` (`ConnectionStatusIndicator` icon) | 4.57 | 5.04 | 3 non-text: passes |
| `--error` delta text and icon on its card (`HeroStat`) | 4.55 on `#18141a` | 5.02 on `#161518` | 4.5 text: passes |
| `--danger` border and icon on `#1d1c20` (`WorldPermissionsAccessTab`, `ConnectionModal`, `ConnectionStatusIndicator`) | 8.82 | 8.07 | 3 non-text: passes |
| `--danger` icon on `#4f3020` (`#ec7122` at 24% over `#1d1c20`, `LayoutTab` warning) | 6.15 | 5.63 | 3 non-text: passes |
| `--danger` icon on `#4a2b1a` (`ConfirmationPanel` warning) | 6.62 | 6.06 | 3 non-text: passes |
| `--dcl-silver` `#a09ba8` text on its `--background` card (`Deploy` error detail) | 6.72 | 6.71 | 4.5 text: passes |
| Card `--background` vs modal paper `#1d1c20` | 1.07 | 1.07 | decorative, unchanged |

No pair that passed now fails.

### Conventions

- Styled components follow CLAUDE.md → "Styled Components Conventions": import from `decentraland-ui2`, use object syntax, take values from the theme, and keep them in `Component.styled.ts`.
- Reuse a component the renderer already imports, from `decentraland-ui2` or an existing `@mui/material` import, before you build one. Don't add an import of an MUI module the renderer doesn't use yet. Pulling a not-yet-bundled module into a running dev session retriggers Vite's dependency optimizer. When no imported component fits, hand-roll it, as the settings Accordion is.
- ui2 pins secondary-text buttons to a grey `secondary.contrast` at high specificity. Overriding their color takes a repeated-`&` selector (see `Tabs/AiTab/component.tsx`), not `!important`.
- ui2 styles a contained-primary `Button` through a 3-class compound selector (`.css-hash.MuiButton-sizeMedium.MuiButton-containedPrimary`), adds a 10px gap between any two adjacent buttons through a global `.MuiButton-root + .MuiButton-root` rule, and sets the hover through `.css-hash.MuiButton-sizeMedium.MuiButton-containedPrimary:not(.Mui-disabled):not(.Mui-focusVisible):hover`. A single-class override loses to all three, so a styled override needs `&&&` for the base styles and `&&&&&&:hover` for the hover (see `CreateButton/component.styled.ts`).

---

## Figma variables → tokens

Reconciled on October 16, 2026 from the Colors page ([node `20752:6024`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20752-6024), frame "Colors Dark" `20755:6429`) with `get_variable_defs` on the frame plus `get_design_context` on the Neutrals, INFO, Transparencies and Gradients columns, whose swatches are not all bound to variables. Status: **match** (same value), **drift** (a token exists for the role but holds another value), **missing** (no token in that world), **deviation** (documented and kept on purpose). A `—` means the world has no token for it and needs none yet. ui2 paths name `decentraland-ui2`'s dark theme (`theme/colorSchemes.js`, `theme/colors.js`).

### Brand and primary

| Figma variable | Value | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) | Status |
| --- | --- | --- | --- | --- |
| Primary/Primary · Brand/Ruby | `#FF2D55` | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` | match |
| Primary/Primary Dark 1 | `#F70038` | `--primary-dark` | `--dcl-hover` (no consumer) · ui2 `palette.primary.dark` | match |
| Primary/Primary Dark 2 | `#D80029` | — | ui2 `colors.primaryDark2` | missing in inspector |
| Primary/Primary Light 1 | `#FF6280` | `--palette-primary-light` `#ff6280` | `--primary-hover` `#ff6280` · ui2 `palette.primary.light` `#F26276` (dark scheme; `#F8919D` from ui2 3.23.8) · ui2 `colors.primaryLight1` `#F8919D` | match in inspector and `theme.css`; **drift** in ui2 `palette.primary.light` and `colors.primaryLight1` (upstream) |
| Primary/Primary Light 2 | `#FF93A8` | — | ui2 `colors.primaryLight2` `#FFC9D5` | drift (ui2 upstream) |
| Primary Alt/Primary Alt · Brand/Orange | `#FF7439` | `--secondary-main` | — | match |
| Primary Alt/Primary Alt Dark 1 | `#F45708` | `--secondary-dark` `#f45708` | — | match |
| Primary Alt/Primary Alt Dark 2 | `#D84900` | — | — | missing |
| Primary Alt/Primary Alt Light 1 | `#FFAD8D` | `--secondary-light` `#ffad8d` | — | match |
| Primary Alt/Primary Alt Light 2 | `#FFCDBA` | — | — | missing |
| Brand/Yellow | `#FFC95B` | `--yellow` | — | match (`--warning-main` no longer shares it: it is System/Orange, see below) |
| Brand/Melon | `#FFA25A` | `--melon` | — | match |
| Brand/Lavender | `#C640CD` | `--lavender`, `--smart-item-icon-bg-color` | — | match |
| Brand/Violet | `#A524B3` | `--violet` | — | match |
| Brand/Purple | `#691FA9` | `--purple` | `--purple-banner` `#691fa9` | match in `theme.css` (no consumer) |
| Brand/Flare · Cerise · Amin | gradients: Ruby→Yellow, Ruby→Lavender, Lavender→Purple | — | `--metaverse-gradient` is a different gradient | missing (no consumer yet) |

### Neutrals

The Figma ramp has 13 swatches; 10 are variables and three (Onix, Onix Dark 1, Charcoal) are swatch fills only. ui2 mirrors the ramp as `colors.neutral` (`softWhite`, `gray5…gray0`, `softBlack2`, `softBlack1`).

| Figma | Value | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) | Status |
| --- | --- | --- | --- | --- |
| Neutrals/White | `#FFFFFF` | `--white`, `--base-01` | `--white`, `--text` · ui2 `neutral.white` | match |
| Neutrals/Snow | `#FCFCFC` | `--palette-neutral-softWhite` (aliased by `--ui-designer-text`) | ui2 `neutral.softWhite` | match |
| Neutrals/Pearl | `#ECEBED` | — | ui2 `neutral.gray5` | missing in inspector |
| Neutrals/Gray | `#CFCDD4` | `--palette-neutral-gray4` (aliased by `--ui-designer-text-value`) | ui2 `neutral.gray4` | match |
| Neutrals/Silver | `#A09BA8` | `--palette-neutral-gray3` (aliased by `--ui-designer-text-muted`), `--neutral-grey-3` | `--dcl-silver`, `--clear-divider` · ui2 `neutral.gray3` | match |
| Neutrals/Cloudy Sky | `#716B7C` | `--palette-neutral-gray2` (aliased by `--ui-designer-glyph`) | `--dropdown` · ui2 `neutral.gray2` | match |
| Neutrals/Graffito | `#5E5B67` | — | `--light-gray` · ui2 `neutral.gray1` | missing in inspector |
| Neutrals/Pale Black | `#43404A` | `--gray-0` | `--dark-gray` · ui2 `neutral.gray0` | match |
| Onix (swatch) | `#35333B` | `--ui-designer-control-bg` | — | match |
| Onix Dark 1 (swatch) | `#2D2A33` | — | `--title-bar-button` | missing in inspector |
| Charcoal (swatch) | `#25212A` | `--ui-designer-panel-bg` → `--base-19` `#242129` | `--card`, `--modal`, `--secondary`, `--darker-gray` `#242129` · ui2 `neutral.softBlack2` `#242129` | **deviation**: both worlds follow ui2's `#242129`, 1/255 from Figma; keep |
| Neutrals/Shadow | `#161518` | `--base-20`, `--tree-bg-color` | `--black` · ui2 `neutral.softBlack1` | match; `--bg` and `--background` are `#161518` in `theme.css` too (match) |
| Neutrals/Black | `#000000` | `--black`, `--base-21` | `--bg-inspector` · ui2 `neutral.black` | match |
| — | `#676370` | `--neutral-grey-4` | `--secondary-text`, `--text-area-border`, `--popup`, and the `#676370xx` alpha family (`--divider`, `--secondary-on-modal`, `--card-on-modal`) | **not in Figma**; nearest is Graffito `#5E5B67` |

The inspector's `--base-02 … --base-18` and `--accent-blue-*` ramps are VS Code's, not Figma's; they predate the design system and are kept for the embedded-webview theme. `--accent-blue-05` / `-07` / `-08` are also `Button color="info"`'s fill / hover / pressed, a colour with no Figma counterpart. `--ui-designer-accent` (cyan) is the documented canvas deviation above.

### System (status) and INFO

ui2's dark theme carries Figma's System ramp verbatim (`palette.success` / `.warning` / `.error` / `.info`, each with `main`, `dark` = Dark 1, `light` = Light 1), so Creator Hub reads status colours from the theme. The inspector's status tokens now carry the same values.

| Figma variable | Value | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) | Status |
| --- | --- | --- | --- | --- |
| System/Green | `#34CE77` | `--success-main` `#34ce77` | `--success` · ui2 `palette.success.main` | match in inspector |
| System/Green Dark 1 / Light 1 | `#00B453` / `#65D890` | `--success-dark` `#00b453` / `--success-light` `#65d890` | ui2 `palette.success.dark` / `.light` | match in inspector |
| System/Green Dark 2 / Light 2 | `#00A146` / `#C1EECF` | — | — | missing |
| System/Orange | `#FE9C2A` | `--warning-main` `#fe9c2a` | `--danger` `#fe9c2a` · ui2 `palette.warning.main` | match in inspector and `theme.css` |
| System/Orange Dark 1 / Light 1 | `#F38025` / `#FFB95B` | `--warning-dark` `#f38025` / — | ui2 `palette.warning.dark` / `.light` | match in inspector (Light 1 missing) |
| System/Orange Dark 2 / Light 2 | `#EC7122` / `#FFCD88` | — | — | missing |
| System/Red | `#FB3B3B` | `--error-main` `#fb3b3b` | `--error` `#fb3b3b` · ui2 `palette.error.main` | match in inspector and `theme.css` |
| System/Red Dark 1 / Light 1 | `#EC303A` / `#E97177` | `--error-dark` `#ec303a` / `--error-light` `#e97177` | ui2 `palette.error.dark` / `.light` | match in inspector |
| System/Red Dark 2 / Light 2 | `#CC1D2C` / `#FFCDD4` | — | — | missing |
| Blue (swatch) | `#2196F3` | — | ui2 `palette.info.main` | missing in inspector |
| Blue Dark 1 (swatch) | `#1A75D2` fill; its label reads `#1F87E5` | — | ui2 `palette.info.dark` `#1A75D2` | missing in inspector; the Figma label is stale, the fill is the value |
| Blue Dark 2 (swatch) | `#244B7D` fill; its label reads `#1764C0` | `--palette-system-blueDark2` | `--ai-session-selected` | match on the fill; Figma label stale |
| Blue Dark 3 (swatch) | `#243852` | `--palette-system-blueDark3` | `--ai-session-selected-hover` | match |
| System/Blue Light 1 | `#63B4F6` | `--ui-designer-control-accent` | ui2 `palette.info.light` | match |
| Blue Light 2 (swatch) | `#BBDEFB` | — | — | missing |
| — | `#214272` / `#2E4A7A` | — | `--ai-selected` / `--ai-selected-hover` | not in Figma |
| — | `#127FD4` | `--border-focused` | — | not in Figma (VS Code focus blue); deviation, keep |

### Transparencies

Figma names four steps per base colour, Backdrop 60% · Blurry 40% · Soft 20% · Subtle 10%, plus the component-level `Transparencies/White 10` and `White 20`. The alpha is not in the variable value (`get_variable_defs` returns the opaque hex), so take it from the swatch label.

| Figma | Value | Inspector (`vars.css`) | Creator Hub (`theme.css`) | Status |
| --- | --- | --- | --- | --- |
| White Subtle · White 10 | `rgba(255,255,255,.1)` | `--palette-whiteTransparent-subtle` (aliased by `--ui-designer-control-border`), `--ui-designer-control-selected-bg` | — | match |
| White Soft · White 20 | `rgba(255,255,255,.2)` | `--palette-whiteTransparent-soft` (aliased by `--ui-designer-control-border-strong`) | — | match |
| White Blurry · White 40 | `rgba(255,255,255,.4)` | `--palette-whiteTransparent-blurry` (aliased by `--ui-designer-checkbox-border`) | — | match |
| White Backdrop · White 60 | `rgba(255,255,255,.6)` | `--palette-whiteTransparent-backdrop` | — | match |
| Black Subtle · Black 10 | `rgba(0,0,0,.1)` | — | — | missing (no consumer) |
| Black Soft | `rgba(0,0,0,.2)` | `--contexify-separator-color` | — | match |
| Black Blurry | `rgba(0,0,0,.4)` | — | — | missing (no consumer) |
| Black Backdrop | `rgba(0,0,0,.6)` | `--modal-overlay-bg-color` | — | match |
| — | `.05` / `.07` white | `--ui-designer-control-empty-bg`, `--ui-designer-hairline` | `--transparent-gray-dark` `.05` | not Figma steps; deviation, keep (solved for contrast, see the accent note) |
| — | `.23` white · `#ffffffb2` (70%) · `#000000dd` (87%) | — | `--transparent-gray-light`, `--text-on-secondary`, `--dimmer` | not Figma steps |

Everything not listed in the four tables above and present in `vars.css` is either VS Code-derived (`--vscode-*` passthroughs, `--dropdown-*`, `--list-item-*`, `--accent-blue-*`) or a Smart Item colour (`--list-smart-item-*`, `--ground-icon-bg-color`) with no Figma counterpart. Value changes and new tokens arising from this table go to the user first (names are theirs), ship with before/after screenshots of every consumer, and land in the same commit as their row here.

---

## Component specs

Extracted per page with `get_metadata` (sets and variant counts), `get_design_context` and `get_variable_defs` on each set, and `get_screenshot` for reference. One subsection per component set, in page order. A row marked ✱ is a state Figma does not define, proposed here so implementers never invent it silently. Contrast is WCAG against the real surface it renders on: inspector `#161518`, Creator Hub `#16141a` page / `#242129` card. "Code" names the component that renders the role today; "none" is absence, not removal.

### Figma names → code names

| Figma name | Code name | Where it appears |
| --- | --- | --- |
| `Terciary` (Button-Contained-Text, Button-Contained-Text-Icon, TitleBar CTAs) | `Button variant="outlined" color="secondary"` | Button-Contained-Text, Button-Contained-Text-Icon, TitleBar. `Button` has a shape axis (`variant`) and `CheckboxField` does not, so Figma's one word has two code spellings (gap G27) |
| `Terciary` (Checkbox) | `CheckboxField color="tertiary"` | Checkbox Terciary |
| `Primary`, `Secondary` (Button-Contained-Text / -Icon) | `Button variant="contained"` + `color="primary"` / `color="secondary"` | Button-Contained-Text, Button-Contained-Text-Icon. `Button`'s TypeScript defaults are MUI's (`text` / `primary` / `medium`), so every call site writes `variant`, `color` and `size` |
| Attach Hug × 30 / TitleBar CTA Hug × 40 / Hug 46 | `Button size="small"` / `"medium"` / `"large"` | ReportBug Attach, TitleBar, Button-Contained-Text |
| `Checkbox Primary` (`21170:30118`), `Checkbox Secondary` (`20849:724`), `Checkbox Terciary` (`21650:4570`) | `CheckboxField` `color` `primary` (default), `secondary`, `tertiary` | Checkbox |
| `Quaternary` | not implemented until a caller exists (the Figma spec below is kept) | Button-Contained-Text-Icon |
| `Idle` | `default` | PillIconText, Filter (Pill) |
| `Blocked`, `PrimaryBlocked`, `SingleBlocked`, `IconBlocked` | `disabled` (`PrimaryBlocked` → `Button color="primary"` + `disabled`) | rounded-button-contained, ButtonContainedVertical (20), Button-Contained-Text, ProfilePic, Dropdown-Input, Filter, Input, WrapToggle, BottomPanel2D |
| `En` | `end` | End (Checkbox) |
| `Hove` | `hover` | Radio |
| `OnHover`, `HoverSelected`, `SelectedHover` | `hoverSelected` | Radio, Checkbox Secondary, PillIconText, NodeTypeHierarchy |
| `Invisible…` (`InvisibleDefault`, `InvisibleHover`, `InvisibleSelected`, `InvisibleSelectedHover`) | `hidden`, `hiddenHover`, `hiddenSelected`, `hiddenHoverSelected` | NodeTypeHierarchy |
| `Hiden`, `HidenHover` | `hidden`, `hiddenHover` | InputAction |
| `RigthSide` | `rightSide` | Toolbar |
| `smat-item` | `smart-item` | Component Icons |
| `Property 1` | the property it varies: `variant`, `state` or `size` | every set that keeps Figma's default property name |

Specs keep Figma's names so they stay traceable to the file; component APIs use the code names.

### Feedback tokens

Every literal the Feedback pages use, mapped once; the variant tables below refer to these names.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FCFCFC` text, glyphs, spinner track, progress border | Neutrals/Snow | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#FF2D55` action text, spinner arc | Primary/Primary | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` |
| `#161518` snackbar fill | Neutrals/Shadow | `--base-20`, `--tree-bg-color` | `--black` · ui2 `neutral.softBlack1` |
| `#35333B` tooltip fill | Neutrals/Onix (swatch) | `--ui-designer-control-bg` | missing |
| `rgba(255,255,255,.1)` progress track | DCL/White10% | `--ui-designer-control-border` | missing |
| Snow @ .3 spinner track | not a Figma step (ramp is 60/40/20/10) | missing | missing |
| Ruby → Yellow progress fill | Brand/Flare, as an image fill | missing | missing (`--metaverse-gradient` differs) |
| 12px radius | — | `--ui-designer-radius-menu` | missing (`--mui-shape-borderRadius` is 6px) |
| 100px pill radius | — | missing | missing |
| `0 2px 3px rgba(0,0,0,.25)` tooltip shadow | — | missing (`--contexify-menu-shadow` differs) | missing |
| Inter 14 / 400 / 100% | `H7 Regular` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |
| Inter 14 / 600 / 100% uppercase | `H7 Semi Caps` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |

### Spinner Animation (Progress)

Set [`10394:80291`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-80291), 4 variants, all keyframes of one animation: a 225° Primary arc over a Snow @ .3 full-circle track, 48 × 48, stroke 4 round-capped, rotated per variant. The Snackbar Loading variant embeds it at 24 × 24, stroke 2. Code: inspector `components/Loading` (decentraland-ui `Loader`, Semantic UI's grey ring, not this arc); Creator Hub `components/Loader` and direct ui2 `CircularProgress` (MUI default, no ui2 override, 40px / 3.6 stroke).

| Variant | State | Arc start → end | Fill / stroke | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | 137° → 272° | arc Primary, track Snow @ .3 | 48, stroke 4 | arc on `#161518` 4.99:1, on `#242129` 4.35:1 (≥ 3:1 non-text); track 2.65:1, decorative | `role="progressbar"` + `aria-label` ("Loading"), or `aria-busy` on the region |
| Variant2 | default | 201° → 336° | same | same | same | same |
| Variant3 | default | 332° → 107° | same | same | same | same |
| Variant4 | default | 78° → 213° | same | same | same | same |
| any | ✱ reduced motion | static Default keyframe | same | same | same | `prefers-reduced-motion`: no rotation |
| any | ✱ 24px | as Default | arc Primary, track Snow @ .3 | 24, stroke 2 | same | inline in a 44px row (Snackbar Loading) |

### ProgressBar (Progress)

Component [`20827:581`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20827-581), 1 variant, no states. Code: inspector none; Creator Hub `OptimizeModal` renders ui2 `LinearProgress` (MUI default: 4px tall, square, `primary` fill, no border).

| Variant | State | Fill | Border | Radius | Spacing / size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ProgressBar | determinate | track White10; bar Ruby → Yellow (placeholder width 198/296 ≈ 67%) | 2px Snow | 100px pill (track and bar) | 300 × 16; bar inset 2px, 12 tall | border 17.73:1; bar vs track 3.81:1 at the Ruby end (≥ 3:1); track vs page 1.31:1, the border carries the edge | `role="progressbar"` with `aria-valuenow/min/max` and a visible or `aria-label` name |
| ProgressBar | ✱ indeterminate | same chrome, bar animates | same | same | same | same | `role="progressbar"` without `aria-valuenow`; honour `prefers-reduced-motion` |

### Snackbars (Snackbars)

Set [`10394:276910`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-276910), 4 variants, no interaction states drawn. Shared chrome: fill Shadow, 12px radius, 44 tall, padding 12 / 16 / 12 / 12 (top / right / bottom / left), 16px gap between content and action, 10px gap icon → text, no border, no shadow. Text `H7 Regular` Snow; action `H7 Semi Caps` Primary; glyphs Snow. Code: inspector none (`ui/Message` is an inline field message, not a snackbar); Creator Hub `components/Snackbar` (MUI `Snackbar` + ui2 `Alert`, MUI defaults): `styles.css` paints `--card` `#242129` and the ui2 `Paper` radius, action `--dcl` — drift from Shadow / 12px.

| Variant | State | Leading | Text | Action | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Notification | default | `notification_important` 18px Snow | "Notification text" | `OK` Primary | 199 × 44 | text 17.73:1; action on Shadow 4.99:1 (≥ 4.5:1); on `#242129` 4.35:1 — fails, keep the Shadow fill | `role="status"`, `aria-live="polite"`; action is a `<button>` |
| Warning | default | `warning` 18px Snow | "Warning text" | `OK` Primary | 177 × 44 | same | `role="alert"`; action is a `<button>` |
| Notification_Action | default | `notification_important` 18px Snow | "Action required" | `ACTION` Primary + `Close` 20px Snow, 16px gap | 265 × 44 | same; close glyph 17.73:1 | close `<button aria-label="Dismiss">`; 20px glyph needs a ≥ 24px hit area |
| Loading | default | Spinner 24px, stroke 2 | "Loading..." | none | 127 × 44 | text 17.73:1; arc 4.99:1 | `role="status"`, `aria-busy="true"` |
| any with action | ✱ hover | — | — | keep Primary, add underline; Primary Dark 1 `#F70038` is not an option | — | `#F70038` on Shadow 4.34:1, below 4.5:1 text | — |
| any with action | ✱ focus | — | — | `:focus-visible` ring `--border-focused` (inspector) / ui2 `palette.info.light` (Creator Hub), offset 2px | — | ring on `#161518`: `--border-focused` 4.34:1, `#63b4f6` 8.13:1 (≥ 3:1) | — |
| any | ✱ surface | — | — | — | — | Shadow vs Creator Hub page `#16141a` 1.00:1 and inspector `#161518` 1.00:1: the snackbar does not separate from the page it floats over | needs the tooltip's `0 2px 3px rgba(0,0,0,.25)` shadow or a `--ui-designer-hairline` border; the user picks |

### Tooltip (Tooltips)

Set [`20819:309`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20819-309), 4 variants (placement), no states. Shared: container fill Onix, 12px radius, padding 16 / 20, text `H7 Regular` Snow centred, `max-width: 300px`; peak a 26 × 26 Onix square, 5px radius, rotated 45°, overlapping the container by 26px so ~11px shows; drop shadow `0 2px 3px rgba(0,0,0,.25)` on the whole. Code: inspector `ui/InfoTooltip` (decentraland-ui `Popup`: `--gray-0` `#43404a` fill, 11px / 500 text, arrow hidden) and `Toolbar.css .CameraModeTooltip`; Creator Hub ui2 `Tooltip` (MUI default `rgba(97,97,97,.92)` fill, 11px, no ui2 override).

| Variant | State | Peak | Size (with "Text") | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Top | default | below the container, centred | 69 × 59.77 | text 12.13:1; Onix vs `#161518` 1.46:1, vs `#242129` 1.27:1 — the shadow carries the edge | `role="tooltip"`, trigger `aria-describedby`; shows on hover and focus, dismisses on Escape |
| Bottom | default | above the container | 69 × 59.77 | same | same |
| Right | default | left of the container | 79.77 × 49 | same | same |
| Left | default | right of the container | 79.77 × 49 | same | same |

### Navigation tokens

Every literal the Navigation pages use, mapped once; the variant tables below refer to these names. The Figma MCP seat capped mid-run, so `TabHorizontal` was read from the Figma web client's Properties panel (view seat) instead of `get_design_context`; its values are the panel's, not inferred from `TabVertical`.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FCFCFC` active tab label and underline, button text, logo disc | Neutrals/Snow | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#FF2D55` Create button fill, notification dot | Primary/Primary | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` |
| `rgba(255,255,255,.4)` resting tab label, Sign-in border | Transparencies/White 40 | `--ui-designer-checkbox-border` | missing (`--transparent-gray-light` is .23) |
| `rgba(255,255,255,.1)` tab hover fill | Transparencies/White 10 | `--ui-designer-control-selected-bg` (menu rows), `--ui-designer-control-border` | missing (`Navbar` paints `#ffffff0d`, White 5) |
| `rgba(255,255,255,.2)` Create split divider | Transparencies/White 20 | `--ui-designer-control-border-strong` | missing (`CreateButton` carries the literal) |
| `#A14BF3` avatar disc behind the placeholder snapshot | Rarities/Legendary | missing | missing; a wearable-rarity colour, not a navigation token — the real avatar decides |
| 12px radius | — | `--ui-designer-radius-menu` | missing (`--mui-shape-borderRadius` is 6px; `CreateButton` and `UserMenu` carry the literal) |
| 100px pill radius (logo, avatar, dot) | — | missing | missing |
| 2px active indicator (bottom on horizontal, right on vertical) | — | literal | literal |
| Inter 20 / 600 / 100% | `H4 Semi` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |
| Inter 16 / 600 / 100% uppercase | `H6 Semi Caps` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |

### Main Navigation (Header)

Set [`10394:80156`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-80156), 2 variants (`Signed In=On` / `Off`), no interaction states drawn on the bar itself; the tabs it embeds are TabHorizontal below, rendered 70 tall. Shared chrome: 1920 × 100, padding 0 / 32, `space-between`, no fill, border or shadow; left group gap 26 (logo disc, then the tab bar at gap 40); right group gap 10 (Create split button, a 37px vertical divider, the account control). Code: Creator Hub `Navbar` (`Header` + `LogoMenu` + `.menu-item` + `CreateButton` + `Header/UserMenu`); inspector none.

| Part | Variant | Fill | Border | Radius | Typography | Size / spacing | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Logo disc | both | Snow, logo glyph inset (SVG asset) | none | 100px | — | 40 × 40 | disc vs `#16141a` 17.81:1 | `<button aria-label>`; `LogoButton` matches at 40px, adds a 2px white hover outline and a `--dcl` focus ring Figma does not draw |
| Tab bar | both | none | none | — | `H4 Semi`, White 40 at rest | 70 tall, gap 40, tab padding 0 / 4 | see TabHorizontal | `<nav>`; `Navbar` uses gap 8 and tab padding 19 / 16 / 17 — drift |
| Create (label half) | both | Primary | none | 12px, on the outer row | `H6 Semi Caps` Snow, line-height 22 | 40 tall, padding 0 / 14, gap 6, icon 18 | Snow on Primary 3.55:1 — **fails 4.5:1** (16px / 600 is not large text); Primary Dark 1 4.08:1 also fails | `<button>`; `CreateButton` matches geometry and paints hover `#F70038` as a literal |
| Create (menu half) | both | Primary | 1px White 20 left | 12px, on the outer row | chevron 8.5 × 5 Snow | 40 × 40 | divider on Primary 1.20:1, decorative; chevron 3.55:1 (≥ 3:1 non-text) | `aria-haspopup="menu"`, `aria-expanded`, `aria-label`; `CreateButton` matches |
| Divider | both | — | 37px vertical hairline (SVG asset; stroke colour not exposed by the MCP) | — | — | 0 × 37 | — | `aria-hidden`; `Navbar` has none |
| Account | Signed In=On | Legendary `#A14BF3` under the avatar snapshot | none | 100px | — | 40 × 40 | placeholder disc vs page 4.19:1; the real avatar decides | `<button aria-label>`; `UserMenu` renders the avatar at 44px — drift |
| Account | Signed In=Off | none | 1.5px White 40 | 12px | `H6 Semi Caps` Snow, "sign in" | 40 tall, padding 12 / 24 | text 17.81:1; border 3.83:1 (≥ 3:1) | `<button>`; `UserMenu` paints 1px `--transparent-gray-light`, padding 7 / 16 — drift |
| Create, Sign in | ✱ hover / press / focus / disabled | not drawn on this page; take them from Buttons (Inputs page) when it is extracted | — | — | — | — | — | — |

### TabHorizontal (Tabs)

Set [`10394:70307`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-70307), 6 variants (Active × Hover × Notification, Menu `-`; the page labels Notification "UNUSED"). Shared: 48 Hug × 75 Fill, vertical flow, padding 0 / 4, label `H4 Semi` centred, no radius, no shadow. Code: Creator Hub `Navbar .menu-item` (20px / 500 `#716b7c` rest, `#ffffff0d` hover, `--text` + 2px white bottom border active — drift on weight, rest colour and hover alpha); inspector `ModeSwitcher` and `.ui-designer-right-rail-tab` (36px band, 12px / 11px labels, 50% white rest: a documented deviation, since at those sizes White 40 misses 4.5:1).

| Variant | State | Fill | Border | Label | Badge | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active=False, Hover=False, Notification=False | default | none | none | White 40 | — | label 3.84:1 on `#161518`, 3.83:1 on `#16141a`, 3.74:1 on `#242129` — passes only as large text (20px / 600 ≥ 18.66px bold ⇒ 3:1); any smaller rendering needs ≥ 4.5:1 | `role="tab"` in a `role="tablist"`, or `<a aria-current="page">` for routes; hit target 48 × 75 |
| Active=False, Hover=True, Notification=False | hover | White 10 | none | White 40 | — | label over the fill 3.53:1 on `#161518`, 3.29:1 on `#242129` — large-text pass; fill vs surface 1.31:1, the label carries the state | — |
| Active=False, Hover=False, Notification=True | default | none | none | White 40 | 8 × 8 Primary dot, 100px, top ≈ 24 / right ≈ 0 (read off the canvas at 1:1, ±2px) | dot 4.99:1 (≥ 3:1 non-text) | the dot needs text: `aria-label="Scenes, 1 notification"` or a visually hidden count |
| Active=True, Hover=False, Notification=False | active | none | 2px Snow bottom | Snow | — | label and underline 17.73:1 | `aria-selected="true"` or `aria-current="page"` |
| Active=True, Hover=True, Notification=False | active + hover | White 10 | 2px Snow bottom | Snow | — | label over the fill 13.53:1 | — |
| Active=True, Hover=False, Notification=True | active | none | 2px Snow bottom | Snow | 8 × 8 Primary dot as above | dot 4.99:1 | as above |
| any | ✱ focus | — | — | — | — | ring on `#161518`: `--border-focused` 4.34:1, `--ui-designer-control-accent` 8.13:1; Creator Hub ui2 `palette.info.light` 8.13:1 (≥ 3:1) | `:focus-visible` outline 2px, offset −2px, as `ModeSwitcher` does |
| any | ✱ disabled | — | — | — | — | — | not drawn; `Navbar` omits an unavailable entry instead of greying it — keep that, no disabled style |

### TabVertical (Tabs)

Set [`20902:5640`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20902-5640), 6 variants, same axes as TabHorizontal. Shared: 80 × 75, column flow, `justify-content: center`, `align-items: flex-start`, padding 0 / 20, label `H4 Semi` left-aligned, no radius, no shadow; the active indicator moves to a 2px Snow right border and the badge sits at top 22 / right 9. Code: Creator Hub `Modals/TabsModal` (MUI `Tabs orientation="vertical"`; `.TabsModalTab` is 42px min-height, 600 uppercase, `--text-on-secondary` rest, `rgba(255,255,255,.8)` hover, selected `--dcl` text on `--darker-gray` with MUI's own indicator — drift: Figma selects with Snow and a right border, not Primary); inspector none.

| Variant | State | Fill | Border | Label | Badge | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active=False, Hover=False, Notification=False | default | none | none | White 40 | — | as TabHorizontal: 3.84:1 / 3.74:1, large-text pass only | `role="tab"` in a vertical `role="tablist"` (`aria-orientation="vertical"`, Up/Down arrows); hit target 80 × 75 |
| Active=False, Hover=True, Notification=False | hover | White 10 | none | White 40 | — | 3.53:1 / 3.29:1 over the fill, large-text pass | — |
| Active=False, Hover=False, Notification=True | default | none | none | White 40 | 8 × 8 Primary dot, 100px, top 22 / right 9 | dot 4.99:1 | badge text as TabHorizontal |
| Active=True, Hover=False, Notification=False | active | none | 2px Snow right | Snow | — | 17.73:1 | `aria-selected="true"` |
| Active=True, Hover=True, Notification=False | active + hover | White 10 | 2px Snow right | Snow | — | 13.53:1 over the fill | — |
| Active=True, Hover=False, Notification=True | active | none | 2px Snow right | Snow | 8 × 8 Primary dot as above | dot 4.99:1 | as above |
| any | ✱ focus / disabled | as TabHorizontal | — | — | — | — | — |

### Surfaces tokens

Every literal the Surfaces pages use (Accordion, Background, Cards, Menu, Icons, Modals, Scrollbar, Sections Titles, TitleBar, Profile Snapshot), mapped once. The Figma MCP seat was spent, so every value here is the Figma web client's Properties panel read through the DOM (October 19, 2026); the only canvas measurements are labelled as such. Contrast is against inspector `#161518`, Creator Hub page `#16141a`, or the fill named in the row.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FCFCFC` titles, labels, values, button text | Neutrals/Snow | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#CFCDD4` accordion body, thumbnail fallback | Neutrals/Gray | `--ui-designer-text-value` | ui2 `neutral.gray4`; `theme.css` missing |
| `#A09BA8` card meta, menu glyphs, section label | Neutrals/Silver | `--ui-designer-text-muted`, `--neutral-grey-3` | `--dcl-silver`, `--clear-divider` · ui2 `neutral.gray3` |
| `#FFFFFF` icon glyphs | Neutrals/White | `--white` | `--white`, `--text` |
| `#43404A` menu row hover | Neutrals/Pale Black | `--gray-0` | `--dark-gray` · ui2 `neutral.gray0` |
| `#35333B` menu fill | Neutrals/Onix (swatch) | `--ui-designer-control-bg` | missing |
| `#FF2D55` primary button, D7 retention value | Primary/Primary | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` |
| `#C640CD` smart-item icon disc | Brand/Lavender | `--lavender`, `--smart-item-icon-bg-color` | missing |
| `rgba(255,255,255,.05)` card and accordion-row rest fill | not a Figma step (unnamed `#FFFFFF` 5%) | `--ui-designer-control-empty-bg` | `--transparent-gray-dark` |
| `rgba(255,255,255,.1)` card border, accordion rules, menu border and rule, secondary button fill | Transparencies/White 10 | `--ui-designer-control-border`, `--ui-designer-control-selected-bg` | missing (`PublishedProjectCard` paints `--transparent-gray-dark`, White 5) |
| `rgba(255,255,255,.15)` card hover fill | not a Figma step (unnamed `#FFFFFF` 15%) | missing | missing (`Tutorials` hovers with `.1`) |
| `rgba(255,255,255,.2)` location divider | Transparencies/White 20 | `--ui-designer-control-border-strong` | missing |
| `rgba(255,255,255,.4)` chevrons, kebab glyph, group label | Transparencies/White 40 | `--ui-designer-checkbox-border` | missing (`--transparent-gray-light` is .23) |
| Ruby → Lavender favourite star | Gradients/Cerise | missing | missing |
| `#6141A6 → #6C84FF` credits coin (+ white drop shadow, `#5600FF` 50% inner shadow) | — (illustration, not a variable) | missing; ship as an SVG asset | missing; ship as an SVG asset |
| `#302C37` page boards | — (Figma presentation only) | not a surface | not a surface |
| 8px radius (menu row) | — | missing (`--ui-designer-radius-field` is 6px) | missing (`--mui-shape-borderRadius` is 6px; `SceneList` carries the literal) |
| 12px radius (menu, published thumbnail, CTA buttons, grouped accordion) | — | `--ui-designer-radius-menu` | missing (`UserMenu` carries the literal) |
| 16px radius (cards, card thumbnails) | — | missing | missing (`Tutorials` carries the literal) |
| 100px pill (kebab button) | — | missing | missing |
| `0 4px 8px rgba(0,0,0,.4)` menu shadow | — | missing (`--contexify-menu-shadow` is `2px 2px 10px rgba(0,0,0,.5)`) | missing (ui2 `MuiPaper` elevation) |
| Inter 20 / 600 / 100% | `H4 Semi` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |
| Inter 16 / 600 / 100% uppercase | `H6 Semi Caps` | `--font-family` + literal size | same |
| Inter 14 / 600 / 100% | `H7 Semi` (the CTA label is the same face uppercase, unnamed) | `--font-family` + literal size | same |
| Inter 14 / 400 / 100% | `H7 Regular` | `--font-family` + literal size | same |
| Inter 14 / 400 / 150%, cap-height trim | unnamed (location and privacy meta) | `--font-family` + literal size | same |
| Inter 12 / 400 / 100% | `H8 Regular` (the section label is the same face uppercase, unnamed) | `--font-family` + literal size | same |
| `#181225` modal fill | — (a raw hex on every modal, not a variable) | missing (`--modal-content-bg-color` resolves to `--tree-bg-color` `#161518`) | missing (`--modal` `#242129`, the ui2 `Modal` paper) |
| `#000000` title-bar fill | Neutrals/Black | `--black`, `--base-21` | `--bg-inspector` |
| `#2D2A33` toolbar icon and split buttons, toolbar tooltip | Neutrals/Onix Dark 1 | missing | `--title-bar-button` |
| `#25212A` AI-toggle hover, button-table board | Neutrals/Charcoal | `--ui-designer-panel-bg` is `#242129` — documented deviation (1/255) | `--darker-gray`, `--card`, `--modal` `#242129` — same 1/255 deviation |
| `#244B7D` AI-toggle selected | System/Blue Dark 2 | `--palette-system-blueDark2` | `--ai-session-selected` |
| `#243852` AI-toggle selected + hover | System/Blue Dark 3 | `--palette-system-blueDark3` | `--ai-session-selected-hover` |
| `#FF6280` publish split-button hover | Primary/Primary Light 1 | `--palette-primary-light` | `--primary-hover` `#ff6280` (the editor header actions hover to it) |
| `#5E5B67` `.dcl.eth` suffix | Neutrals/Graffito | missing | `--light-gray` |
| `#34CE77` online dot | System/Green | `--success-main` `#34ce77` (same value) | `--success` |
| `#FE9C2A` away dot | System/Orange | missing | `--danger` `#fe9c2a` (same value) |
| `#28AC00` online dot on the 28px avatar only | DCL/Grass (a legacy-library variable, shown with `?` in the panel) | missing | missing — Figma drift, see ProfilePic |
| `#FF0000` blocked ring | DCL/Red (legacy) | `--error-main` is `#fb3b3b`, not the legacy `#FF0000` | `--error` `#fb3b3b` |
| `#FF4BED` @ 30% + layer blur 500 modal glow | DCL/Rarities/Mythic (legacy) | missing | missing |
| `#FFD079 → #DA36FF` AI sparkle gradient | — (raw linear gradient) | missing | missing (`components/Icons/AssistantIcon` paints its own gradient) |
| `rgba(0,0,0,.2)` modal title-bar fill | Transparencies/Black 20 | `--contexify-separator-color` (same value, a react-contexify role) | missing |
| `rgba(0,0,0,.4)` scrollbar handle | Transparencies/Black 40 | missing | missing |
| `rgba(0,0,0,.6)` modal close button | Transparencies/Black 60 | `--modal-overlay-bg-color` (same value, the overlay role) | missing (`--dimmer` is `#000000dd`) |
| `rgba(255,255,255,.6)` scrollbar handle border, verification expiry text | Transparencies/White 60 | missing | missing |
| 24px radius (modals) | — | missing | missing (ui2 `Modal` paper is 12px) |
| 100px pill (modal close, radio, avatar ring, scrollbar handle) and 9999px (BackCTA, title Tag) | — | missing | missing (`EditorPage` and `Title` carry `100%`) |
| 34px pill (scene status chip) | — | missing | missing |
| 5px radius (16px checkbox) | — | missing | missing |
| 6px radius (attach button) | — | `--ui-designer-radius-field` | `--mui-shape-borderRadius` |
| `0 4px 4px rgba(0,0,0,.1)` toolbar tooltip shadow | — | missing | missing (ui2 `Tooltip`) |
| Inter 100 / 600 / 100% | unnamed (sign-in verification number) | `--font-family` + literal size | same |
| Inter 48 / 600 / 100% | `H0 Semi` | `--font-family` + literal size | same |
| Inter 48 / 400 / 117% | `typography/h3` (legacy name; `.dcl.eth`) | `--font-family` + literal size | same |
| Inter 24 / 600 / 100% | `H2 Semi` | `--font-family` + literal size | same |
| Inter 18 / 400 / 100% | `H5 Regular` | `--font-family` + literal size | same |
| Inter 16 / 600 / 100% | `H6 Semi` | `--font-family` + literal size | same |
| Inter 16 / 400 / 100% | `H6 Regular` | `--font-family` + literal size | same |
| Inter 16 / 600 / 22px uppercase | unnamed (modal and section-title CTA labels) | `--font-family` + literal size | same |
| Inter 14 / 600 / 100% uppercase | `H7 Semi Caps` (snackbar action) | `--font-family` + literal size | same |
| Inter 13 / 600 / 24px, 0.46px tracking, uppercase | `button/small` (legacy; toolbar split buttons) | `--font-family` + literal size | same |

### AccordionEntry (Accordion)

Set [`20932:3939`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20932-3939), 3 variants (`Property 1` = Default / Hover / Expanded). Shared: Fill width (596 in the set), header row 50 tall, padding 0 / 20, gap 20, chevron 12.25 box (Vector 11.23 × 6.63 White 40, rotated −90° closed, 180° open), label `H7 Semi` Snow, 1px White 10 bottom rule, no radius, no shadow. Code: inspector `ui/Accordion` (4px radius, padding 12 / 8, 12px / 500 uppercase label on `--text-light`, which no stylesheet defines (it resolves to the inherited colour), `--base-14` border, open header rule `--base-12` — drift on every value); Creator Hub `Modals/AppSettings/Tabs/AiTab` hand-rolled `SettingsAccordion` (MUI-generated `--mui-palette-divider` top rule, 13px title; no ui2 `Accordion` in use) — drift.

| Variant | State | Fill | Border | Chevron | Body | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | collapsed | none | 1px White 10 bottom | right (−90°), White 40 | — | 596 × 50 | label 17.73:1 on `#161518`, 17.81:1 on `#16141a`; chevron 3.83:1 (≥ 3:1 non-text); rule 1.32:1, decorative | header is a `<button aria-expanded="false" aria-controls>`; hit target 50 tall, full width |
| Hover | collapsed + hover | White 5 (unnamed) | 1px White 10 bottom | right, White 40 | — | 596 × 50 | fill vs surface 1.13:1 — the fill alone does not announce the state; label over it 15.67:1 | — |
| Expanded | open | none | 1px White 10 bottom, on the Description row | down (180°), White 40 | `Description` row: Fill × Hug 37, padding 0 / 20 / 20, `H7 Regular` Gray, 17 tall | 596 × 88 (50 + 37 + rule) | body 11.55:1 / 11.61:1 | `aria-expanded="true"`; body is `role="region" aria-labelledby` the header |
| any | ✱ expanded + hover | White 5 on the header row only | — | — | — | — | as Hover | — |
| any | ✱ focus | — | — | — | — | — | ring on `#161518`: `--border-focused` 4.34:1, `--ui-designer-control-accent` 8.13:1; Creator Hub ui2 `palette.info.light` 8.13:1 | `:focus-visible` outline 2px, offset −2px, on the header button |
| any | ✱ disabled | — | — | White 20 chevron | — | — | not drawn; `ui/Accordion` dims to `opacity: .7` — keep that until Figma draws one | `aria-disabled="true"`, still focusable |

### LabelAccordion (Accordion)

Component [`20932:5388`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20932-5388), 1 variant: a group label over a bordered stack of AccordionEntry instances. Column, 638 wide, gap 10. Code: inspector none; Creator Hub none (`DocsPage` lists FAQ-style links without a disclosure).

| Part | State | Fill | Border | Radius | Typography | Size / spacing | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Label (`create`) | default | none | none | — | `H6 Semi Caps` White 40 | 638 × 19 | **3.83:1 on `#161518` and `#16141a` — fails 4.5:1** (16px / 600 is not large text); Silver would pass at 6.71:1 — the user picks | `<h3>` or the group's `aria-labelledby` target |
| Questions (group) | default | none | 1px White 10 all sides | 12px | — | Fill × Hug 139; entries inside are AccordionEntry at 638 wide (header text 563.75) | border 1.32:1, decorative | `role="group"`; entries keep their own button semantics |
| Entries | collapsed / open | as AccordionEntry | last entry keeps its 1px bottom rule inside the 12px frame | — | header `H7 Semi` Snow, body `H7 Regular` Gray | header 50 tall | as AccordionEntry | as AccordionEntry |

### Background (Background)

Component [`20506:31427`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20506-31427), 1 variant and no component set: the page has only this frame plus its title. Code: Creator Hub `theme.css` `.Main` paints `assets/images/background.png` over `#242129` with `background-blend-mode: overlay` — the same raster role, a different overlay; inspector none (the editor paints `--base-20`).

| Name | Fill | Overlay | Size | Usage | Contrast |
| --- | --- | --- | --- | --- | --- |
| Background | raster `image.png` — a near-black field with a violet glow bottom-left and a dark-blue glow left (no gradient stops: it is a bitmap, not a Figma gradient) | solid `#000000` 20% | 1720 × 1080, no radius | the app canvas behind cards and pages | text is specified against the solid page colours above; the raster's darkest region reads as `#0a0712`-ish and its glow as `#1d1033`-ish (canvas measurement, ±8 per channel) — treat `#16141a` as the design surface and keep Snow / Silver text ≥ 4.5:1 there |
| ✱ Page board | `#302C37`, 64px radius, padding 100 | — | 1920 × Hug | Figma presentation frame on every Surfaces page, not a product surface | — |

### Scene-Card (Cards)

Set [`20910:7527`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7527), 2 variants (Default / Hover). Shared: column, 416 × 383, 16px radius; `Thumbnail` 416 × 273, 16px radius, image fill; `Text` block Fill × 110, padding 20, gap 10; title `H4 Semi` Snow (376 × 24); `Parcels` row 316.25 × 32, gap 10, a 16px `layout` glyph (Vector 12 × 12 Silver) and `N Parcels` `H7 Regular` Silver. Code: Creator Hub `SceneCard` (`#313131` literal fill, 10px radius, 260 tall, 18px / 600 title, 14px meta — drift on fill, radius, size and type) and `ProjectCard` (`--secondary` fill, 10px radius, 2px white hover border, `#a09ba8` meta literal — drift); inspector none.

| Variant | State | Fill | Border | Kebab | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 (unnamed) | 1px White 10 all sides | — | title over the fill 15.77:1 on `#16141a`; meta 5.97:1 (≥ 4.5:1); glyph 5.97:1; fill vs page 1.13:1 and border 1.31:1 — the card edge is weak, the thumbnail carries it | the whole card is one `<a>` / `<button>` named by the title; hit target 416 × 383 |
| Hover | hover | White 15 (unnamed) | none | `rounded-button-contained` 40 × 40, 100px, no fill, `Kebab` 24 box, Vector 4 × 20 White 40, top-right of the Text block | title 11.43:1; **meta 4.33:1 — fails 4.5:1 on hover** (Silver 14px / 400 over White 15); kebab 3.29:1 (≥ 3:1 non-text) | kebab is a separate `<button aria-label="Scene options" aria-haspopup="menu">`, 40px hit target, must also appear on focus-within, not only on hover |
| any | ✱ focus | as Hover | — | — | ring ui2 `palette.info.light` 8.13:1 | `:focus-visible` outline 2px on the card; kebab gets its own ring |
| any | ✱ press | White 10 | — | — | — | — |
| any | ✱ disabled | — | — | — | not drawn; keep cards enabled or omit them | — |

### Template-Card (Cards)

Set [`20910:7545`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7545), 2 variants (Default / Hover). Identical to Scene-Card except the meta line is a subtitle (`H7 Regular` Silver, 376 × 36, "Start your own scene from scratch") and the hover button carries `CodeBash` (Vector 21.2 × 10.45 White). Code: Creator Hub `TemplatesPage` → `ProjectCard` (drift as above); inspector none.

| Variant | State | Fill | Border | Button | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 | — | title 15.77:1; subtitle 5.97:1 | card is one link / button |
| Hover | hover | White 15 | none | 40 × 40 pill, `CodeBash` glyph White | subtitle 4.33:1 — fails 4.5:1 on hover, as Scene-Card; glyph 11.43:1 | `<button aria-label="Open in code">`, 40px hit target, visible on focus-within |
| any | ✱ focus / press / disabled | as Scene-Card | — | — | — | — |

### Learn-Video-Card (Cards)

Set [`20910:7560`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7560), 2 variants (Default / Hover). Same chrome as Scene-Card; thumbnail is the video poster (`Flag Tag.png` placeholder); title `H4 Semi` Snow "Video Tutorial"; subtitle two lines `H7 Regular` Silver (376 × 36); no hover button. Code: Creator Hub `VideosPage` → `Tutorials` (`.Tutorial`: 16px radius, transparent rest, hover `rgba(255,255,255,.1)`, padding 12, 2px `--transparent-gray-light` poster border, 16px / 500 title, `#a09ba8` literal — drift on rest fill, hover alpha, padding and type); inspector none.

| Variant | State | Fill | Border | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 | title 15.77:1; subtitle 5.97:1 | card is one `<a>` to the video, named by the title |
| Hover | hover | White 15 | none | subtitle 4.33:1 — fails 4.5:1 on hover | — |
| any | ✱ focus / press | as Scene-Card | — | — | — |

### Learn-Doc-Card (Cards)

Set [`20910:7636`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7636), 2 variants (Default / Hover). Column, 416 × 210, 16px radius; `Thumbnail` 100 tall (210 − the 110 Text block; derived, not read) with a centred `Favorite` star (Vector 41.13 × 41.13, fill Gradients/Cerise Ruby → Lavender); title `H4 Semi` Snow "Doc Title"; subtitle one line `H7 Regular` Silver. Code: Creator Hub `DocsPage` (link list, no card); inspector none.

| Variant | State | Fill | Border | Star | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 | Cerise gradient | title 15.77:1; subtitle 5.97:1; star Ruby end 4.44:1, Lavender end 3.86:1 over the fill (≥ 3:1, and decorative) | card is one `<a>` named by the title; star `aria-hidden` |
| Hover | hover | White 15 | none | same | subtitle 4.33:1 — fails 4.5:1 on hover | — |
| any | ✱ focus / press | as Scene-Card | — | — | — | — |

### Published-Scene-Card (Cards)

Set [`20964:6705`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20964-6705), 2 variants (Default / Hover), under the page's `<Analytics>` label. Shared: column, 852 × 214, 16px radius, gap 20; `Information` padding 20, gap 20; `Header` row gap 20: `Thumbnail` 100 × 100, 12px radius, Gray fallback fill under a Snow `Img` placeholder, then a column (padding-right 280, gap 6) with `Scene's Name` `H4 Semi` Snow and a `Location` row (gap 4, 6px radius): `MapPin` 16 box (Vector 10.5 × 12.83 Silver) + `worldname` Inter 14 / 400 / 150% Silver, a `Div` 1px White 20 vertical 14 tall, `Private` lock (same Vector) + "Private" Inter 14 / 400 / 150% Silver (padding 5 / 0). `Analytics` row gap 20: five `Fill × 54` columns (gap 6) of label `H7 Regular` Silver over value `H4 Semi` Snow — Concurrent Users, Daily Active Users, D7 Retention (value Primary), Revenue (`credits-icon` 24 box + value), Avg. Playtime ("min"). Code: Creator Hub `ManagePage/PublishedProjectCard` (10px radius, `--transparent-gray-dark` White 5 fill, padding 8 / 8 / 8 / 16, 14px `--light-gray` meta — drift on radius, padding and meta colour) and `AnalyticsPage`; inspector none.

| Variant | State | Fill | Border | CTAs | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 all sides | — | name 15.77:1; labels and location 5.97:1; D7 value Primary 4.44:1 (20px / 600 ⇒ large text, ≥ 3:1); divider 1.87:1, decorative; thumbnail fallback Gray vs fill 10.27:1 | `<article aria-labelledby>` the name; stats as a `<dl>`; "0%" in Primary needs a text cue, not colour alone |
| Hover | hover | White 15 | 1px White 10 all sides (kept, unlike the home cards) | `CTAs` 257 × 40, gap 10, top-right: `Button-Contained-Text` Secondary 98.5 × 40, 12px, padding 11.5 / 24, White 10 fill, "DETAILS" Inter 14 / 600 uppercase Snow; Primary same with Primary fill, "EDIT"; kebab pill 40 × 40, Vector 4 × 20 White 40 | labels 4.33:1 — fails 4.5:1 on hover; DETAILS 8.38:1; **EDIT Snow on Primary 3.55:1 — fails 4.5:1** (same finding as the Create button); D7 value 3.22:1 large-text pass; kebab 3.29:1 | CTAs are `<button>`s, 40px tall, visible on focus-within; kebab `aria-label` + `aria-haspopup="menu"` |
| any | ✱ focus / press | as Scene-Card | — | — | — | — |

### Menu-Entry (Menu)

Set [`20749:790`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20749-790), 4 variants (`Property 1` = Default / Hover / Section / Div). Shared: row, Fill × 38 (240 in the set, 180 inside Menu), 8px radius, padding 0 / 10, gap 10. Code: inspector `Hierarchy/ContextMenu`, `CustomAssets/ContextMenu` and `hoc/withContextMenu` (react-contexify on `--contexify-*`: VS Code `--dropdown-bg-color` `#d8d8d8` light fill, 2px radius, 6px item padding, `--contexify-activeItem-radius` 4px — drift on every value, it is the embedded-webview theme) and the UI Designer menus (`--ui-designer-control-bg` Onix, `--ui-designer-control-selected-bg` White 10 rows, `--ui-designer-radius-menu` 12px — closest); Creator Hub `Dropdown` and `Header/UserMenu` (ui2 `Menu` / `MenuItem`, MUI defaults, 200px list, glyphs `--text-on-secondary`) — drift.

| Variant | State | Fill | Leading | Label | Trailing | Size | Contrast (on Onix) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | none | `Info` 16 box, Vector Silver | `H8 Regular` Snow (174 × 15) | `arrow-right` 10 box, Vector 9.17 × 5.42 White 40 | 240 × 38 | label 12.13:1; glyph 4.59:1 (≥ 3:1); chevron 3.38:1 | `role="menuitem"` in a `role="menu"`; 38px hit target; submenu chevron ⇒ `aria-haspopup="menu"` |
| Hover | hover / keyboard active | Pale Black | same | same | same | 240 × 38 | fill vs Onix 1.23:1 — weak; label over it 9.88:1, glyph 3.74:1, chevron 3.06:1 (≥ 3:1) | the keyboard-active item uses the same fill plus the focus ring below |
| Section | — | none | — | Inter 12 / 400 uppercase Silver (220 × 15), gap 16 | — | 240 × 38 | 4.59:1 (≥ 4.5:1, barely; 12px / 400 is small text) | `role="presentation"` heading or `aria-label` on the group; not focusable |
| Div | — | White 10, 1px tall | — | — | — | 240 × 1 (padding 7 / 10 ⇒ 15px of rhythm) | 1.37:1, decorative | `role="separator"` |
| Default | ✱ focus | Pale Black | — | — | — | — | ring `--border-focused` 2.97:1 on Onix and 2.42:1 on the Pale Black row — **below 3:1**; `--ui-designer-control-accent` 5.56:1 / 4.53:1 passes; Creator Hub ui2 `palette.info.light` 5.56:1 / 4.53:1 | `:focus-visible` outline 2px, offset −2px, inside the row |
| Default | ✱ press | White 10 over Pale Black | — | — | — | — | — | — |
| Default | ✱ disabled | none | Silver @ .4 | White 40 label | — | — | label 3.38:1, glyph 1.92:1 — disabled content is exempt from the minimums | `aria-disabled="true"`, stays in the tab order of the menu |

### Menu (Menu)

Component [`20749:386`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20749-386), 1 variant, two `Options` / `Options2` slots (each Fill × Hug, padding 0 / 10, holding Menu-Entry instances) around a Div entry. Code: as Menu-Entry — inspector react-contexify (`--contexify-menu-shadow` `2px 2px 10px rgba(0,0,0,.5)`, `--contexify-menu-padding` 6px) and the UI Designer popovers; Creator Hub ui2 `Menu` (MUI `Paper` elevation on `background.paper`).

| Part | State | Fill | Border | Radius | Shadow | Size / spacing | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Container | open | Onix | 1px White 10 all sides | 12px | `0 4px 8px rgba(0,0,0,.4)` | 200 × Hug (117 with one entry per slot), padding 10 / 0, gap 10 | Onix vs `#161518` 1.46:1, vs `#242129` 1.27:1 — the shadow and border carry the edge | `role="menu"` with `aria-labelledby` the trigger; Escape closes, arrows move, focus returns to the trigger |
| Options / Options2 | — | none | none | — | — | Fill × Hug, padding 0 / 10 | — | `role="group"` when a Section labels it |
| Div | — | as Menu-Entry Div | — | — | — | between the slots | — | `role="separator"` |

### Icon system (Icons)

Three frames, no component sets: `General` [`20450:16492`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20450-16492), `Editor` [`20798:7431`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20798-7431), `Component Icons` [`20798:7736`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20798-7736); each is a Pale Black board (64px radius, 2px White 10 border, padding 100, gap 50) holding one wrapping row of icon components. Every glyph is a filled vector (no strokes), so `fill="currentColor"` carries the colour and the skill's viewBox gotcha applies: crop each export to its 24px frame, never to the glyph bounds, or the 4px inset is lost and the icon renders ~30% larger than its neighbours. Code: Creator Hub `components/Icons` (3 custom: `AssistantIcon`, `ChevronDownIcon`, `WarningCircleIcon`) plus `@mui/icons-material` (124 distinct icons across 52 files) and `assets/images/*.svg`; inspector `components/Icons` (`Cleanup`, `CustomAsset`, `Folder`, `ListChevrons`, `Search`) plus `react-icons` (72 files; `vsc`, `io5`, `ai` sets) and per-panel `icons/` folders (Hierarchy, Toolbar/Gizmos, AssetsCatalog, SceneInspector, UIDesigner PropertyPanel). Figma names already in the repo: `Cleanup`, `Search`, `CustomItem` (inspector `CustomAsset`), `BrowseFolder` (inspector `Folder`); everything else is Material or react-icons today.

| Set | Count | Frame | Glyph | Colour | Naming | Row layout | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- |
| General | 82 — Windows, Apple, LocalAssets, CustomItem, Synch, BrowseFolder, Cleanup, Cloud, Reload, Warning, bug, help, settings, Info, Search, Expand, Grid, magnet, player-location, zoom-out, zoom-in, keyboard, templates, Tip, podium, no-connection, Import-Download, Export-Upload, MapPin, Public, Private, Close, Likes, Create-Event, Edit, Link, LinkAlt, Cut, Copy, Paste, Duplicate, Favorite, Pin, Minus, plus, layout, layout-outline, Scenes, Kebab, ArrowUp, arrow-down, arrow-left, arrow-right, learn, code, DeleteFilled, Delete, Storage, Transfer, Code, Preview, CheckCompleted, Videos, Documents, Attach, DevWorkflow, BuildMetaverse, CodeBash, Cube, Leave, SceneStats, VariableBig, Hide, Show, Unlock, Lock, NewChat, Open, AiAgent, Optimize, CollapseVertically, ExpandVertically | 24 × 24 | 16 × 16 live area at 4 / 4 (Windows); tall glyphs reach 18 × 22 at 3 / 1 (MapPin) | Neutrals/White `#FFFFFF` → `--white` / `--white` | mixed PascalCase and kebab-case (`ArrowUp` beside `arrow-down`); `Edit` carries a `Vector (Stroke)` layer, `CollapseVertically` / `ExpandVertically` are 5-vector stacks | `Group 3163` 874 wide, wrap, gap 24 | White on `#161518` 18.19:1, on `#16141a` 18.28:1, on Pale Black 10.14:1 (≥ 3:1 non-text everywhere) |
| Editor | 17 — list-all, CameraHierarchy, Layers, search-cloud, Save, Camera, undo, redo, move, translation, rotate, scale, more-options, snap, AlignToWorld, Joystick, Edit | 24 × 24 | 12–14px glyphs off-centre by design (list-all `menu` 12 × 13.22 at 6 / 5.39; redo 10 × 9.38 at 7 / 7.31) | Neutrals/White | kebab-case verbs, PascalCase nouns | `Frame 3163` 831 wide, gap 10 | as General |
| Component Icons | 3 — smat-item (sic), Credits, JumpIn | smart-item 16 × 16, 5px radius; Credits 24 box; JumpIn 24 × 24, 8px radius | smart-item: Lavender disc under a White `Union` 8.4 × 12 (0.59 stroke); Credits: `#6141A6 → #6C84FF` coin at 80% with a white drop shadow and a `#5600FF` 50% inner shadow (an illustration); JumpIn: Vector 13.19 × 12 Snow | Lavender → `--lavender`, `--smart-item-icon-bg-color` / missing; Snow → `--ui-designer-text` / ui2 `neutral.softWhite` | product nouns | — | Lavender disc vs `#161518` 4.34:1, vs `#242129` 3.79:1 (≥ 3:1); White glyph on Lavender 4.19:1 (≥ 3:1 non-text) |

### DefaultModal (Modals)

Two instances, [`21183:30733`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21183-30733) (horizontal CTAs) and [`21196:31147`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21196-31147) (vertical CTAs), both named `DefaultModalButtonsHorizontal` under the labels `<DefaultModal> | Horizontal Stack Buttons` / `| Vertical Stack Buttons`; the main component is not on this page (the Modals page holds no component set). Shared: row, Hug 700 × Hug (413 horizontal, 479 vertical), fill `#181225`, 1px White 10 border, 24px radius, padding 100, gap 100; `Glow` 1037 × 513 Mythic @ 30% with layer blur 500 (decorative); `Content` column Fixed 500 × Hug, gap 50: title `H2 Semi` Snow (500 × 29), body `H6 Regular` Gray (500 × 38), `CTAs` gap 20 of two `Button-Contained-Text` 46 tall, 12px radius, padding 12 / 24, label Inter 16 / 600 / 22 uppercase Snow; `close-button` 46 × 46, 100px pill, Black 60 (`State` Default, `Hover Style` False) holding `Close` 27.6 box at 9.2 / 9.2 with a 16.1 Vector in Gray and a 0.3px Snow stroke. Code: Creator Hub `Modals/index.ts` `Modal` = ui2 `Modal` (paper `--modal` `#242129`, 12px radius, padding 24, widths 540 / 720 / 900, no border, no glow) and `Modals/WarningModal` (centred `--dcl-silver` message, 150px-min buttons, gap 16) — drift on fill, radius, border, padding and button size; inspector `components/Modal` (`--modal-content-bg-color` → `#161518`, `--tree-border-color` border, 3px radius, padding 20, min 500 × 200, overlay `--modal-overlay-bg-color`) — drift.

| Variant | State | Fill | Border | CTAs | Close | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Horizontal | default | `#181225` + glow | 1px White 10 | row, gap 20: `Secondary` (White 10 fill) "CANCEL" then `PrimaryBlocked` (Primary fill) "DELETE MOBILE", each Fill 240 × 46 | Black 60 pill, Gray glyph | title 17.77:1, body 11.58:1 on `#181225`; CANCEL 13.51:1 over White 10; **DELETE 3.55:1 Snow on Primary — fails 4.5:1** (16px / 600 is not large text); modal vs page `#16141a` 1.00:1 — only the 1.32:1 border and the glow separate it; close glyph 12.70:1, pill vs modal 1.10:1 | `role="dialog" aria-modal="true" aria-labelledby` the title, `aria-describedby` the body; focus trapped, Escape closes; close is `<button aria-label="Close">`, 46px target; Cancel first in DOM order |
| Vertical | default | same | same | column, gap 20: `PrimaryBlocked` "DELETE MOBILE" above `Secondary` "CANCEL", each Fill 500 × 46 | same | as Horizontal | primary action first in DOM order here — one order per platform, the user picks |
| any | ✱ hover / press | — | — | per the Buttons page | ✱ `Hover Style` True is drawn nowhere on this page — propose White 10 over Black 60 | — | — |
| any | ✱ focus | — | — | — | — | ring on `#181225`: `--ui-designer-control-accent` 8.15:1, `--border-focused` 4.35:1; Creator Hub ui2 `palette.info.light` 8.15:1 | `:focus-visible` outline 2px on every button; initial focus on Cancel |

### Help & Support Modal (Modals)

Component `Modal` [`20915:8417`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20915-8417), 1 variant (`Scrollview` Default), under the label `<Help&Support>`. Column, Fixed 800 × Hug 1049, fill `#181225`, 1px White 10, 24px radius, gap 50; `TitleBar` Fill 798 × 50, Black 20 fill, 1px White 10 bottom rule, padding 10 / 20 ("Help & Support" + `close-button`); `Glow` 824 × 257.5 Mythic @ 30% blur 500; `Scrollview` Fill × Hug 947, padding 0 / 80 / 50, gap 50, holding three `LabelAccordion` instances (GENERAL, CREATE, SUPPORT UPDATES), a `Frame 3220` row (Fill 638 × 17, gap 10, right-aligned) and a `Scrollbar` instance (14 × 860, Handle 14 × 560). Code: Creator Hub `Navbar/LogoMenu` lists Help and Report-bug items that open external links — no in-app modal; inspector none.

| Part | State | Fill | Border | Typography | Size / spacing | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TitleBar | default | Black 20 | 1px White 10 bottom | title `H6 Semi` Snow | 798 × 50, padding 10 / 20 | title 18.45:1 on the Black 20 composite `#130e1e`; fill vs modal 1.04:1, decorative | `<h2 id>` referenced by the dialog |
| Scrollview | default | none | none | per LabelAccordion | padding 0 / 80 / 50, gap 50 | per LabelAccordion (group label White 40 3.82:1 on `#181225` — fails 4.5:1, as on the Accordion page) | `overflow: auto` region; keyboard-scrollable (`tabindex="0"`) when the content overflows |
| Don't see your question above? | default | — | — | Inter 14 / 400 / 100% Snow, right-aligned | 314 × 17 | 17.77:1 | plain text |
| Speak with the Support Team | default | — | — | Inter 14 / 400 / 100% Primary, underline solid | 314 × 17 | **5.00:1 (≥ 4.5:1)** | `<a>` opening the support channel; the underline keeps it identifiable without colour |
| Scrollbar | default | as Scrollbar (Scrollbar) at 14 wide | — | — | 14 × 860, padding-bottom 300 | as Scrollbar | — |

### ReportBug (Modals)

Component `ReportBug` [`21196:31035`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21196-31035), 1 variant (`Scrollview` Modified), under the label `<ReportBug>`. Column, Fixed 800 × 700, fill `#181225`, 1px White 10, 24px radius, gap 50; `TitleBar` as Help & Support (title "Help & Support" — placeholder copy, not spec); `Glow`; `Scrollview` Fill 798 × Hug 590, padding 0 / 80 / 50, gap 50. Inputs belong to the Inputs run; their instance props are recorded here. Code: Creator Hub `Navbar/LogoMenu` report-bug item opens an external link — no in-app form; inspector none.

| Part | State | Component | Fill | Size / spacing | Typography | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dropdown-Input | `Property 1` Default | Inputs page | — | Fill 638 × Hug 102, gap 10 | title `H6 Semi` Snow "Issue Type", description | 17.77:1 | `<label for>` + `<select>` or listbox |
| Description | — | column of Text-Input + Button-Contained-Text-Icon | — | Hug 638 × 222, gap 10 | — | — | — |
| Text-Input | `Property 1` Default | Inputs page | — | Fixed 638 × 182, gap 10 | — | — | `<textarea aria-describedby>` |
| Button-Contained-Text-Icon (Attach) | `Property 1` Secondary, with overrides | Buttons page | **none** (Secondary's White 10 fill is overridden off) | Hug 257 × 30, 6px radius, padding 6 / 10, gap 10; `Attach` glyph 18 × 18, a 1.5px Transparencies/White 60 stroke | label "Paste, drop, or click to add files", `H7 Regular` Inter 14 / 400 / 100%, sentence case, Transparencies/White 60 | label 7.08:1 on `#181225` | `<button>` with a visible label; 30px tall clears the 24px floor. A dropzone affordance, not a styled Secondary button: code takes only its box for `Button size="small"` and keeps the Secondary paint and today's 13px white label (read in the browser, October 21, 2026) |
| Checkmark | `Property 1` On | Checkbox Secondary 20 box + consent text | — | Fill 638 × 20, gap 10 | `H7 Regular` Snow, right-aligned | text 17.77:1; check Primary 5.00:1, ring White 40 3.82:1 (≥ 3:1) | `<input type="checkbox">` with the sentence as its `<label>` |
| CTAs | — | row, gap 20 | — | Fill 638 × 46 | — | — | — |
| CANCEL | `Secondary` | Button-Contained-Text | White 10 | Fill 309 × 46, 12px, padding 12 / 24 | Inter 16 / 600 / 22 uppercase Snow | 13.51:1 | — |
| SUBMIT (disabled) | `PrimaryBlocked` @ 20% opacity | Button-Contained-Text | Primary at 20% | Fill 309 × 46 | same | fill vs modal 1.24:1; node opacity dims the label too: Snow at 20% composites to about `#464150`, 1.50:1 on the fill, 1.85:1 on the modal (browser capture, October 21, 2026) — the dim state reads as disabled by opacity alone | `disabled` + `aria-disabled`; the 20% opacity is the only disabled cue drawn, add a tooltip or helper text saying why |

### Secure-Sign-In (Modals)

Component [`20808:605`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20808-605), 1 variant. Row, Hug 1115 × Hug 650, fill `#181225`, 1px White 10, 24px radius, padding 100, gap 100; `Glow` 1037 × 513 Mythic @ 30% blur 500; `Text` column Fixed 500 × Hug 373, gap 40; `Image` 315 × 450 holding `padlock.png` (292 × 463 rotated −19°); `close-button` 46 pill Black 60 as DefaultModal. Code: Creator Hub `SignInPage` (a full page over `genesis_plaza.webp` with a `#491975` gradient, ui2 `Typography` h3 / h6 / body1, `--dcl-silver` reopen link; no verification-number view) — drift: the design is a modal with the code, the app is a page without it; inspector none.

| Part | State | Typography | Colour | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Secure Sign-in | default | `H0 Semi` 48 / 600 | Snow | 500 × 58 | 17.77:1 | `<h1>` / dialog label |
| A browser window should open… | default | `H5 Regular` 18 / 400 | Snow | 500 × 52 | 17.77:1 | — |
| 29 (verification number) | default | Inter 100 / 600 / 100% (unnamed) | Snow | 500 × 121 | 17.77:1 | `aria-live="polite"` region; read as digits |
| Expiration Counter | default | `H5 Regular` 18 / 400 "Verification number will expire in 08:25" + `Info` 20 box | White 60 | Hug 359 × 22, gap 9 | 7.08:1 (≥ 4.5:1) | the countdown is `aria-live="off"` with a static `aria-label` (a ticking live region would announce every second); `Info` is a `<button aria-label>` or decorative |
| Image | default | — | padlock raster, PNG export | 315 × 450 | — | `alt=""` |
| any | ✱ expired | — | ✱ Primary text "Verification number expired" + a retry link | — | Primary 5.00:1 | not drawn — the user decides the copy |

### Scrollbar (Scrollbar)

Component [`20931:3935`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20931-3935), 1 variant and no component set: a 16 × 860 row (gap 10, no track fill) holding `Handle` 16 × 860, 100px pill, Black 40 fill, 1px White 60 inner border. The Help & Support modal places it at 14 × 860 with a 560-tall handle and 300 bottom padding (the thumb proportion is placeholder, not spec). Code: Creator Hub `theme.css` global `::-webkit-scrollbar` (8px wide, track `--black`, thumb `--dcl-silver`, 4px radius) — drift on width, track, thumb colour and radius; inspector `UIDesigner.css` `.ui-designer-right-rail-tabpanel::-webkit-scrollbar` (8px, transparent track, thumb White 12 / hover White 22, 4px radius) — drift.

| Part | State | Fill | Border | Radius | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Track | default | none | none | — | 16 wide | — | native scrollbar; no ARIA |
| Handle | default | Black 40 | 1px White 60, inner | 100px | 16 wide × content ratio | fill vs `#181225` 1.07:1, vs `#16141a` 1.07:1 — the border carries it: White 60 7.08:1 on the modal, 7.10:1 on the page, 7.56:1 against the handle fill (≥ 3:1 non-text) | — |
| Handle | ✱ hover / drag | ✱ Black 60 | ✱ White 60 | — | — | — | not drawn; `::-webkit-scrollbar-thumb:hover` |
| any | ✱ 8px variant | — | — | — | — | — | not drawn — the editor's side rails use 8px today; the user decides whether 16px is the only width |

### TitleBar (Sections Titles)

Set [`10394:80020`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-80020), 3 variants (`Property 1` = Main Section / Sub-Section / Sub-Section+), under the `section-titles` board on the Sections Titles page. **Name collision:** the TitleBar page's set is the editor toolbar (`Editor Toolbar` below) and the modal header is also a `TitleBar` instance — this one is the page-section header; the user picks the code name. Shared: row, Fixed 1724 × Hug 58, title `H0 Semi` 48 / 600 Snow (102 × 58 for "Text"), `CTAs` Hug 298 × 40, gap 20: `Button-Contained-Text-Icon` `Terciary` (Hug 139 × 40, 12px radius, 1.5px White 40 border, padding 8 / 24, gap 10, `settings` 18 box White Vector + "ACTION" Inter 16 / 600 / 22 uppercase Snow) and `Primary` (same, Primary fill, no border). Code: Creator Hub `Title` (`.header` gap 16, `back.svg` 45 × 45, hover `--transparent-gray-dark` circle; title via ui2 `Typography`) and `EditableTitle` — drift on back-button size, chevron colour and title scale; `Subtitle-Navigation` below; inspector none.

| Variant | State | Leading | Title | Trailing | Size / spacing | Contrast (on `#16141a`) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main Section | default | — | `H0 Semi` Snow "Text" | CTAs | 1724 × 58, gap 32 | title 17.81:1; ACTION on Terciary 17.81:1, border White 40 3.83:1 (≥ 3:1); **ACTION on Primary 3.55:1 — fails 4.5:1**; glyph White 18.28:1 | `<h1>` or `<h2>` per page depth; CTAs are `<button>`s 40 tall |
| Sub-Section | default | `BackTitle` 40 × 40, 100px pill, no fill, `arrow-left` 18 box, Vector 16.5 × 9.75 Primary (0.5px Primary stroke) rotated 90° | `H0 Semi` Snow | CTAs | 1724 × 58, gap 16 | chevron Primary 5.01:1 (≥ 3:1 non-text) | back is `<button aria-label="Back">` (or `<a>` to the parent), 40px target |
| Sub-Section+ | default | BackTitle as above | `Label` row Hug 316 × 58: `H0 Semi` Snow "Text" + `.dcl.eth` `typography/h3` 48 / 400 / 117% Graffito (180 × 56) | `Copy` 34 box (Vector 27.63 White) then CTAs | 1724 × 58, gap 16 | **`.dcl.eth` Graffito 2.76:1 on `#16141a`, 2.39:1 on `#242129` — fails even the 3:1 large-text floor**; Silver would give 5.97:1 — the user picks; Copy glyph 18.28:1 | the suffix is part of the heading text, not `aria-hidden`; Copy is `<button aria-label="Copy name">`, 34px target, announces "Copied" via a live region |
| any | ✱ BackTitle hover / press | ✱ White 10 / White 20 pill | — | — | — | — | not drawn (`BackTitle` `Property 1` has only Default here); Creator Hub `Title` hovers with `--transparent-gray-dark` today |
| any | ✱ focus | — | — | — | — | ring ui2 `palette.info.light` 8.13:1 on `#16141a` | `:focus-visible` 2px on back, Copy and each CTA |

### Subtitle-Navigation (Sections Titles)

Component [`20735:711`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20735-711), 1 variant, under the `SUBTITLE` label. Row, Fixed 1724 × 40, padding 3 / 0, gap 10: `Title` `H2 Semi` 24 / 600 Snow (52 × 29), `BackTitle` 30 × 30 pill rotated −180° (a forward chevron: Vector 16.5 × 9.75 Primary), `CTAs` as TitleBar (Terciary + Primary, 40 tall). Code: Creator Hub none (page sub-headers are ad-hoc `Typography`); inspector none.

| Part | State | Typography | Colour | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Title | default | `H2 Semi` 24 / 600 | Snow | 52 × 29 | 17.81:1 | `<h2>` / `<h3>` |
| Forward chevron | default | — | Primary | 30 × 30 pill, glyph 16.5 × 9.75 | 5.01:1 | `<a>` / `<button aria-label="Open <title>">`; **30px target is above the 24px floor but below the 40px used by TitleBar** — one size, the user picks |
| CTAs | default | as TitleBar | — | 298 × 40 | as TitleBar | — |

### Editor Toolbar (TitleBar)

Set [`21028:42468`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-42468), 2 variants (`Property 1` = Default / Snackbar), under `<TitleBar>` on the TitleBar page. Shared: 1920 × 50, fill Black; `BackCTA` Hug 24 × 24 at 17 / 13, 9999px pill, no fill, 0.5px Pale Black border, padding 2 / 3 / 2 / 1, `ChevronLeftFilled` 20 box with a 6.17 × 10 Snow Vector; `Title` row Hug 97 × 22 at 49 / 14, gap 8: "Scene Title" Snow + `Tag` chip (Hug 100 × 15, 9999px, padding 2 / 8, fill `secondary/secondary/dark` Gray — hidden in the frame); `Actions` row Hug 383 × 32 at 1521 / 9, gap 10: `AIToggle`, two `rounded-button-contained` (Optimize, Code), `status/scenes/builder` chip (`status` draft, Hug 111 × 22, 34px pill, Pale Black, padding 2 / 8 — hidden), `Button-Multiple-Options` Preview (Hug 112 × 32, Onix Dark 1) and Publish (Hug 135 × 32, Primary). Code: Creator Hub `EditorPage` `.Header` (56 tall on `--bg-inspector`; `.back` 32 circle with a 1px `--dark-gray` border and a 14px `ArrowBackIosIcon`; `.actions` 32-tall buttons at 8px radius, split groups with a 1px `rgba(255,255,255,.2)` divider, `--title-bar-button` fill, `.ai-toggle` 32 × 32 with `--ai-session-selected` / `-hover`) — matches on action sizing, radius, divider and the three fills; drift on bar height (56 vs 50), back button (32 / 1px / 14px glyph vs 24 / 0.5px / 6 × 10) and the AI glyph colour (see Editor Toolbar buttons); inspector none (the inspector's own toolbar is the 3D/2D `Toolbar`).

| Variant | State | Fill | Left | Centre | Right | Contrast (on Black) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | Black | BackCTA 24 pill + "Scene Title" Snow | — | Actions 383 × 32 | title 20.47:1; back glyph 20.47:1, 0.5px Pale Black ring 2.07:1 — the pill edge is sub-threshold, the glyph carries the control; Tag Gray fill 13.34:1 | `<header role="banner">`; back `<button aria-label="Back to scenes">` — **24px is the floor, not a comfortable target; the app's 32px is the better size**; title `<h1>`; Actions is a `role="toolbar"` with arrow-key focus |
| Snackbar | default | Black | same | `Snackbars` `Property 1` Notification, Hug 199 × 44 at 860.5 / 3, 12px radius, fill Shadow `#161518`, padding 12 / 16 / 12 / 12, gap 16: `notification_important` 18 box + "Notification text" `H7 Regular` Snow, then "OK" `H7 Semi Caps` Primary (and a hidden "Update" `H7 Semi` in `DCL/Ruby`) | same | snackbar vs Black 1.15:1 — the 12px radius and the gap carry it; text 17.73:1 on Shadow; OK Primary 4.99:1 (≥ 4.5:1, barely) | `role="status"`; see Snackbars (Snackbars) — same component, placed inside the bar |
| any | ✱ title overflow | — | — | — | — | — | not drawn; truncate the title with an ellipsis and a `title` attribute, never wrap the 50px bar |

### Editor Toolbar buttons (TitleBar)

Frame `<Buttons> | Title Bar` [`21310:15793`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21310-15793): a Charcoal board (24px radius, 1px White 10) tabulating 9 controls × 3 columns (Default / Hover / Selected); a `Fill/None` 16px glyph marks a state the control does not have. Four components back the table — `BackCTA`, `AIToggle` (`Selected` Yes/No × `Hover` Yes/No), `rounded-button-contained` (`State` Default/Hover, `Hover Style` False/Tooltip Bottom) and `Button-Multiple-Options` (`Property 1` Default/HoverLeft/HoverRight) — whose mains live on the Buttons page; this table is the title-bar usage matrix. Hover cells carry a `Toast` tooltip (Hug 112 × 27, 8px radius, Onix Dark 1, padding 6 / 10, gap 16, shadow `0 4px 4px rgba(0,0,0,.1)`, `H7 Regular` Snow: "AI Assistant", "Close AI Assistant", "Optimize", "Code", "Play Options", "Publish Options") — the Tooltip (Tooltips) component. Code: Creator Hub `EditorPage` (`.ai-toggle` colour `--white` closed, gradient open — **inverted against Figma, where the gradient is the rest state and Snow the selected one**; `rounded-button-contained` ≈ `IconButton` on `--title-bar-button`; `Button-Multiple-Options` ≈ `ButtonGroup` + `extra-button` with the White 20 divider; MUI icons `SpeedOutlined`, `Code`, `PlayCircle`, `Public` stand in for Figma `Optimize`, `Code`, `Icon` glyphs); inspector none.

| Control | Default | Hover | Selected | Size | Contrast (on Black) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<Back>` BackCTA | no fill, 0.5px Pale Black ring, Snow chevron 6.17 × 10 | White 10 fill, same ring | — | 24 × 24, 9999px | glyph 20.47:1; hover fill 1.21:1 — the hover is near-invisible on Black, the tooltip is absent; ✱ raise to White 20 (1.66:1) or add a ring change | `<button aria-label="Back">` |
| `<AiAssistantOff>` AIToggle | no fill; `Icon` 24 box, sparkle 18.88 × 20.66 linear gradient `#FFD079 → #DA36FF` | Charcoal fill (`Hover` Yes); "AI Assistant" tooltip | Blue Dark 2 fill, Snow sparkle | 32 × 32, 8px | gradient ends 14.55:1 / 5.95:1 on Black; Charcoal hover vs Black 1.33:1 — weak, the tooltip announces the hover; Blue Dark 2 vs Black 2.38:1 (below 3:1 for a state boundary — the glyph colour change carries it); Snow on Blue Dark 2 8.61:1 | `<button aria-pressed="false" aria-label="AI Assistant">`; the state is colour-and-glyph, announce it with `aria-pressed` |
| `<AiAssistantOn>` AIToggle | Blue Dark 2 fill, Snow sparkle (`Selected` Yes) | Blue Dark 3 fill (`Selected` Yes, `Hover` Yes); "Close AI Assistant" tooltip | no fill, gradient sparkle (toggles back) | 32 × 32, 8px | Snow on Blue Dark 3 11.61:1; Blue Dark 3 vs Black 1.76:1 | `aria-pressed="true"` |
| `<Optimize>` rounded-button-contained | Onix Dark 1 fill; `Optimize` 19.2 box, Vector 14.64 × 11.71 Snow | White 10 fill (`State` Hover, `Hover Style` Tooltip Bottom); "Optimize" tooltip | — | 32 × 32, 8px | Onix Dark 1 vs Black 1.49:1; glyph 13.73:1 on it; hover White 10 vs Black 1.21:1 — **the hover is darker than rest** (`#1a1a1a` vs `#2d2a33`), confirm with the designer whether hover was meant as White 10 _over_ Onix Dark 1 | `<button aria-label="Optimize assets">` |
| `<Code>` rounded-button-contained | as Optimize, `Code` glyph | as Optimize; "Code" tooltip | — | 32 × 32, 8px | as Optimize | `<button aria-label="Open in code editor">` |
| `<Preview>` Button-Multiple-Options | Onix Dark 1; `Left` Hug 111 × 32, padding 0 / 14, gap 6: `Icon` 18 + "PLAY" `button/small` 13 / 600 / 24 / 0.46 uppercase Snow; `Right` 32 × 32, 1px White 20 left border, chevron 8.5 × 5 Snow | `HoverLeft`: left segment hovers (White 10 over the fill) | — | Hug 113 × 32, 8px | label 13.73:1; divider 1.20:1 on Onix Dark 1, decorative | split control: `<button>Play</button>` + `<button aria-label="Play options" aria-haspopup="menu">` sharing one 8px frame; the right segment is 32 × 32 |
| `<PreviewOptions>` Button-Multiple-Options | as Preview | `HoverRight`: right segment hovers; "Play Options" tooltip | — | same | as Preview | — |
| `<Publish>` Button-Multiple-Options | Primary fill; "PUBLISH" `button/small` Snow + `Icon` 18; Right chevron Snow, 1px White 20 divider | `HoverLeft` | — | Hug 143 × 32, 8px | Primary vs Black 5.76:1; **"PUBLISH" Snow on Primary 3.55:1 — fails 4.5:1** (13px / 600); divider 1.20:1 | `<button>Publish</button>` + options button |
| `<PublishOptions>` Button-Multiple-Options | as Publish | `HoverRight`: right segment Primary Light 1; "Publish Options" tooltip | — | same | **Snow chevron on Primary Light 1 2.80:1 — fails 3:1 non-text**; Primary Light 1 vs Black 7.31:1 | — |
| any | ✱ press / focus / disabled | — | — | — | — | not drawn; focus ring `--ui-designer-control-accent` / ui2 `palette.info.light` 9.39:1 on Black; disabled = 20% opacity as the ReportBug SUBMIT, plus `aria-disabled` | — |

### Play Options menus (TitleBar)

Frame `<Menu> | Title Bar` [`21372:16356`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21372-16356): two `Menu` (Menu) instances at Fixed 300 wide (Onix, 1px White 10, 12px radius, padding 10 / 0, gap 10, shadow `0 4px 8px rgba(0,0,0,.4)`), their `Options` / `Options2` slots filled with `Menu-Entry` (Menu) instances carrying `Radio` and `Checkbox Secondary` leads. Code: Creator Hub `EditorPage/MenuOptions` `PreviewOptions` / `PublishOptions` (ui2 `Menu` with MUI `Radio`, `Checkbox`, `Divider`) and `EditorPage/OptionBox` (340 wide, `--dark-gray`, 8px radius, padding 10 / 30) — drift on width, fill and entry anatomy; inspector none.

| Menu | Entry | Variant | Lead | Label | Trailing | Size | Contrast (on Onix) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Play Options | PLAY OPTIONS | `Section` | — | Inter 12 / 400 uppercase Silver | — | Fill 280 × 38, 8px, padding 0 / 10, gap 16 | 4.59:1 | group heading, not focusable |
| Play Options | Desktop Client | `Hover` (drawn as the active row) | `Radio` `On` 20 box: 1px White 40 ring + Primary dot | `H7 Regular` Snow (210 wide) | `arrow-right` 10 box (submenu) | Fill 280 × 38, Pale Black fill | label 9.88:1 on Pale Black; **Primary dot 2.78:1 and White 40 ring 3.05:1 on the Pale Black row — the dot fails 3:1 while hovered**; on Onix at rest: dot 3.41:1, ring 3.39:1 | `role="menuitemradio" aria-checked="true" aria-haspopup="menu"` |
| Play Options | Web (Bevy) | `Default` | `Radio` `Off`: 20 box, 1px White 40 ring, 100px | `H7 Regular` Snow | `arrow-right` (hidden) | Fill 280 × 38 | label 12.13:1; ring 3.39:1 (≥ 3:1) | `role="menuitemradio" aria-checked="false"` |
| Play Options | — | `Div` | — | — | — | Fill 300 × 1, White 10, padding 7 / 10 | 1.37:1, decorative | `role="separator"` |
| Play Options | Show QR Code for Mobile | `Default` | `Info` 16 box (hidden) | `H7 Regular` Snow | `arrow-right` (hidden) | Fill 280 × 38 | 12.13:1 | `role="menuitem"` |
| Submenu | Enable Landscape Terrains / Enable MCP Server / Compress Assets | `Default` | `Checkbox Secondary` `On` 16 box, 5px radius: White 40 ring + `Checkmark (Stroke)` 9.6 × 8 Primary | `H7 Regular` Snow | — | Fill 280 × 38, gap 10 | check Primary 3.41:1, ring 3.39:1 (≥ 3:1) | `role="menuitemcheckbox" aria-checked="true"` |
| Submenu | Multi-Instance Preview | `Default` | `Checkbox Secondary` `Off`: 16 box, 5px radius, 1px White 40 ring | `H7 Regular` Snow | — | same | ring 3.39:1 | `aria-checked="false"` |
| any | ✱ keyboard-active checkbox row | `Hover` | — | — | — | Pale Black | as Desktop Client — the Primary check falls to 2.78:1 | arrow keys move, Space toggles without closing |

### ConnectionStatus (Profile Snapshot)

Set [`20772:851`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20772-851), 2 variants (`Property 1` = Online / Away). A 10 × 10 dot with a 2px Shadow `#161518` outer border; placed on `ProfilePic` at 10 (60px avatar) or 6 × 6 (40 / 32 / 28). Code: Creator Hub none (`Header/UserMenu` shows no presence); inspector none.

| Variant | Fill | Border | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Online | System/Green `#34CE77` | 2px Shadow, outer | 10 × 10 (6 × 6 on small avatars) | Green vs page 8.91:1; Shadow ring vs Green 8.87:1, vs Lavender 4.34:1 — the ring is what separates the dot from the avatar | not a control; the avatar's accessible name carries "online" |
| Away | System/Orange `#FE9C2A` | same | same | Orange vs page 8.71:1; ring vs Orange 8.66:1 | **Green vs Orange 1.02:1 — status is colour-only; the name must say "away"** |
| ✱ Offline | — | — | — | — | not drawn (the `DisconnectedOverlay` below is the offline treatment) |

### ProfilePic (Profile Snapshot)

Set [`20772:856`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20772-856), 4 variants (`Property 1` = 60 / 40 / 32 / 28). Circle, fill Brand/Lavender, White 40 inner ring (3px at 60, 2px below), `AvatarSnapshot` (`AvatarSnapshot` 004, an `image.png` raster) inset by the ring, `ConnectionStatus` at top-right, plus two hidden layers on the 40 / 32 / 28 variants: `DisconnectedOverlay` (full circle, `#000000` 60%) and `Blocked` (3px at 32, 2px at 28, `DCL/Red` ring). Code: Creator Hub `Header/UserMenu` `.AvatarButton` (MUI `Avatar` 44 × 44 at 8px radius inside a 12px-radius frame with a 1px `--transparent-gray-light` border, hover `--text` border) — drift on shape (rounded square vs circle), size, ring and fill; inspector none.

| Variant | State | Fill | Ring | Avatar | Status dot | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | default | Lavender | 3px White 40, inner | 54 × 54 at 3 / 3, 100px | 10 × 10 at 45 / 5, Online | 60 × 60 | Lavender vs page 4.37:1, vs card 3.79:1, vs Black 5.02:1 (≥ 3:1); ring vs Lavender 1.78:1 — decorative, the raster carries the edge | `<img alt="<name>, online">` or a `<button>` named the same when it opens the menu; 60px target |
| 40 | default | Lavender | 2px White 40 | 36 × 36 at 2 / 2 | 6 × 6 at 30 / 3, Green (`Property 1` unset) | 40 × 40 | as 60 | 40px target |
| 32 | default | Lavender | 2px White 40 | 28 × 28 at 2 / 2 | 6 × 6 at 24 / 2, Green | 32 × 32 | as 60 | 32px target (≥ 24) |
| 28 | default | Lavender | 2px White 40 | 24 × 24 at 2 / 2 | 6 × 6 at 19 / 1, **`DCL/Grass` `#28AC00` with a `DCL/Shadow` ring — the only variant off System/Green; Figma drift, treat as Green** | 28 × 28 | Grass vs page 6.08:1; ring vs Grass 6.06:1 | 28px target |
| 40 / 32 / 28 | disconnected (hidden layer) | Lavender under `#000000` 60% | same | dimmed | — | — | the overlay dims the raster; add "offline" to the name | `aria-label` carries the state |
| 32 / 28 | blocked (hidden layer) | Lavender | `DCL/Red` 3px (32) / 2px (28) replaces the White 40 ring | same | — | — | **Red vs Lavender 1.05:1 — the blocked ring is invisible against the fill; Red vs page 4.57:1 is what you see at the outer edge**; pair it with an icon or text | `aria-label` carries "blocked" |
| any | ✱ hover / focus | — | ✱ White 60 ring | — | — | — | ring ui2 `palette.info.light` 8.13:1 on `#16141a` | `:focus-visible` 2px outline, offset 2px, when the avatar is a button |

### Inputs tokens

Literals the Buttons page (Inputs section) adds to the Surfaces table above; the Snow, Gray, Silver, White, Pale Black, Primary, Primary Light 1, White 10 / 20 / 40 / 60, Black 40, Onix Dark 1, Charcoal, Blue Dark 2 / 3 and 8 / 12 / 100px entries are mapped there and not repeated. Values are the Figma web client's Properties panel read through the DOM (October 19, 2026); the Figma MCP seat was spent. Contrast is against inspector `#161518`, Creator Hub page `#16141a`, or the fill named in the row. The last rows come from the Checkbox, Dropdown, Filter, Radio, Search Bar, Switch and Text Field pages.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FF2D55` Switch On track | DCL/Ruby (legacy collection; same value as Primary/Primary) | `--primary-main` | `--primary`, `--dcl` |
| `#FCFCFC` Switch knob | DCL/Snow (legacy collection; same value as Neutrals/Snow) | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#161518` ToolbarButton rest rectangle | DCL/Shadow | `--tree-bg-color` (`--base-20`) | missing (`--bg-inspector` is `#000`) |
| 1.5px border | — | 1px border + `box-shadow: inset 0 0 0 0.5px` (Chromium floors a 1.5px border to 1px; see Text-Input) | missing |
| 46px button height | — | `--controlHeight-large` | missing (`Button` is MUI default) |
| 10px radius (ButtonContainedVertical 20) | — | missing | missing |
| 6px radius (ToggleLabel) | — | `--shape-borderRadius` (aliased by `--ui-designer-radius-field`) | `--mui-shape-borderRadius` |
| 58.82px radius (Switch track and knob) | — | missing; a pill, use 100px | missing |
| 20% opacity (blocked) | — (node opacity, not a variable) | missing | missing |
| Inter 16 / 700 / 22px uppercase | unnamed (JumpInCTA label) | `--font-family` + literal size | same |
| `#8A38F5` dashed 1px, 5px radius | — (Figma set frame chrome, not spec) | not a surface | not a surface |
| `#A14BF3` dashed 1px (`Rarities/Legendary`) | Figma set frame chrome on Checkbox and Radio | not a surface | not a surface |
| 5px radius, 20 × 20 box (Checkbox) | — | literals in `CheckboxField.css` (single use) | missing |
| 100px radius, 20 × 20 ring and 10 × 10 dot (Radio) | — | missing | missing |
| 32 × 32 halo at −6 / −6 | — | `box-shadow: 0 0 0 6px` literal in `CheckboxField.css`, a rounded square rather than Figma's circle | missing |
| `#FF2D55` @ 20% halo (Checkbox), @ 10% (Radio) | unnamed fill, not a variable | missing (`--primary-main` is opaque) | missing |
| White 40 / 60 border steps | `Transparencies/White 40`, `White 60` | `--palette-whiteTransparent-blurry` / `--palette-whiteTransparent-backdrop` | missing |
| `#161518` tick on Primary (Checkbox Primary) | Neutrals/Shadow | `--tree-bg-color` (`--base-20`) | missing |
| `#FCFCFC` named `DCL/White` (Description, help) | legacy collection; value is Snow, not `#FFFFFF` | `--ui-designer-text` | ui2 `neutral.softWhite` |
| `#FFFFFF` Dropdown Title | unnamed solid white | `--white` | `--white` |
| 9999px / 999px pill radius (Sort-By, Filter bar) | — | missing; use 100px | missing |
| 12px field radius, 46px height, 16px side padding (Dropdown container) | — | `--shape-borderRadiusLarge`, `--controlHeight-large`, `--uid-space-4`; `Dropdown` has no large size yet | missing |
| 56px bar, 300px Search-Bar, 30 / 10px bar padding | — | missing | missing |
| Inter 14 / 400 / 100%, 16 / 400 / 100%, 16 / 600 / 100% | `H7 Regular`, `H6 Regular`, `H6 Semi` | `--font-family` + literal size | same |
| 52 × 30 Switch, track 50.21 × 30, knob 25.1 × 25.1 at 3.05 / 2.45 (Off) and 22.52 / 2.45 (On), radius 58.82px | — | missing; a pill, use 100px | missing |
| 50% node opacity (Switch `Default`) | — (node opacity, not a variable) | missing | missing |
| `#FFFFFF` @ 5% Close-Button fill | unnamed fill, not a variable | missing | missing |
| 24 × 24 Close-Button (19 × 19 inside the bar), 16 × 16 glyph, 100px radius | — | missing | missing |
| 12px field radius, 14 / 16px padding, 1px and 1.5px borders (Text Field container) | — | `TextField size="large"`: `--shape-borderRadiusLarge`, padding 0 / `--uid-space-4` at the fixed `--controlHeight-large`, focus and error as a 1px border plus a 0.5px inset shadow | missing |
| 1.5px Snow left or right edge, or 18px × 1px `#FFFFFF` line rotated −90° (drawn caret) | — | not a surface; the native caret | not a surface; the native caret |
| 19 × 19 Search glyph, 20 × 20 `LocalAssets` folder glyph | — | missing | missing |
| `#FFFFFF` Title (Text Field) | unnamed solid white | `--white` | `--white` |
| `#D9D9D9` 179 × 18 `Gap` spacer (Search-Bar Completed) | unnamed default fill | not a surface | not a surface |
| `#244B7D` text-selection highlight (Text-Input Input Highlighted) | System/Blue Dark 2 | `--palette-system-blueDark2`; `UIDesigner.css` still paints the same value as two literals | `--ai-session-selected` |
| `#716B7C` slider track (Slider) | Neutrals/Cloudy Sky | `--palette-neutral-gray2` (ui2 `neutral.gray2`; `--ui-designer-glyph` aliases it) | `--dropdown` · ui2 `neutral.gray2` |
| `#FF2D55` slider fill and handle (Slider) | Primary/Primary (fill), `Primary Base/Primary` (handle: a second collection, same value) | `--primary-main` | `--primary` · ui2 `palette.primary.main` |
| 6px track, 14 × 14 handle, 100px radius (Slider) | — | literals; a pill, use 100px | missing |
| 8px menu-row radius, 10px row inset (Dropdown menu) | — | missing; the dense list takes `--shape-borderRadius` and `--uid-space-1` | missing |

### Button-Contained-Text (Buttons)

Set [`20705:11927`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20705-11927), 9 variants (verified by Enter on the set: 9 Selected; Primary, Terciary, PrimaryBlocked, Secondary read singly, the rest from the aggregate). Hug 90 × 46, 12px radius, padding 12 / 24, label Inter 600 16 / 22 uppercase Snow. Code: inspector `components/Button` with MUI's axes: `variant` contained | outlined | text, `color` primary | secondary | info, `size` small | medium | large (TypeScript defaults text / primary / medium, so every call site writes all three). Each prop emits a class only where it differs from the CSS baseline on bare `.Button`, which is contained + secondary + small. Large is 46px `--controlHeight-large`, 12px `--shape-borderRadiusLarge`, padding 12 / 24 `--uid-space-3` / `--uid-space-6`, Inter 600 16 / 22 uppercase; medium is the same at `--controlHeight-medium` 40px with padding 8 / 24; small is the Attach box (padding 6 / 10, 6px `--shape-borderRadius`, Hug 30 from an 18px line). Primary paints `--primary-main` and hovers to `--palette-primary-light`; Secondary is White 10 / White 20; Terciary is `variant="outlined"`, a 1.5px White 40 inset outline that turns Snow on hover. Disabled is Figma's PrimaryBlocked on every variant: the whole node at `opacity: 0.2`, with each variant's rest paint (a hovered disabled button never shows its hover paint). Pressed is defined per variant (✱ row below). Exceptions: MoreOptions items and the CreateScriptModal create keep a .5 opacity. Every `.Button` draws a 2px `--focus-ring` `:focus-visible` ring at a 2px offset. The large-field forms put their CTA in `color="primary"` and Cancel in the default Secondary, at `size="large"`: `UrlInputModal`, `CreateEditTagModal`, `CreateCustomAsset`, `RenameAsset`. `CreateScriptModal` has a large field but hand-styled 13px buttons (`.cancel-button` / `.create-button`). It matches geometry, label, Primary and Secondary fills and Terciary; Quaternary is not implemented. Creator Hub `components/Button` (ui2 `Button`: `colorPrimary` `--dcl`, hover `--primary-hover`, secondary `--dark-gray`, `info` outlined 1px white) — matches the Primary fill and hover, drift on the Secondary fill.

| Variant | State | Fill | Border | Label | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | default | Primary | — | Snow | **Snow on Primary 3.55:1 — fails 4.5:1** (16px / 600 is not large text); Primary vs `#161518` 4.99:1, vs `#16141a` 5.01:1, vs card `#242129` 4.35:1 | `<button>`; 46px target |
| Primary | hover | Primary Light 1 (`#FF6280`, read on the Icon set) | — | Snow | **Snow on Primary Light 1 2.80:1 — fails**; fill vs `#161518` 6.33:1 | — |
| PrimaryBlocked | blocked | Primary, node opacity 20% (fill **and** label: sampled fill a = 0.21, label Snow at 20%) | — | Snow at 20% | disabled, exempt; label 1.50:1 on the 20% fill, 1.85:1 on `#161518`. Code matches: `.Button:disabled { opacity: 0.2 }` dims the whole node, on every variant. | `aria-disabled="true"` |
| Secondary | default | White 10 | — | Snow | 13.53:1 on `#161518` (13.50 on `#16141a`) | — |
| Secondary | hover | White 20 | — | Snow | 9.44:1 | — |
| Terciary | default | none | 1.5px White 40 | Snow | border 3.84:1 on `#161518` (3.83 on `#16141a`), passes 3:1 | — |
| Terciary | hover | none | 1.5px Snow | Snow | border 17.73:1 | — |
| Quaternary | default | Black 40 | — | Snow | fill is near-invisible on `#161518`; the label carries it | — |
| Quaternary | hover | White 10 | — | Snow | 13.53:1 | — |
| any | ✱ press / focus | ✱ press one step darker than hover; code: Secondary W10 (= rest), Primary `--primary-dark`, info `--accent-blue-08`, outlined White 60 outline, text White 60 label | ✱ focus ring | — | ring `--focus-ring` Snow 17.73:1 on `#161518` / ui2 `palette.info.light`; pressed Primary label 4.19:1 | not drawn; `:focus-visible` 2px outline, offset 2px |
| text + primary | ✱ the bare `<Button>` default (no Figma text button) | none | — | `--primary-main`, hover `--palette-primary-light`, pressed `--primary-main` | ✱ 4.99:1 on `#161518`, 4.51 on canvas, **4.35 on card `#242129`** (accepted) | no caller |
| text (any colour) | ✱ disabled | none | — | the rest label at the whole-node opacity 0.2 | 1.87:1 on `#161518` (exempt) | `disabled`; no Figma text button, so the Figma blocked treatment is extended to it |
| small / medium | ✱ sizes | as the variant | — | as the variant | — | small = Attach box (padding 6 / 10, radius 6, Hug 30 from an 18px line); medium = TitleBar CTA, fixed 40px (Figma's 8 + 22 + 8 = 38 inside a Hug 40 frame; the frame wins) |

Variant names `Terciary` and `Quaternary` are Figma's spelling; the component API uses MUI's names (`variant="outlined" color="secondary"` for Terciary), and Quaternary is deferred until a caller exists.

### Button-Contained-Text-Icon (Buttons)

Set [`20735:1190`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20735-1190), 8 variants (Primary, Secondary, Terciary, Quaternary × default / Hover; the Properties panel shows 8 Selected). Hug 118 × 46, 12px radius, padding 12 / 24, gap 10; `settings` icon 18 × 18 White, label Inter 600 16 / 22 uppercase Snow (42 × 22). Fills and borders match Button-Contained-Text; the Secondary / Terciary / Quaternary defaults are inferred from the aggregate and that set. The ReportBug Attach instance overrides to Hug 257 × 30, 6px radius, padding 6 / 10. Code: as Button-Contained-Text; Creator Hub `Button` with `startIcon`.

| Variant | State | Fill | Border | Content | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | default | Primary | — | icon White + label Snow | label 3.55:1 — **fails 4.5:1**; icon White on Primary ≥ 3.55:1 passes non-text | visible label names the control; icon `aria-hidden` |
| Primary | hover | Primary Light 1 | — | same | label 2.80:1 — **fails** | — |
| Secondary | default / hover | White 10 / White 20 | — | same | 13.53:1 / 9.44:1 | — |
| Terciary | default / hover | none | 1.5px White 40 / 1.5px Snow | same | 3.84:1 / 17.73:1 border | — |
| Quaternary | default / hover | Black 40 / White 10 | — | same | 13.53:1 on hover | — |
| any | ✱ blocked / press / focus | ✱ as Button-Contained-Text | — | — | — | not drawn; follow Button-Contained-Text |

### PillIconText (Buttons)

Set [`20705:11942`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20705-11942), 4 variants (`Idle`, `Hover`, `Selected`, `SelectedHover`). Hug 99 × 36, 100px pill, padding 8 / 16, gap 10; icon 20 × 20 (opacity 60% at rest), label Inter 600 14 / 100% uppercase. Code: inspector `ui/Pill` is a removable chip (`--base-02` fill, 13px / 500), not this toggle pill; Creator Hub ui2 `Chip` (`PublishedProjectCard`, `WorldPermissionsItem`) — drift; no toggle-pill exists.

| Variant | State | Fill | Border | Icon / label | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Idle | default | none | 1.5px White 10 | icon 60%, label White 60 | label 7.07:1 on `#161518` (7.10 on `#16141a`); border 1.31:1 — sub-threshold, the label carries it | `<button aria-pressed="false">` |
| Hover | hover | none | 1.5px White 40 | same | border 3.84:1 | — |
| Selected | selected | White 10 | none | icon White, label Snow | 13.53:1 | `aria-pressed="true"` |
| SelectedHover | selected + hover | White 20 | none | same | 9.44:1 | — |
| any | ✱ focus / disabled | — | ✱ focus ring | — | — | not drawn; 36px target clears 24px |

### rounded-button-contained (Buttons)

Set [`20705:12363`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20705-12363), 5 variants (`State` Default / Hover / Blocked × `Hover Style` False / Tooltip Top / Tooltip Bottom; Hover / Tooltip Bottom read by analogy with Top). 40 × 40, 100px pill, no fill; `settings` glyph 24 × 24 White at 8 / 8; tooltip fill Onix Dark 1 with Snow text. Code: Creator Hub `EditorPage` `.actions` `IconButton` 32 × 32 on `--title-bar-button` at 8px radius (the title-bar instance overrides the 40 pill, see Editor Toolbar buttons); inspector none.

| Variant | State | Fill | Glyph | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default / False | default | none | White | White vs `#161518` ≥ 17.73:1 | `<button aria-label>` |
| Hover / Default | hover | White 10 | White | fill vs `#161518` 1.31:1 — the hover boundary is faint, nothing else changes | — |
| Hover / Tooltip Top, Bottom | hover | White 10 + tooltip | White | tooltip Snow on Onix Dark 1 13.73:1 | tooltip `role="tooltip"`, `aria-describedby` |
| Blocked / False | blocked | none, node opacity 20% | White at 20% | disabled, exempt | `aria-disabled="true"` |

### BackTitle (Buttons)

Set [`20762:22781`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20762-22781), 2 variants (Default / Hover). 40 × 40, 100px pill; `arrow-left` 24 × 24 Primary at 8 / 6. Code: Creator Hub `EditorPage .Header .back` (32 circle, 1px `--dark-gray` border, `ArrowBackIos` 14) — drift on size, border and glyph; inspector none.

| Variant | State | Fill | Glyph | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | none | Primary | 4.99:1 on `#161518`, 5.01:1 on `#16141a`, 4.35:1 on card `#242129` (≥ 3:1 non-text) | `<button aria-label="Back">` |
| Hover | hover | White 10 | Primary | fill vs `#161518` 1.31:1 | — |
| any | ✱ focus / press | ✱ focus ring | — | — | not drawn |

### Button-Multiple-Options (Buttons)

Set [`20794:2456`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20794-2456), 3 variants (`Property 1` Default / HoverLeft / HoverRight). Hug 155 × Fixed 40, 12px radius, no frame fill; Left Hug 115 × Fill 40, padding 0 / 14, gap 6, Primary, icon 18 × 18 + label Inter 600 16 / 22 uppercase Snow (63 × 22); Right 40 × 40 Primary with a 1px White 20 left border. Code: Creator Hub `CreateButton` (`StyledLabelButton` 130 × 40, 16 / 600 uppercase, 12px radius, Primary; toggle 40 × 40 with a 1px `rgba(255,255,255,.2)` left border) and `Button` `ButtonGroup` + `extra-button` — matches geometry; both segments hover to `--primary-hover` `#FF6280` (Primary Light 1), matching; inspector none.

| Variant | State | Fill | Contrast | A11y |
| --- | --- | --- | --- | --- |
| Default | default | Primary both segments | label 3.55:1 — **fails 4.5:1**; divider White 20 over Primary 1.20:1, decorative | `<button>` + `<button aria-haspopup="menu" aria-label>` in one frame |
| HoverLeft | hover left | frame fill Primary Light 1 | **label 2.80:1 — fails** | — |
| HoverRight | hover right | frame fill Primary Light 1 | chevron Snow on Primary Light 1 2.80:1 — **fails 3:1 non-text** | — |
| any | ✱ blocked / focus | — | — | not drawn |

### ButtonContainedVertical (24 Caps) (Buttons)

Set [`20925:148`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20925-148), 2 variants (`Hover` Off / On; the set's child `Default hover` is `20925:165`). Fixed 112 × Hug 85, 12px radius, padding 20 / 10 / 10 / 10, gap 16; `Create-Event` icon 24 × 24 and label Inter 400 12 / 100% uppercase centred, both Gray (92 × 15). Code: none (Create-Event tile) — Creator Hub none; inspector none.

| Variant | State | Fill | Content | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Off | default | none | Gray | 11.55:1 on `#161518` | `<button>` with the visible label |
| On | hover | White 10 | Snow (inferred from the aggregate) | Gray on White 10 8.82:1; Snow 13.53:1 | — |
| any | ✱ focus / press / disabled | — | — | — | not drawn |

### ButtonContainedVertical (20) (Buttons)

Set [`21076:34691`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21076-34691), 3 variants (`Hover` × `Blocked`: Off/No, On/No, Off/Yes). Fixed 80 × 70, 10px radius, 1px White 10 border, padding 20 / 10, gap 10; `NodeType/Container` icon 20 × 20, label Inter 400 12 / 100% centred (no case) Gray (60 × 15). Code: inspector UIDesigner `Palette` `.ui-designer-palette-card` (row layout, 1px `--ui-designer-control-border`, 4px radius, padding 6 / 8, gap 8, disabled opacity .4) — drift on orientation, size and radius; Creator Hub none.

| Variant | State | Fill | Border | Content | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off / No | default | none | 1px White 10 | Gray | 11.55:1; border 1.31:1, the label carries it | `<button>` |
| On / No | hover | White 10 | 1px White 60 | Gray (Snow inferred) | Gray on White 10 8.82:1; border 7.07:1 | — |
| Off / Yes | blocked | none | 1px White 10, no opacity | icon and label White 20 | 1.88:1 — disabled, exempt | `aria-disabled="true"` |
| any | ✱ focus / press | — | ✱ focus ring | — | — | not drawn |

### JumpInCTA (Buttons)

Set [`20926:242`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20926-242), 2 variants (Default / Hover). Hug 300 × Fixed 46, 12px radius, padding 0 / 100, gap 10, Primary; `CTABtnIcn/JumpIn` 25 × 25 (a PNG raster, not a vector), "JUMP IN" Inter 700 16 / 22 uppercase Snow (66 × 22), `Icn/JumpIn` 24 × 24 with an 8px radius and 1.5px White 20 border (a keycap). Code: Creator Hub `ManagePage/PublishedProjectCard` `handleJumpIn` (ui2 `Button`; styling unchecked); inspector none.

| Variant | State | Fill | Contrast | A11y |
| --- | --- | --- | --- | --- |
| Default | default | Primary | **Snow on Primary 3.55:1 — fails 4.5:1** (700 / 16px is not large text) | `<button>`; ship the raster icon with `alt=""` |
| Hover | hover | Primary Light 1 | **2.80:1 — fails** | — |
| any | ✱ focus / press / disabled | — | — | not drawn |

### ToggleLabel (Buttons)

Set [`21004:3194`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21004-3194), 2 variants (`Active` On / Off; an `Icon` boolean property is also exposed). Hug 55 × Fixed 20, 6px radius, padding 2 / 6, gap 2; icon 16 × 16 + label "Text" Inter 400 12 / 100% centred, no case (25 × 15). Code: none (20px chip) — Creator Hub none; inspector none.

| Variant | State | Fill | Content | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| On | selected | Blue Dark 3 (`#243852`) | Snow (the Off label is Silver per the aggregate) | Snow on Blue Dark 3 11.61:1; fill vs `#161518` 1.53:1 | `aria-pressed="true"` |
| Off | default | none | Silver | 6.71:1 on `#161518`, 6.74:1 on `#16141a`, 5.85:1 on card | `aria-pressed="false"` |
| any | ✱ hit target | — | — | **20px tall is below the 24px floor** — add 2px vertical hit padding | — |

### ToolbarButton (Buttons)

Set [`21005:3408`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21005-3408), 3 variants (`Active=Off, Selected=Off` `21005:3415`, `Active=On, Selected=Off` `21005:3412`, `Active=On, Selected=On` `21005:3409`, plus a `Disabled` boolean property; re-read October 22, 2026). 26 × 26, no radius; `Icon` 24 × 24 at 1 / 1 over a `Rectangle` 26 × 26. The artwork inside the 24px frame is small: the set's default vector is 10 × 10 at 7 / 7, and the Viewport Toolbar's glyphs measure 8.4–12px (undo 10 × 9.4, select 10, move 12, rotate 12 × 12.9, scale 12.3 × 11.3, play 9 × 11, pause 10 × 11, stop 10, edit and save 12; exported October 23, 2026). In the Viewport Toolbar every instance sits in a frame (6px radius, 1px Onix border, Onix fill), which gives the visible corners and edge.

Code: inspector `Toolbar/ToolbarButton`. The final design, by user decision on October 23, 2026, is **one look for both bars**:

- **Box:** 26 × 26, 1px `--palette-neutral-onyx` border, 6px radius, `--tree-bg-color` (Shadow) fill, `--palette-neutral-gray4` glyph.
- **Glyphs:** Figma's own artwork, as single-colour `currentColor` svgs drawn at their 24px frame (16px for the kebab, 18px for the camera, 8px for the chevrons), so their artwork lands at Figma's size.
- **State hook:** `aria-pressed`. A selected cell inside a joined group (the gizmos) keeps the group's Onix edge, as Figma's frame draws it. A standalone selected button (Interact, Mute, the snap toggles, RuntimeControls' Pause) takes its fill colour as its border, as Figma's `Interact` and `Pause` frames draw none.

**Current state:**

- **3D bar:** has the box and states since `2b5b7efe4` (layer 3a), scoped to `.Toolbar:not(.ui-designer-toolbar)`, with react-icons glyphs at 12–16px and the gizmo masks at 11px `contain`.
- **2D bar:** still wears review 2's rules (no rest container, Silver glyphs; see UI Editor Buttons).
- **Next:** the 2D bar, the scope removal and the glyph swap are in `docs/specs/design-system-tools/layer3a2-spec.md`, implementation pending.

Creator Hub: none.

| Variant | State | Rectangle | Icon | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Off / Off | disabled | Shadow `#161518` | Pale Black `--gray-0` | 1.79:1 — disabled, exempt | native `disabled` |
| On / Off | default | Shadow | Gray `--palette-neutral-gray4` | 11.55:1; Onix edge 1.46:1 | `<button>` named by `aria-label` or `title`; a toggle adds `aria-pressed="false"` |
| On / On | selected | Blue Dark 2 `--palette-system-blueDark2` | Snow `--palette-neutral-softWhite` | Snow on Blue Dark 2 8.61:1; fill vs Shadow 2.06:1 — below 3:1, the glyph colour change carries it; a grouped cell's Onix edge on Blue Dark 2 1.41:1 (an edge, not the cue) | `aria-pressed="true"` |
| ✱ hover | not drawn | White 10 `--palette-whiteTransparent-subtle` (→ `#2d2c2f`) | Snow | 13.53:1; fill vs Shadow 1.31:1 | — |
| ✱ selected + hover | not drawn | Blue Dark 3 `--palette-system-blueDark3` | Snow | 11.61:1 | — |
| ✱ focus | not drawn | as state | as state | 2px `--focus-ring` (Snow) at 1px offset: 17.73:1 on Shadow | `:focus-visible`; 26px target (a joined cell keeps 25px of its own) clears 24px |

### Switch (Buttons)

Set [`21167:30101`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21167-30101), 2 variants (Switch On / Off), built on the legacy `DCL/Snow` and `DCL/Ruby` collection. 41 × 24; track 40 × 24, 58.82px radius, left 0.4; knob 19.53 × 19.53 at 2.23 / 2.53, `DCL/Snow`. Code: Creator Hub ui2 `Switch` (`OptimizeModal`, MUI default sizing) — drift on size and track colour; inspector none.

| Variant | State | Track | Knob | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Off | default | White 20 | Snow, left | **track vs `#161518` 1.88:1 (1.87 on `#16141a`, 1.91 on card) — fails 3:1 non-text**; knob on track 9.44:1 | `<input role="switch" aria-checked="false">` |
| On | selected | Ruby `#FF2D55` | Snow, right | track vs `#161518` 4.99:1; knob on track 3.55:1 (passes 3:1 non-text) | `aria-checked="true"`; knob position and colour both change |
| any | ✱ hover / focus / disabled | — | — | — | not drawn; 24px tall meets the floor |

### IconContainedToggle (Buttons)

Set [`21206:31700`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31700), 4 variants (`Selected` × `Hover`; the main of `AIToggle`). 32 × 32, 8px radius; single `Icon` 24 × 24 at 4 / 4, a gradient sparkle at rest and Snow when selected. Code: Creator Hub `EditorPage .ai-toggle` (32 × 32; hover `--title-bar-button` `#2D2A33` vs Figma Charcoal `#25212A`; active `--ai-session-selected` `#244B7D`; active hover `--ai-session-selected-hover` `#243852`) — selected colours match, hover drifts; inspector none.

| Variant | State | Fill | Contrast | A11y |
| --- | --- | --- | --- | --- |
| No / No | default | none | gradient ends per Editor Toolbar buttons | `<button aria-pressed="false">` |
| No / Yes | hover | Charcoal `#25212A` | fill vs `#161518` 1.15:1 — near-invisible | — |
| Yes / No | selected | Blue Dark 2 | Snow 8.61:1; fill vs `#161518` 2.06:1 | `aria-pressed="true"` |
| Yes / Yes | selected + hover | Blue Dark 3 | Snow 11.61:1; fill 1.53:1 | — |

### TextureContainedRoundedButton (Buttons)

Set [`21232:42111`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21232-42111), 2 variants (`Hover` No / Yes; Hug 132 × 82 dashed `#8A38F5` set frame is Figma chrome). 40 × 40, 100px pill; one `Texture` child 40 × 40, 100px, Snow-coloured (an image or fill slot; its type was not distinguishable in the panel); the set aggregate also lists Primary, Onix Dark 1 and White, so the instances on the page carry a tooltip like rounded-button-contained. Code: none found — Creator Hub none; inspector none.

| Variant | State | Fill | Contrast | A11y |
| --- | --- | --- | --- | --- |
| Hover=No | default | none; `Texture` child | texture image decides; ring not drawn | `<button aria-label>`, image `alt=""` |
| Hover=Yes | hover | White 10 | fill vs `#161518` 1.31:1 — faint | — |
| any | ✱ focus / press / disabled | — | — | not drawn |

### Checkbox Secondary (Checkbox)

Set [`20849:724`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20849-724), 4 variants (`Property 1` Off / Hover / On / HoverSelected; verified from the layer tree, each read singly). 20 × 20 box, 5px radius, no fill, 1px White 40 border; checkmark `Checkmark (Stroke)` 12 × 10 at 4 / 5; hover and selected-hover add a 32 × 32 halo at −6 / −6, 100px radius, behind the box. The dashed `#A14BF3` frame is Figma chrome. Code: `components/ui/CheckboxField` `color="secondary"` is this set as drawn (Primary tick, no caller yet), and `color="tertiary"` is Checkbox Terciary, below; Creator Hub ui2 `Checkbox` inside `FormControlLabel` (`AppSettings` `EditorTab`, `OptimizeModal`, `PreviewOptions`; MUI defaults).

| Variant | State | Box | Mark | Halo | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | 1px White 40, no fill | — | — | border 3.84:1 on `#161518` (3.83 on `#16141a`, 3.74 on card), passes 3:1 non-text | `<input type="checkbox">`, 24px label row |
| Hover | hover | 1px White 40 | — | White 10 | halo vs `#161518` 1.31:1 — faint | — |
| On | selected | 1px White 40 | tick Primary | — | tick 4.99:1 on `#161518` (4.35 on card); border 3.84:1 | `checked`; label and tick both change |
| HoverSelected | selected + hover | 1px White 40 | tick Primary | `#FF2D55` @ 20% | halo vs `#161518` 1.24:1 | — |
| any | ✱ indeterminate | 1px White 40 | Primary dash (`color="secondary"`) | as On / HoverSelected | dash 4.99:1 on `#161518`, 4.35 on card and panel | announced as mixed |
| any | ✱ disabled | 1px White 20 | `--base-09` mark when checked (`color="secondary"`; the disabled label's colour) | none | exempt (mark 6.06:1 on panel, 6.96 on `#161518`) | `disabled` |
| any | ✱ focus | — | — | ✱ focus ring | ring `--focus-ring` / ui2 `palette.info.light`, ≥ 3:1 | not drawn; 20px box sits inside a ≥ 24px row |

### Checkbox Primary (Checkbox)

Set [`21170:30118`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21170-30118), 4 variants (same four `Property 1` values). 20 × 20, 5px radius; the selected variants fill Primary and draw the tick in `Neutrals/Shadow` `#161518`. The tick is `Checkmark (Stroke)` `21170:30126`, 12 × 10 at 4 / 5: one round-capped, round-joined stroke about 1.8px wide, from 0.9 / 5.2 through 4.4 / 9.1 to 10.9 / 0.9 in its box (canvas measurement, ±0.2px). Code: the inspector's 3D-panel checkbox, `components/ui/CheckboxField` with `color="primary"` (the default), at 20 × 20 with a 6px halo. `color="secondary"` is Checkbox Secondary, above, and `color="tertiary"` is Checkbox Terciary, the UI Designer's checkbox, below. Unchecked: 1px `--palette-whiteTransparent-blurry` (aliased `--ui-designer-checkbox-border`), no fill. Checked and indeterminate: fill and border `--primary-main`; the border takes the fill colour, so the box reads borderless without changing size. The tick and the indeterminate dash are `--base-20` (Neutrals/Shadow), drawn as a CSS mask over a token background, so no colour is baked into an SVG. The mask is that stroke (`stroke-width="1.8"`), not the old hairline tick glyph. With an error on a checked box the `--error-main` border sits on the Primary fill at 1.01:1; the error message, not the border, is the cue there. Halo: `--palette-whiteTransparent-subtle` on hover, and on checked + hover `--primary-main` at 20% via `color-mix`, with no new token; it follows the box radius instead of Figma's circle. The focus ring is `--focus-ring`, offset 2px. The visible `Label` is linked with `htmlFor` (a `useId()` id; a caller's `id` or `aria-label` wins), so every call site is named by its label and clicking the label toggles the box; an `InfoTooltip` icon inside the label cancels its click, so it opens the tooltip without toggling. Creator Hub: the filled style is a checked MUI `Checkbox` with `color="primary"`.

| Variant | State | Box | Mark | Halo | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | 1px White 40, no fill | — | — | 3.84:1 on `#161518`, 3.74 on card | `<input type="checkbox">`, ≥ 24px label row |
| Hover | hover | 1px White 40 | — | White 10 | 1.31:1, decorative | — |
| On | selected | fill Primary, border Primary | `#161518` tick | — | fill 4.99:1 on `#161518` (4.35 on card); tick on Primary 4.99:1 | `checked` |
| HoverSelected | selected + hover | fill Primary | `#161518` | `#FF2D55` @ 20% | halo 1.24:1, decorative | — |
| any | ✱ indeterminate | fill Primary, border Primary | ✱ `#161518` dash (10 × 2) | as On / HoverSelected | dash on Primary 4.99:1 | `indeterminate`; announced as mixed |
| any | ✱ disabled, unchecked | 1px White 20, no fill | — | none | exempt | `disabled` |
| any | ✱ disabled, checked or indeterminate | fill and border `--base-12` | `--base-20` mark | none | exempt (fill 2.52:1 on card, mark 2.89:1 on the fill) | `disabled` |
| any | ✱ focus | as its state | as its state | — | `--focus-ring` 15.45:1 on card (offset 2px) | not drawn |

### Checkbox Terciary (Checkbox)

Set [`21650:4570`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21650-4570), 4 variants (`Property 1` Off `21650:4571` / Hover `21650:4573` / On `21650:4576` / HoverSelected `21650:4579`; read singly). 20 × 20 box, 5px radius, no fill, 1px inside border Transparencies/White 40 in every variant; tick `Checkmark (Stroke)` 12 × 10 at 4 / 5 in **Neutrals/Snow `#FCFCFC`** on On and HoverSelected; Hover and HoverSelected both add a **White 10** halo, 32 × 32 at −6 / −6, 100px radius. No indeterminate, disabled or focus variant (✱ below). Code: `components/ui/CheckboxField` `color="tertiary"`, the UI Designer's checkbox: the right rail's Properties and Logic tabs, and the MobileHUD panel's raw checkboxes (same colours in `MobileHudPanel.css`). The rails draw it at 14 × 14 with a 4px radius, a 4px halo, an 8.4 × 7 tick (the 12 × 10 stroke scaled 0.7, about 1.26px wide) and the `--ui-designer-control-accent` focus ring at a 1px offset: that is rail geometry (`PropertyPanel.css`, `MobileHudPanel.css`), and the colours are the variant (`CheckboxField.css`). The UI Editor panel frame `Header` [`21067:24647`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21067-24647) still draws its 14px instances (`21645:2360` On, `21645:2369` Off) as `Checkbox Secondary` with a Neutrals/Gray `#CFCDD4` tick override; the set wins, so the code tick is Snow ✱ (Figma-side: swap the frame's instances to this set). The MobileHUD frame `21281:45188` draws its three global toggles as the same outline boxes, all Off.

| Variant | State | Box | Mark | Halo | Token | Contrast on the panel `#242129` (on `#161518`) |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | 1px White 40, no fill | — | — | `--palette-whiteTransparent-blurry` (the shared box; the rails' `--ui-designer-checkbox-border` is its alias) | border 3.74:1 (3.84) |
| Hover | hover | as Off | — | White 10 | `--palette-whiteTransparent-subtle` | 1.36:1, decorative (1.31) |
| On | selected | 1px White 40, no fill | Snow tick (Checkmark stroke mask) | — | tick `--ui-designer-text` | tick 15.45:1 (17.73); border 3.74:1 |
| HoverSelected | selected + hover | as On | as On | White 10 | `--palette-whiteTransparent-subtle` | 1.36:1, decorative; the border on the halo stays 3.29:1 |
| any | ✱ indeterminate | as On | Snow dash (10 × 2; rails 8 × 2) | as On / HoverSelected | `--ui-designer-text` | dash 15.45:1 |
| any | ✱ disabled, Off | 1px White 20, no fill | — | none | `--palette-whiteTransparent-soft` | exempt (1.91:1) |
| any | ✱ disabled, On or indeterminate | 1px White 20, no fill | Silver mark | none | `--palette-whiteTransparent-soft`, mark `--ui-designer-text-muted` | exempt (mark 5.85:1) |
| any | ✱ error | `--error-main` border | as its state | as its state | `--error-main` | the message is the cue |
| any | ✱ focus | as its state | as its state | — | `--focus-ring` 2px, offset 2px; rails `--ui-designer-control-accent` 2px, offset 1px | 15.45:1; accent 7.09:1 |

### End (Checkbox)

Set [`20932:5479`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20932-5479), 2 variants (`Property 1` En / Start; "En" is Figma's spelling of End; the set is the `<FormControlLabel>` placement example). Each Hug 199 × 20, gap 10: `Checkbox Secondary` Off, label "Open Debug Console" Inter 400 14 / 100% (`H7 Regular`) `DCL/Snow` `#FCFCFC` (141 × 17), `help` icon 18 × 18. En puts the box first, Start puts it last. Code: Creator Hub ui2 `FormControlLabel` `labelPlacement` `end` / `start`; inspector `CheckboxField` renders box then label only.

| Variant | Order | Label | Contrast | A11y |
| --- | --- | --- | --- | --- |
| En | box · label · help | Snow | 17.73:1 on `#161518` (17.81 on `#16141a`) | `<label>` wraps the input, so the name is the visible text; `help` needs its own `aria-label` or `aria-describedby` |
| Start | label · help · box | Snow | same | same |

### Sort-By (Dropdown)

Set [`20785:59388`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20785-59388), 2 variants (`Property 1` Vertical / Horizontal; orientation only, no states). Vertical Hug 71 × 40, gap 4; Horizontal Hug 164 × Fixed 48, padding 8 / 0, gap 10; both 9999px radius, no fill or border. Inside: "Sort by" Inter 400 16 / 100% (`H6 Regular`) `Neutrals/Silver` (56 × 19); an `Input` row (gap 10; 6px radius and 10px padding on the Horizontal one) holding "Newest" Snow (Vertical Inter 400 14, Horizontal Inter 400 16) and an `arrow-down` 10 × 10. Code: Creator Hub `ManagePage` (`Typography` "Sort by" + `components/Select`, ui2 `Select` `variant="standard"`, 8px radius, White 10 hover fill, 12px / 2px padding) — drift on label size and the chevron; inspector none.

| Variant | State | Label | Value | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Vertical | default | Silver 16 | Snow 14, chevron 10 | Silver 6.71:1 on `#161518` (6.74 on `#16141a`); Snow 17.73:1 | the visible "Sort by" labels the control: `aria-labelledby` |
| Horizontal | default | Silver 16 | Snow 16, chevron 10 | same | same; 48px row target |
| any | ✱ hover / focus / open / disabled | — | — | — | not drawn; open uses the Dropdown-Input Selected menu |

### Dropdown-Input (Dropdown)

Set [`20898:5394`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20898-5394), 3 variants (`Property 1` Default `20898:5395` / Hover `20898:5400` / Selected `21220:16635`). Fixed 500 wide, vertical, gap 10: `Title` Inter 600 16 / 100% (`H6 Semi`) `#FFFFFF` (500 × 19); `Description` Inter 400 14 / 100% (`H7 Regular`) `DCL/White` `#FCFCFC` (500 × 17); `Container` Fill × Fixed 46, 12px radius, 1px border, padding 0 / 16, gap 10, no fill, holding the value "Text" Inter 400 16 / 100% (`H6 Regular`) Snow (444 × 19) and a 14 × 14 chevron. Selected is the open state: Hug 229, chevron `ArrowUp`, and a `Menu` instance (Fill 500 × Hug 117) under the container — the documented Menu (Onix `#35333B`, 1px White 10, 12px radius, `0 4px 8px` Black 40, padding 10 / 0, gap 10). Its two slots (`Options`, `Options2`) are padded 0 / 10, so every row sits inset 10px from both menu edges; the first slot holds a Menu-Entry **Hover** (Fill 480 × 38, 8px radius, padding 0 / 10, gap 10, fill Pale Black `#43404A`) carrying the 16px `Checkmark` and the label in `menu/itemDefault` (Inter 400 16 / 150%, 0.15px tracking, Snow), the second a Menu-Entry Default (same box, no fill), with a Div between them (re-read October 20, 2026). Code: inspector `components/ui/Dropdown`, dense only (26px `--controlHeight-small`, 6px `--shape-borderRadius`, padding 0 / 8, `--gray-0` fill and border, hover border `--base-09`, open `--base-01`, keyboard focus a 2px `--ui-designer-control-accent` outline at 2px offset). Its open list (`OptionList`, portalled to `body`) is a `--gray-0` Pale Black panel with a 4px radius and no border or side inset, and the hovered or keyboard-active row is a full-width `--primary-main` band — drift on the menu fill, radius, border, inset and row fill; the UI Designer's lists add the White 10 border and 12px radius (`PropertyPanel.css`, `data-dropdown-scope="ui-designer"`). Creator Hub `components/Select` + `components/Dropdown` (ui2 `Select` standard, MUI `Menu`) — drift.

| Variant | State | Container border | Chevron | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | 1px White 40 | down 14 | border 3.84:1 on `#161518` (3.83 on `#16141a`); Title 17.73:1; Snow value 17.73:1 | `role="combobox"` `aria-haspopup="listbox"` `aria-expanded="false"`, name from Title (`aria-labelledby`), `aria-describedby` the Description |
| Hover | hover | 1px White 60 | down 14 | border 7.07:1 | — |
| Selected | open | 1px Snow | up 14 | border 17.73:1; menu fill vs `#161518` 1.46:1 — border and shadow carry the edge; hovered row Pale Black vs the Onix menu **1.23:1**, Snow label on it 9.88:1 | `aria-expanded="true"`; Menu as documented, `role="listbox"` options, `aria-selected` on the Checkmark row; Escape closes, focus returns to the field. The row fill alone is under 3:1, so ✱ a row the arrow keys make active also draws a 1px inset `--focus-ring` (9.88:1 on the row); a hovered row keeps the fill alone, as Figma |
| any | ✱ focus / disabled / error | ✱ focus ring | — | `--focus-ring` Snow (17.73:1 on `#161518`, 15.45 on `#242129`), per the design review | not drawn; 46px target. The `Text` inner frame carries a 1px left border weight with no stroke colour — treat as none |
| Selected | ✱ section header in the list | divider inset with the rows (`--uid-space-1` each side) | — | accepted deviation (user, October 21, 2026): Figma draws the Div inset in the Menu-Entry set `20749:790` but full-bleed in every composed menu (`20749:386`, this Selected variant); the inspector keeps it inset | the header is not focusable; the divider is decorative |

### Filter (Filter / Sort / Search bar)

Component [`20768:61659`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20768-61659), 1 variant (`Slot` Default; the page frame is `20461:3770`). Fill × Fixed 56, horizontal, 999px radius, padding 0 / 10 / 0 / 30, gap 16, fill White 10. Left: `ResultsNumber` "N Text" Inter 400 16 / 100% (`H6 Regular`) Silver (345 × 19). Right `Slot` (Hug 751 × 51, gap 30): `Filter` group (gap 16: "Filter by" Silver 16, `Pills` gap 12 holding two PillIconText instances in `Idle`, Hug 69 × 33, 8 / 16 padding, 1.5px White 10 border, 100px radius, icon `Videos`), a Sort-By Horizontal instance, and a `Search-Bar` instance (`Property 1` Default, Fixed 300 × Hug 51, padding 6 / 0; its `Container` Fill × 39, 100px radius, 1px White 40 border, padding 10 / 40 / 10 / 10, gap 10, a 19 × 19 `Search` icon and "Search" Inter 400 16 / 100% White 40). Only the Default Search-Bar is on this page; its other states are not drawn. Code: Creator Hub `ManagePage` row (`FiltersBar` left / right `Row`, a `Chip` filter set, `Typography` "Sort by", `components/Select`, `components/Search` — 40px, 1px `--transparent-gray-light` border, 12px padding, 600 weight) — drift on bar fill, 56 height, pill geometry and the 600 weight; inspector `components/Search` (14px icon, 5px padding, red icon colour) is a tree filter, not this bar.

| Part | State | Fill / border | Text | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Bar | default | White 10 (`#2D2C31` over `#16141A`, `#2D2C2F` over `#161518`), no border | — | bar vs page 1.32:1, decorative | `role="search"` on the form, or a labelled `role="toolbar"` |
| ResultsNumber | default | — | Silver 16 | 5.11:1 on the bar | `aria-live="polite"` for the count |
| Filter by | default | — | Silver 16 | 5.11:1 on the bar | labels the pill group (`role="group"`, `aria-labelledby`) |
| Pill (Idle) | default | 1.5px White 10 | per PillIconText | border 1.31:1, the label carries it | `aria-pressed` |
| Sort-By | default | none | Silver label, Snow value | Snow 13.50:1 on the bar | as Sort-By |
| Search-Bar | default | 1px White 40 | placeholder White 40 | **placeholder 3.53:1 on the bar — fails 4.5:1** (the border passes 3:1); typed text should be Snow 13.50:1 | `<input type="search">` with an `aria-label`; ✱ the Figma placeholder doubles as the only label |
| Search-Bar | ✱ hover / focus / filled / clear | ✱ White 60 / ring / — | — | ring ≥ 3:1 | not drawn |

### Radio (Radio)

Set [`20903:5661`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20903-5661), 4 variants (`Property 1` Off / Hove / On / OnHover; "Hove" is Figma's spelling; verified from the layer tree, each read singly). 20 × 20 ring, 100px radius, no fill; selected adds a 10 × 10 dot at 5 / 5 in Primary; hover and on-hover add a 32 × 32 halo at −6 / −6. Code: Creator Hub ui2 `Radio` / `RadioGroup` (`PreviewOptions`, `AppSettings` `ScenesTab`; MUI defaults); inspector none.

| Variant | State | Ring | Dot | Halo | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | 1px White 40 | — | — | 3.84:1 on `#161518` (3.83 on `#16141a`) | `<input type="radio">` in a `role="radiogroup"` |
| Hove | hover | **1px White 60** (Checkbox hover keeps White 40) | — | White 10 | ring 7.07:1; halo 1.31:1 | — |
| On | selected | 1px White 40 | Primary 10 | — | dot 4.99:1 on `#161518` (4.35 on card) | `checked`; arrow keys move within the group |
| OnHover | selected + hover | 1px White 40 | Primary 10 | `#FF2D55` @ **10%** (Checkbox HoverSelected is 20%) | halo 1.09:1 | — |
| any | ✱ focus / disabled | ✱ focus ring | — | — | ring ≥ 3:1 | not drawn |

### End (Radio)

Set [`21028:42345`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-42345), 2 variants (`Property 1` End / Start), identical to the Checkbox `End` set with a Radio Off in place of the box: Hug 199 × 20, gap 10, label "Open Debug Console" Inter 400 14 / 100% Snow (141 × 17), `help` 18 × 18. Code: ui2 `FormControlLabel` with `Radio`.

| Variant | Order | Label | Contrast | A11y |
| --- | --- | --- | --- | --- |
| End | radio · label · help | Snow | 17.73:1 on `#161518` | label wraps the input; the group needs a visible or `aria-label` name |
| Start | label · help · radio | Snow | same | same |

### Search-Bar (Search Bar)

Set [`20768:1462`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20768-1462), 4 variants (`Property 1` Default / Hover / Selected / Completed; verified from the layer tree, each read singly). Fixed 300 × Hug 39, gap 10. `Container` Fill × Fill 39, 12px radius, 1px border, no fill, padding 10 / 40 / 10 / 10 (Completed: 10 all round), gap 10; a 19 × 19 `Search` glyph (Snow) then a `Text` frame Hug × 19 holding Inter 400 16 / 100% (`H6 Regular`). The Selected caret is a 1.5px Snow left edge on that frame; the Completed caret a Snow right edge. Completed adds a `Close-Button` and a `Gap` spacer (below). The Filter page's instance is Hug 51 with padding 6 / 0 and a 100px radius: those are that instance's overrides, the set's own radius is 12px. Code: inspector `components/Search` (tree filter: 14px icon, 5px padding, red icon colour, 13px text) — drift on every value; Creator Hub `components/Search` (`SearchInput` 220 × 40, 1px `--transparent-gray-light`, 12px input padding, 600 weight, clickable `svg`) — drift on width, border colour, radius and weight.

| Variant | State | Border | Placeholder / value | Glyph | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | 1px White 40 | "Search" White 40 | Snow | border 3.84:1 on `#161518` (3.83 on `#16141a`, 3.74 on card), passes 3:1; **placeholder 3.84:1 — fails 4.5:1 as text** | `<input type="search">` with an `aria-label`; the placeholder is not a label |
| Hover | hover | 1px Snow | "Search" White 40 | Snow | border 17.73:1 | — |
| Selected | focus, empty | 1px Snow + 1.5px Snow caret | "Search" **White 20** | Snow | **placeholder 1.88:1 on `#161518` — fails 4.5:1** (dimmer than Default); border 17.73:1 | the Snow border is the focus indication, 3:1 passes; ✱ still add `:focus-visible` ring `--ui-designer-control-accent` `#63B4F6` / ui2 `palette.info.light` if the border is not kept |
| Completed | filled | 1px Snow | "Text" Snow, caret on the right | Snow | text 17.73:1; the Close-Button fill is Snow on White 5 15.61:1 | clear button `<button aria-label="Clear search">`; Escape clears |
| any | ✱ disabled / error | — | — | — | — | not drawn |

### Close-Button (Search Bar)

Set [`20768:59567`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20768-59567), 2 variants (`Hover` Off / On; verified from the layer tree). 24 × 24, 100px radius; `Close` 16 × 16 at 4 / 4 holding a 9.33 × 9.33 vector at 3.33 / 3.33, Snow fill plus a 0.2px outside Snow stroke. In the Search-Bar Completed variant it is a 19 × 19 instance (glyph 12.67, vector 7.39), so the glyph scales with the instance. Code: none (Creator Hub `Search` has a clickable `svg`, no clear button); inspector none.

| Variant | State | Fill | Glyph | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Hover=Off | default | White 5 (`#FFFFFF` @ 5%, unnamed) | Snow | fill vs `#161518` 1.14:1 — nearly invisible; glyph 15.61:1 | `<button aria-label>`; **19px instance is below the 24px floor — keep 24px or pad the hit area** |
| Hover=On | hover | White 10 | Snow | fill 1.31:1; glyph 13.53:1 | — |
| any | ✱ focus / press / disabled | — | — | ✱ ring ≥ 3:1 | not drawn |

### Slider (Slider)

Component [`21625:15070`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21625-15070) on the Slider page, 1 variant (a single component, no states; added October 20, 2026; structure from `get_metadata`, values from the Properties panel). Fixed 250 × Hug 6. `Bar` `21625:15072` Fill 250 × Hug 6, 100px radius, fill `Neutrals/Cloudy Sky` `#716B7C`, padding right 200 (the unfilled share in this instance); inside it `Fill&Handle` `21625:15075` Fill 50 × Hug 6, 100px radius, fill `Primary/Primary` `#FF2D55`, and the `Handle` `21625:15076`, a 14 × 14 ellipse filled `Primary Base/Primary` `#FF2D55`, absolutely placed at 36 / −4 so it ends flush with the fill and centres on the bar. Both ends of the track and of the fill are fully round; nothing sits beyond them. No stroke, no shadow. Code: inspector `ui/RangeField` (8px square-ended track, `--primary-main` fill over `--base-10`, a 10px `::before` / `::after` dot at each end — the "ellipses" — and a 20px thumb; `outline: none` on focus, a 1px `--base-01` thumb border in WebKit only), restyled with hardcoded `#ff2d55` / `#808080` in `SmartItemBasicView.css`; `ui/RangeHourField` (the skybox time, a sky gradient on a 4px-radius 8px track, white thumb, `#361c75` end dots, all `!important`); the UI Designer colour popover's hue and alpha bars are `react-colorful` (24px, square or bottom-only rounded ends) and follow the ColourPanel `Slider` set instead; Creator Hub `OptimizeModal` texture quality is ui2 / MUI `Slider` (round rail ends already).

| Part | State | Fill | Size | Radius | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Bar (track) | default | Cloudy Sky `#716B7C` | 250 × 6 | 100px | 3.55:1 on `#161518`, 3.09 on `#242129` — passes 3:1 | `<input type="range">`, named by its label; ✱ the input box stays ≥ 24px tall, the bar is drawn inside it |
| Fill&Handle (value) | default | Primary `#FF2D55` | value share × 6 | 100px | 4.99:1 on `#161518`, 4.35 on `#242129`; vs the bar 1.41:1 — the handle and its value field carry the value | — |
| Handle (thumb) | default | Primary `#FF2D55` | 14 × 14 | 50% | 4.35:1 on `#242129`; vs the bar 1.41:1 | 14px is under 24px: the thumb is not the hit target, the input is |
| any | ✱ hover / focus / disabled | — | — | — | focus: a 2px `--focus-ring` ring on the thumb (15.45:1 on `#242129`) | not drawn; disabled keeps today's `--base-12` / `--base-11` and is exempt |

### Switch (Switch)

Set [`20907:6053`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20907-6053), 3 variants (`Property 1` Default / On / Off; verified from the layer tree). A different set from the Buttons page's `Switch` `21167:30101` (41 × 24, legacy `DCL/Snow` · `DCL/Ruby`): this one is Fixed 52 × 30, built on `Neutrals/Graffito`, `Neutrals/Snow` and `Primary/Primary`. Track 50.21 × 30 at left 0.47, 58.82px radius; knob 25.1 × 25.1, 58.82px radius, 2.45 from the top, left 3.05 (Off, Default) or 22.52 (On). The page's dashed `#8A38F5` frame is Figma chrome. Code: Creator Hub ui2 `Switch` (`OptimizeModal`, MUI default sizing) — drift on size and colours; inspector none. The two Figma sets disagree on size (41 × 24 vs 52 × 30) and colours: the user picks one.

| Variant | State | Track | Knob | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Off | default | Graffito `#5E5B67` | Snow, left | **track vs `#161518` 2.74:1 (2.76 on `#16141a`, 2.39 on card) — fails 3:1 non-text**; knob on track 6.46:1 | `<input role="switch" aria-checked="false">` |
| On | selected | Primary `#FF2D55` | Snow, right | track 4.99:1 on `#161518` (5.01, 4.35 on card); knob on track 3.55:1, passes 3:1 | `aria-checked="true"`; position and colour both change |
| Default | disabled look | Graffito, whole node at 50% opacity | Snow, left | track vs `#161518` 1.58:1, knob on track 3.30:1 — disabled, exempt | `aria-disabled="true"`; ✱ "Default" is Figma's name for what reads as a disabled Off |
| any | ✱ hover / focus / disabled On | — | — | ring ≥ 3:1 | not drawn; 30px tall clears 24px |

### Text-Input (Text Field)

Set [`20815:1961`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20815-1961), 7 variants (`Status` Default `20815:1960` / Hover `20815:1962` / Selected `20815:2015` / Editing `20815:1967` / Input Highlighted `21626:15139` / Filled `20820:683` / Error `20817:977`; verified from the layer tree, each read singly; Title and Description read on Default, Hover and Error and are the same in all). Design renamed the property from `Property 1` to `Status` and `Completed` to `Filled`, and added Input Highlighted, on October 20, 2026. Fill 500 × Fixed 102 (Error 146), vertical, gap 10. `Title` Inter 600 16 / 100% (`H6 Semi`) `#FFFFFF`; `Description` Inter 400 14 / 100% (`H7 Regular`) `DCL/White` `#FCFCFC` (legacy name, value is Snow); `Container` Fill × 46, 12px radius, no fill, padding 14 / 16, gap 10, holding the value (Inter 400 16 / 100%, `H6 Regular`, 438 wide) and a 20 × 20 `LocalAssets` folder glyph (18.33 × 13.33 vector, Silver `#A09BA8`; no button state drawn). Selected and Editing draw a caret (1.5px Snow left edge, or an 18px × 1px `#FFFFFF` `Line 1` rotated −90°). Error adds a message under the container, 500 × 34, Inter 400 14 / 100% `System/Red` `#FB3B3B`, wrapping to two lines. The dashed `#8A38F5` frame is Figma chrome. Code: inspector `components/ui/TextField` `size="large"` on the five form sites (`UrlInputModal`, `CreateScriptModal`, `CreateEditTagModal`, `CreateCustomAsset`, `RenameAsset`): 46px `--controlHeight-large`, 12px `--shape-borderRadiusLarge`, padding 0 / 16, no fill, 1px `--palette-whiteTransparent-blurry`, hover and filled `--palette-whiteTransparent-backdrop`, focus `--ui-designer-text` (Snow) and error `--error-main` as a 1px border plus `box-shadow: inset 0 0 0 0.5px` in the same colour (a true 1.5px; Chromium floors a 1.5px border to 1px at DPR 1 and 2 alike), disabled `--palette-whiteTransparent-soft`; value Inter 400 16 Snow, placeholder `--ui-designer-text-muted` (Silver, 6.71:1, where Figma's White 40 is 3.84:1), label Inter 600 16. The visible label names the input (`htmlFor`, a `useId()` id; a caller's `id` wins). Error sets `aria-invalid` and links the message with `aria-describedby`; `UrlInputModal` and `CreateScriptModal` draw their own message and link it the same way. Every other site takes the dense default (26px `--controlHeight-small`, 6px `--shape-borderRadius`, padding 0 / 8, 1px `--gray-0`, hover `--base-09`, focus `--base-01`, error `--error-main` and `--error-light`, 13px), and `TextArea` shares its 6px radius. `FileUploadField` draws the folder glyph — matches on the large size; Creator Hub ui2 `TextField` inside `InputLabel` (`DetailsTab`, MUI default) — drift.

| Variant | State | Container border | Value | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | 1px White 40 | "Text" White 40 (placeholder) | border 3.84:1 on `#161518` (3.83 on `#16141a`), passes 3:1; **placeholder 3.84:1 — fails 4.5:1 as text**; Title 18.19:1; Description 17.73:1; folder glyph 6.71:1 | `<label>` wraps the Title; `aria-describedby` the Description |
| Hover | hover | 1px White 60 | White 40 | border 7.07:1 | — |
| Selected | focus, empty | **1.5px** Snow | "Text" **White 20** + 1.5px Snow caret | border 17.73:1; **placeholder 1.88:1 — fails 4.5:1** | the Snow border is the focus indication; ✱ keep a `:focus-visible` ring if it is dropped |
| Editing | typing | 1.5px Snow | "Text" Snow + `Line 1` caret | text 17.73:1 | `Container` is Fixed 46 while the variant is Hug 102 — treat as the same box |
| Input Highlighted | focus, text selected | 1.5px Snow | "Text" Snow (`H6 Regular`) on a `TxtInput` box Hug × 20 filled `System/Blue Dark 2` `#244B7D` (its 1px right border weight has no colour — treat as none) | selected text 8.61:1 on Blue Dark 2; the highlight vs the field's surface 2.06:1 on `#161518`, 1.79 on `#242129` — and on the dense fills only 1.15:1 (`--gray-0`) and 1.41 (Onix) | the text's own `::selection`; selection is not the focus indicator, the Snow border is |
| Filled | filled, idle | 1px White 60 | "Text" Snow | border 7.07:1; text 17.73:1 | the White 60 border is the only cue that a value is set |
| Error | error | 1.5px `System/Red` `#FB3B3B` | "Text" Snow + caret | border 5.02:1 on `#161518` (5.04 on `#16141a`, **4.37 on card**); message 5.02:1 on `#161518` (**4.37 on card — fails 4.5:1**) | `aria-invalid="true"`, message linked by `aria-describedby`, `role="alert"` on change; colour alone is not the cue, the message text is |
| any | ✱ disabled / read-only | — | — | — | not drawn; 46px target |

### AvatarSnapshot (Avatars)

Set [`21232:42261`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21232-42261), 24 variants (`AvatarSnapshot` = `DefaultProfileThumbnail`, `001` … `023`; "24 Selected" in the Layers panel), inside the board `Cards&Items` `21232:42260` (vertical, Hug 1822.78 × 826.79, 64px radius, 100 padding, gap 10, Pale Black). The set frame is the dashed `#9747FF` Figma chrome (1622.78 × 626.79, 3.62px radius). Every variant is a 180 × 180 raster on a 200px grid (`001` at left 200 / top 14, so a 20px gutter); no radius, border, fill or state is drawn on a variant. `DefaultProfileThumbnail` is a white person silhouette on a transparent ground; `001` – `023` are avatar snapshots. This is the source asset for the `AvatarSnapshot` inside `ProfilePic` (Profile Snapshot), which owns the circle, ring and sizes (28 / 32 / 40 / 60) — see that subsection, nothing is respecified here. Code: Creator Hub `Header/UserMenu` renders the signed-in avatar through ui2 `AvatarFace` (a profile snapshot fetched at runtime, never one of these fixtures) — no consumer of the 24 rasters; inspector none.

| Variant | State | Content | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| DefaultProfileThumbnail | default | white silhouette, transparent ground | 180 × 180 | silhouette (White) vs page `#16141a` 18.28:1; vs Lavender (the `ProfilePic` fill) not computed | the fallback when no snapshot resolves; `alt` comes from the owner's name, never the file name |
| `001` – `023` | default | full-colour avatar render | 180 × 180 | raster: no token, no contrast to enforce | decorative inside a named control (`alt=""`), otherwise `alt="<name>"`; ids are filenames, not copy |
| any | ✱ hover / focus / disabled / loading | — | — | — | not drawn; the states belong to the host control (`ProfilePic` ✱ ring), not to the raster |

### Logo (Logo)

The page defines no component set: it is a specimen board of one library instance, `Icon/Explorer` (`10394:257174`, 128 × 128 round Decentraland mark, white sails and sun on a gradient disc), titled "Decentraland Logo" (`app-icons` `21454:39193`, Inter, Hug 899 × 119, Snow), and an "Icon Sizes" ramp (`ch-icon` `21454:39197`; title Inter 600 98 / 100%, Snow; ramp frame `Frame 1000001123` `21454:39200`, Hug 1064 × 2378, vertical, padding 20, gap 51, 1px dashed `#9747FF` chrome). No safe area, padding, minimum size, clear space or export format is drawn; the one asset system the page defines is the size ramp.

| Size (px) | Label frame   | Label       | Notes                                     |
| --------- | ------------- | ----------- | ----------------------------------------- |
| 16        | `21454:39208` | `16x16`     | smallest cut                              |
| 32        | `21454:39209` | `32x32`     | —                                         |
| 64        | `21454:39210` | `64x64`     | —                                         |
| 128       | `21454:39211` | `128x128`   | same size as the `Icon/Explorer` instance |
| 256       | `21454:39212` | `256x256`   | —                                         |
| 512       | `21454:39213` | `512x512`   | —                                         |
| 1024      | `21454:39214` | `1024x1024` | the largest cut                           |

Labels are Inter 600 16 / 100%, uppercase, right-aligned, `Neutrals/Soft White` `#FCFCFC` (a third legacy name for Snow). Mark colours as the panel lists them (not a token set): `Linear Gradient` `#A524B3` → `#FF2D55` → `#FFC95B`, `#FC9965`, `#FFBC5B`, glyph `#FFFFFF`; `#FF2D55` is Primary (`--primary-main` inspector), the rest are brand-art literals with no token in either world. Code: Creator Hub `buildResources/icon.png`, `icon.icns`, `icon.ico` (the app icon; `IconAssets.iconset` holds the cut ramp) and `Navbar/LogoMenu` (the in-app mark) — the ramp above is the size list for those files, not verified against them; inspector none (no logo asset).

### Thumbnail (Scene's Thumbnails)

Set [`20506:34728`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20506-34728), 2 variants (`Property 1` = Default / Custom; verified from the expanded Layers tree), in the frame `thumbnails` `21454:39405` under a "Thumbnails" title (Snow). The set frame is dashed `#8A38F5` Figma chrome. Both variants are 640 × 360 (16 : 9) rasters stacked at left 21, Default at top 20 and Custom at top 400; no radius, border, overlay or state is drawn. Default is the empty-scene placeholder (a perspective grid on a grey ground); Custom is a sample user-supplied image (a night landscape). Code: Creator Hub `SceneCard` and `ProjectCard` (`.thumbnail`, a fixed 260px card with a 10px top radius and a cover-fit image) and `EditorPage` `OptionBox` — drift on ratio (the card crops to its own box, not 16 : 9) and radius (the raster has none); inspector none.

| Variant | State | Content | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | grid placeholder (no scene image set) | 640 × 360, 16 : 9 | raster: none to enforce; the grid lines are low-contrast by design | `alt=""` — the card title names the scene |
| Custom | default | the scene's own image | 640 × 360, 16 : 9 | raster | `alt=""`; the user's file is arbitrary, so any text over it needs its own scrim ✱ |
| any | ✱ hover / loading / error | — | — | — | not drawn |

### SectionImages (Section)

Set [`10525:291176`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10525-291176), 6 variants (`Image` = Scenes / Learn / Videos / Documents / Links / Image6; "6 Selected"), in the frame `images` `21457:18416` under a "Section Images" title (Snow). The set frame is dashed `#9747FF` chrome. Each is a PNG-export raster (`Export file type PNG` on all six) of a 3D-rendered icon in an orange → purple gradient; the page caption credits the open-source 3dicons library. Sizes: Scenes 300 × 300 and Image6 331 × 300 read singly; Learn, Videos, Documents and Links were not read singly and are 300 × 300 by canvas measurement (±2px). On the canvas the order is laptop (Scenes), book (Learn), camera (Videos), document (Documents), chain (Links) and a hand-and-gems render (`Image6`, canvas reading — its name does not say what it is). Code: none for the six renders — Creator Hub `Navbar` and `MorePage` carry the section names (Scenes, Learn, Videos, Docs) as text and glyphs only; inspector none.

| Variant | State | Content | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Scenes | default | laptop render | 300 × 300 | raster | decorative `alt=""` beside the section name |
| Learn | default | book render | 300 × 300 (canvas) | raster | as above |
| Videos | default | camera render | 300 × 300 (canvas) | raster | as above |
| Documents | default | document render | 300 × 300 (canvas) | raster | as above |
| Links | default | chain render | 300 × 300 (canvas) | raster | as above |
| Image6 | default | hand-and-gems render | 331 × 300 — the only non-square cut | raster | as above |
| any | ✱ hover / focus / disabled | — | — | — | not drawn; the host card owns the states |

Caption `21457:18419`: "Some assets are part of the 3dicons open sourcelibrary" — Inter 600 32 / 100%, right-aligned, `Neutrals/Gray 3` `#A09BA8` (Silver), with the span "3dicons" underlined (solid, a link). Contrast `#A09BA8` on Pale Black 3.74:1 — passes only as large text (32px / 600). The missing space in "sourcelibrary" is a Figma typo; keep the credit wherever the renders ship.

### Settings (App Settings)

Set [`21160:787`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21160-787), 5 variants (`Tab` × `State`, `Content` = Default on all; "5 Selected" in the Layers panel): Scenes / Default `21160:786`, Editor / Default `21160:784`, Editor / Dropdown `21220:16040`, Experimental / Custom `21176:30197`, Experimental / Default `21160:785`. The page is a screen, not a control library; the screen is recorded here as an inventory note. Boards: **App Settings** `21454:39028` (Hug 4510 × 1562, vertical, 64px radius, 2px White 10 border, padding 102 / 82, gap 35, Pale Black) holds the set; **Panel Components** `21454:39030` (Hug 1064 × 925, same chrome, gap 100) holds the two parts the modal is built from — a `TitleBar` instance (`21454:39034`: "Settings" Snow with a circular close button; specced in `TitleBar` above) and a `Sidebar` instance (`21454:39042`, parent component `Sidebar`, Fixed 180 wide × Fill height, 1px right border), whose `Options` frame holds four `TabVertical` instances (SCENES active, EDITOR, AI, EXPERIMENTAL; specced in `TabVertical` above). Neither is a new set. Every variant is Fixed 800 × 700 (Experimental / Custom is Hug 800 × 1158), 24px radius, fill `#181225`, 1px White 10 border, a vertical stack of `TitleBar` `21220:15180` then `Content` `21160:629` (horizontal, Fill 798 × Fill 648: the sidebar beside the pane) with a `Glow` `21160:647` (798 × 257.5, `DCL/Rarities/Mythic` `#FF4BED` at 30%, layer blur 500, decorative). Fill, border, radius and glow are the Modals `#181225` entries in "Surfaces tokens". Code: Creator Hub `Modals/AppSettings` over `Modals/TabsModal` (625 × 680 paper, `--black`, `#0000001a` body, 160px-min tab column, 8px header padding with a 1px `--light-gray` rule; tabs Scenes, Editor, AI, Experimental, About) — drift on size, radius, fill, border and glow, and the code has an About tab Figma does not draw (absence is not removal); inspector none.

| Variant | State | Pane content | Controls (existing spec) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Scenes / Default | default | "Scene Folder" label + a path field with a folder glyph; "Scene Dependencies" with three radios (Auto-update all my scenes, Notify me of new version updates — selected, Do nothing) | `Text-Input` (container, folder glyph), `Radio` (On) | Snow 17.77:1 on `#181225`; Primary radio dot 5.00:1; inactive tab labels White 40 3.82:1 (large text, 20px / 600, passes 3:1) | `role="dialog" aria-modal` named by the title; tabs `role="tab"` in a vertical `tablist`; the path value is user data, never a fixture |
| Editor / Default | default | "Code Editor of Choice" dropdown ("Visual Studio Code"); "Preview Options" checkboxes (Open Debug Console off, Enable Landscape Terrains on); "App Warnings" checkbox on, with a two-line label | `Dropdown-Input`, `Checkbox Primary` | as Scenes; checked fill Primary 5.00:1 | native `<select>` or `role="combobox"`; each checkbox named by its label |
| Editor / Dropdown | open menu | as Editor / Default with the dropdown open: "Visual Studio Code" (check mark) and "Choose from your device…" under a rule | `Dropdown-Input` open menu, `Menu` items | menu rows Snow on the lifted fill; the check mark is the selected cue, not colour alone | `role="listbox"`, `aria-activedescendant`; Escape closes and returns focus |
| Experimental / Default | default | two switches, both off: "Enable Bevy Scene Renderer", "Enable UI Editor" + a description under the second | `Switch` (the 52 × 30 set, Off) | Off track vs the modal ≈ 2.7:1 — the `Switch` spec's 3:1 non-text fail applies | `role="switch"`, description via `aria-describedby`; a restart or reload note is ✱ missing |
| Experimental / Custom | **shows the AI tab, not Experimental** | AI Assistant: "Enable AI Assistant" switch (on), a "Bill this to an API key instead" checkbox, a "Connect" accordion with two agent rows (a connected state and a sign-in action, each with install / sign-in command boxes), an "Expose AI assistant MCP server" accordion with a config code block (placeholder credentials, not copied) | `Switch` On, `Checkbox Primary`, `Accordion`, `Button-Contained-Text` | Snow 10.90:1 and Primary 3.07:1 at the brightest point of the glow (`#5D2361`, computed) — the glow sits at the bottom, keep the controls above it | code blocks need a copy button named "Copy" and `font-family: monospace`; the command text is selectable |
| any | ✱ focus / disabled | — | — | ring `--ui-designer-control-accent` 8.15:1 on `#181225` (as Modals) | `:focus-visible` 2px, first focus on the active tab; Escape closes |
| any | ✱ About tab | — | — | — | not drawn; the code ships it — add a fifth `TabVertical` and a variant |

Settings is named by its content: the `Experimental / Custom` frame shows the AI tab (sidebar item AI selected), so there is no Figma variant for the Experimental tab in a non-default state, and no "AI / Default". Body copy and field labels were not read singly (canvas only: section headings in a 600 weight above 14px rows); read them from the variant's text layers before implementing.

### Editor tokens

The Editor pages run on the UI Designer's own surface (`--ui-designer-panel-bg` `#242129`, Figma Charcoal `#25212A`) and on the Creator Hub's AI panel. Literals read this run and where they land:

| Figma swatch | Value | Inspector (UI Designer) | Creator Hub | Status |
| --- | --- | --- | --- | --- |
| Neutrals/Charcoal | `#25212A` | `--ui-designer-panel-bg` (`#242129`, deviation within 1/255) | AI panel `palette.background.paper` (value not verified) | match / documented deviation |
| Neutrals/Onix | `#35333B` | `--ui-designer-control-bg` | — | match |
| Neutrals/Onix Dark 1 | `#2D2A33` | missing | `--title-bar-button` | missing in inspector — fills `InputAction`, the 2D `Viewport` and the `ChatInput` container |
| Neutrals/Pale Black | `#43404A` | `--gray-0` | `--dark-gray` | match — `InputAction` hover fill |
| Neutrals/Cloudy Sky | `#716B7C` | `--ui-designer-glyph`, `--ui-designer-text-muted` is Silver | `--dropdown` | match — idle glyphs and the `Position` / `Size` icons |
| System/Blue Dark 2 | `#244B7D` | `--palette-system-blueDark2` (`--ui-designer-control-active-bg`; the `UIDesigner.css` `--selected-item` override) | `--ai-session-selected` | match |
| System/Blue Dark 3 | `#243852` | `--palette-system-blueDark3` | `--ai-session-selected-hover` | match — the tree row, selected-hover and `On` + hover toggle fill |
| White 5 / 10 / 20 | `rgba(255,255,255,.05 / .1 / .2)` | `--ui-designer-control-empty-bg` / `--ui-designer-control-selected-bg` · `--ui-designer-control-border` / `--ui-designer-control-border-strong` | — | match; the row hover is White 5 in Figma, the toggle and icon-button hover White 10 |
| System/Orange | `#FE9C2A` | `--warning-main` `#fe9c2a` | `--ai-warning-bg` `rgba(244,130,33,.16)` | drift (Figma banner is `#FE9C2A` at 10%); the inspector token now matches the Figma colour |
| System/Blue · Rarities/Epic Light | `#2196F3` · `#81E1FF` | missing | ui2 `palette.info.main` | missing — pinned-edge colours in `ConstraintsIcons` |
| Brand/Lavender | `#C640CD` | — | `--lavender` | demo colour in `ColourPanel` and `AspectRatio/Colour`, not a UI token |
| Figma chrome | `#8A38F5` | — | — | the dashed frame around every set — never a token |

PROPOSED (names are the user's call, nothing changed): an inspector token for Onix Dark 1 `#2D2A33`, and a decision on the row hover fill (`--ui-designer-control-empty-bg` 5% matches Figma's White 5 rows; the toggle hover is White 10 per `UI Editor Buttons`).

### ChatInput (AI Assistant)

Page `21206:31202`. The page is a screen plus a component row, not a library: board `Frame 3112` `21206:31203` holds the title "AI Chat", `<AIAssistantPanel>` with the `AiChat` instance `21206:31298` (Fixed 342 × 1028, vertical, fill Charcoal; a component with a `Messages` = Default property) and `<Components>` `21206:31533` with `Menu` `21206:31885` (chat history), `Header`, `TitleBar` and the `ChatInput` set. Set [`21206:31455`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31455), 2 variants (`Property 1` = Default `21206:31453` / Input `21206:31454`), 701 × 110, dashed `#8A38F5` chrome. Both are 310 × 70 with a 1px White 10 top rule; `Container` is Fixed 310 × Hug 40, 10px radius, fill Onix Dark 1, 1px Snow border, padding 6 / 10 / 6 / 10 (Input: right 8), gap 187; the text is `H8 Regular` 12 / 100%; the send button is `Button-Contained-Icon` 26 × 26, 100px radius, padding 12, Primary; the `Selection` row (310 × 30, 12px radius, padding 9, gap 6) carries `highlight_alt` + "Selection: Player" `Inter` 400 10 White 60 + `Close-Button` (Search Bar). Parts of the panel, all instances and nothing new to spec: `TitleBar` (Fill 342 × 36, Shadow, padding 10, gap 10, "AI Assistant" 12 / 600 uppercase Snow, `Open` + `Close-Button`), `Header` (Fill 342 × 39, padding 6 / 10, gap 10, 1px White 10 bottom rule; two dropdowns Fill 156 × 26, 6px radius, padding 6 / 8, Onix, "New Chat" `H8` Gray), the intro message (310 × 60, `H8` `#FFFFFF`), the usage card (322 wide, 12px radius, padding 20, gap 16, Onix; "About AI usage" `H7 Semi` 14 + body `H8` + a `Button-Contained-Text` Secondary 72 × 32, 8px radius, White 10) and the outdated-CLI banner (322 × Hug 65, 12px radius, padding 10 / 20, gap 16, `#FE9C2A` at 10%, `ErrorOutline` + `H8` text in System/Orange). Code: Creator Hub `components/AiChatPanel` (`component.styled.ts` `Panel`, `PanelHeader`, `IntroMessage`, `ErrorRow`, `Composer`, `AttachmentChip`; `ChatView.tsx`) and `AiChatWindow` (the detached window); inspector none.

| Variant | State | Container | Text | Send button | Contrast (on `#25212A`) | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | empty | Onix Dark 1, 1px Snow border | "Ask Assistant" Silver | Primary 26 × 26 | border 15.39:1; placeholder 5.20:1 on the container; send glyph Snow on Primary 3.55:1 (non-text ≥ 3:1) | `<textarea aria-label="Ask Assistant">`; send `<button aria-label="Send">`, disabled while empty ✱ |
| Input | typed | same, padding R 8 | typed text Snow | same | text 13.73:1; Primary vs container 3.86:1 | `Enter` sends, `Shift+Enter` newline ✱ |
| any | `Selection` row present | — | "Selection: Player" White 60 | — | chip text 6.54:1; Onix vs panel 1.27:1 | the chip is removable by `Close-Button` named "Remove selection" ✱ |
| any | ✱ focus / disabled / sending | — | — | — | ring `--ui-designer-control-accent` 8.15:1 on Charcoal (the Snow border is a rest state) | not drawn; the page shows no streaming or error state either |

Messages are `#FFFFFF` (not Snow) at 15.79:1; the usage card body is 12.44:1 on Onix; the banner text is 6.27:1 on its tint, and the tint is 1.20:1 against the panel — the icon and the words carry the warning. The hex typed into the page copy ("Claude CLI v…") is placeholder, not spec.

### UI Editor (page lead)

Page `21028:15887`, two boards. **Panels** `21028:34519` holds the screens: `LeftPanel2D` `21028:34521` (Fixed 312 × Hug 712, vertical, Charcoal, padding-bottom 100), `RightPanel2D` `21028:34544` (Hug 4068 × 1742, 24px radius, padding 20, gap 20: about fourteen right-panel states laid side by side) and the two sets below. **Components** `21028:30543` holds eight sub-boards, each 24px radius, fill Black 40, 1px White 20: `Components` `21028:15991` (956 × 958), `UI Editor Buttons` `21028:16485` (710 × 407), `Icons` `21028:16123` (1477 × 448), `PropertiesSections` `21028:30544` (2648 × 781), `PropertiesSubsections` `21028:30545`, `Variables&EventsMenus` `21032:43793`, `ColourPanel` `21032:44145` (621 × 513) and `InputActions` `21301:5375` (1662 × 336). Every control below maps to the inspector's UI Designer (`components/UIDesigner`; see [`UIDesigner.md`](UIDesigner.md)) — mapped by directory, not line by line. Existing specs reused, never duplicated: `ToolbarButton`, `IconContainedToggle`, `Menu`, `Menu-Entry`, `Close-Button`, `Switch`, `Checkbox Terciary`, `Tooltip`. Each state fill and each child glyph or label colour is read from the layer's own panel (nested glyphs singly; where a variant has two child layers the colour is the "2 Selected" aggregate, which lists one colour, and says so). Body copy and field labels are content, not spec.

### HierarchySections (UI Editor — Components)

Set [`21078:34715`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21078-34715), 3 variants (`HoverContainer` × `HoverPlus`). Fixed 312 × 28, horizontal, space-between, padding 4 / 10, 1px White 10 top and bottom; label "GUIS" and a `+` chip. Code: `LeftPanel/NodeTree.tsx` section header — inspector tokens `--ui-designer-control-border`, `--ui-designer-control-empty-bg`.

| Variant | State | Fill | Border | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- | --- |
| Off / Off (`21028:16106`) | default | none | White 10 top + bottom | Gray label 10.07:1 (read in On / On) | section header, `<button aria-expanded>` ✱ |
| On / Off (`21078:34716`) | row hover | `#FFFFFF` 5% | same | fill vs panel 1.16:1; Gray on it 8.71:1 | hover is a tint, not the only cue ✱ |
| On / On (`21083:34730`) | row hover + plus hover | `#FFFFFF` 5%; `AddCTA` chip 20 × 20, 5px radius, White 10 fill, `+` 9 × 9 with a 1px Silver stroke | same | Silver `+` on the chip 4.31:1 | `+` named "Add GUI" ✱, ≥ 24px hit target needs a larger box than the 28px row's glyph |
| any | ✱ focus / press / disabled | — | — | ring `--ui-designer-control-accent` | not drawn |

### PropertiesSections (UI Editor — Components)

Set [`21028:16116`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16116), 2 variants (`Hover` Off `21028:16117` / On `21028:16120`). Fixed 70 × 28, padding 2, gap 10, 1px White 10 top and bottom; chevron + "Text". Code: `RightPanel/PropertyPanel/PropertyPanel.tsx` section titles.

| Variant | Fill | Contrast | A11y |
| --- | --- | --- | --- |
| Hover = Off | none | Snow on panel 15.45:1 | `<button aria-expanded>` per section |
| Hover = On | `#FFFFFF` 5% | fill vs panel 1.16:1; Snow 13.37:1 | ✱ focus ring as `HierarchySections` |

### TabBar (UI Editor — Components)

Set [`21028:16109`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16109), 2 variants (`Property 1` = Hierarchy `21028:16113`, the 2D | 3D pair / Properties `21028:16110`, the PROPERTIES | LOGIC pair). Fixed 312 × 36, horizontal, fill Shadow `#161518`, 1px White 10 bottom rule; two `TabHorizontal` instances (Tabs), each Fill 156 × Fill 35, vertical, padding R / L 4, label `Inter` 600 12 / 100% uppercase centred. Code: `Toolbar/UIDesignerToolbar.tsx` mode tabs and the `RightPanel` tab strip (`role="tablist"`).

| Variant | State | Fill | Contrast | A11y |
| --- | --- | --- | --- | --- |
| Hierarchy / Properties | active tab (`Active` True) | Shadow, 2px Gray `#CFCDD4` bottom border | Gray label 11.55:1 on Shadow (not Snow); underline 11.55:1; Shadow vs panel 1.15:1 — the underline is the cue | `role="tab" aria-selected`; arrow keys move |
| both | inactive tab | Shadow, no underline | Silver label 6.71:1 | — |
| both | ✱ hover / focus | — | — | not drawn |

### GUI (UI Editor — Components)

Set [`21085:34793`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21085-34793), 3 variants (`Property 1` = Default `21085:34794` / Hover `21085:34941` / Selected `21085:34947`). Fill 223 × Fixed 30, horizontal, gap 10, padding L / R 10; glyph + "GUI". Code: `LeftPanel/CodeRootsList.tsx` row.

| Variant | Padding T / B | Fill | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- |
| Default | 4 | none | Snow 15.45:1 | `role="treeitem"` ✱ |
| Hover | 3 | `#FFFFFF` 5% | Snow 13.37:1 | — |
| Selected | 3 | White 10 | fill vs panel 1.36:1; Snow 11.40:1 | `aria-selected="true"`; **Selected here is White 10, `NodeTypeHierarchy` selected is Blue Dark 3 — the two tree rows disagree** |

### NodeTypeHierarchy (UI Editor — Components)

Set [`21028:16022`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16022), 9 variants (`Property 1`): Default `16027`, Hover `16073`, Selected `16094`, SelectedHover `16099`, InvisibleDefault `16031`, InvisibleHover `16038`, InvisibleSelected `16066`, InvisibleSelectedHover `16059`, PropertiesHeader `16023`. Fill 223 × Fixed 30 (PropertiesHeader Fixed 20), horizontal, gap 10, padding L / R 10; caret + node glyph + "Image"; Hover and Selected add lock and eye glyphs (canvas). Code: `LeftPanel/NodeTree.tsx` (+ `NodeTree.css`), `shared/tree-model.ts`.

| Variant | Padding T / B | Fill | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- |
| Default / InvisibleDefault | 4 | none | Snow 15.45:1; Invisible label, caret (10 × 6.09, rotated 180°) and node glyph are White 40 — 3.74:1 on panel, eye glyph Gray 10.07:1 | `role="treeitem" aria-expanded` |
| Hover / InvisibleHover | 3 | `#FFFFFF` 5% | 13.37:1 | lock + eye appear on hover — keyboard users need them on focus ✱ |
| Selected / InvisibleSelected | 3 | Blue Dark 3 `#243852` | Snow 11.61:1; fill vs panel 1.33:1 — below 3:1, the label weight and the glyphs carry it | `aria-selected="true"` |
| SelectedHover / InvisibleSelectedHover | 3 | Blue Dark 3 `#243852` | **identical to Selected — no visible hover on a selected row** | Figma defect candidate |
| PropertiesHeader | — (Fixed 20; padding R 16 L 10, gap 8) | none | column header over the tree | `role="columnheader"` ✱ |
| any | ✱ focus / press / disabled | — | ring `--ui-designer-control-accent` | not drawn |

### Input (UI Editor — Components)

Set [`21028:16003`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16003), 5 variants (`Property 1`): Single `16016`, SingleBlocked `16019`, Dropdown `16012`, Icon `16004`, IconBlocked `16008`. All Fixed 128 × 26, horizontal, gap 8, 6px radius, fill Onix `#35333B`, padding T / B 6. Padding L / R: Single 8 / 24, SingleBlocked 8 / 4, Dropdown 8 / 8, Icon 8 / 24, IconBlocked 8 / 8; the value reads "100" (`Inter` 400 14 / 100%) with a scrub glyph, a leading glyph (Icon) or a chevron (Dropdown); Blocked values are White 20 and the row carries an `AddVariant` instance (18 × 18) as the bind affordance. Code: `RightPanel/PropertyPanel` fields (`FieldRow`, `LengthVecField`, `BoxModelField`) over `--ui-designer-control-bg`, `--ui-designer-radius-field`, `--ui-designer-text-value`.

| Variant | State | Fill | Contrast (on Onix) | A11y |
| --- | --- | --- | --- | --- |
| Single / Icon | editable | Onix | value Gray 7.90:1; Onix vs panel 1.27:1 | `<input inputmode="numeric" aria-label="<field>">`; the unit glyph is `aria-hidden` |
| SingleBlocked / IconBlocked | blocked (value is bound or inherited) | Onix | value White 20 (`#FFFFFF` 20%) 1.88:1 on Onix — below 3:1, so the value is not legible; keep the bound-value tooltip and a ✱ ≥ 4.5:1 value | `aria-disabled` + a bound-value tooltip ✱; `Blocked` is a state, not a mode |
| Dropdown | opens a list | Onix | chevron Silver 4.59:1 | `role="combobox"` |
| any | ✱ focus / hover / error | — | ring `--ui-designer-control-accent` | not drawn |

### ToggleTabs (UI Editor — Components)

Component `21028:16000`, one definition with two `Slot` instances (`21028:16001`, `21028:16002`, each with a `Slot` = Default property). Slot: Fill 142 × Fill 27, 6px radius, fill Charcoal `#25212A`, 1px Onix border — an empty segmented-control frame that the `ToggleTab` buttons drop into. Code: `PropertyPanel/FlowField`, `ResizeField` (segmented groups). Border Onix vs Charcoal 1.27:1; the frame is a container, the child cell carries the state.

### Subtitle (UI Editor — Components)

Component `21028:15992` with `Text` `21028:15993` (Fill 93 × Hug 15, gap 6: a `Checkbox Secondary` On instance 14 × 14 drawn with a Gray tick override; code follows Checkbox Terciary (Snow tick), the label "Text" `Inter` 400 12 / 100% Gray `#CFCDD4` (25 × 15, 10.07:1 on panel), and a `HelpCTA` Hover = No instance 12 × 12) and `DeleteCTA` `21028:15998` (26 × 16). Code: `BindableField` label row. `DeleteCTA` and `HelpCTA` states are in the next sections.

### UI Editor Buttons (Buttons)

Section [`21671:45251`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21671-45251) on the Buttons page `20705:10837`, 9 sets, 33 variants: a copy of the `UI Editor Buttons` board `21028:16485` (UI Editor page), identical in every value read on October 22, 2026, and the reference the design review points to. Copy ids: DeleteCTA `21671:45338`, HelpCTA `45333`, LockLayerToggle `45320`, VisibilityToggle `45311`, AddVariant `45306`, ScaleToggle `45252`, WrapToggle `45277`, ToggleTab `45288`, ViewModeToggle `45297`. Code: every icon control in `components/UIDesigner`, the 2D toolbar included, through three shared rules (see "Icon buttons and toggles" under Palette by role); the Figma glyphs live in `components/UIDesigner/icons.tsx` (trash, eye, eye-off, lock, unlock, monitor) and in the existing mask assets (aspect lock, wrap, flow Free, bind).

| Kind | Sets (and code) | Rest | Hover | Selected | Selected + hover | Focus | Disabled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Icon button | DeleteCTA, HelpCTA, AddVariant (bind link); add, copy, clear, the toolbar's save / undo / redo | Silver `--ui-designer-text-muted`, no container (5.85:1) | Snow `--ui-designer-text` on White 10 `--palette-whiteTransparent-subtle`, 4px (11.40:1) | — | — | 2px `--ui-designer-control-accent`, offset 1px (7.09:1) | White 20 `--palette-whiteTransparent-soft` glyph, no fill (exempt) |
| Tab toggle (one choice out of a set) | ToggleTab; TextAlign, Flow direction, the canvas device pair, the device-variant and interaction-state tabs, the fill-mode chips, the toolbar gizmos | Silver, no fill, 1px `--palette-neutral-onyx` border (5.85:1) | Snow on White 10, 1px Onyx border (11.40:1) | Snow on `--ui-designer-control-active-bg` Blue Dark 2, border in the fill colour (8.61:1) | Snow on `--palette-system-blueDark3`, border in the fill colour (11.61:1) | accent ring, offset 1px standalone and −2px in a joined group; 3.95:1 on Blue Dark 2, 5.33:1 on Blue Dark 3 | White 20 glyph, no fill, 1px Onyx border (exempt) |
| Single toggle (on / off) | WrapToggle, ScaleToggle, LockLayerToggle, VisibilityToggle, ViewModeToggle (HUD / safe area); the node-header, GUI-list and MobileHUD eyes, the toolbar Run / Scene Info | Silver, no fill, no border (5.85:1) | Snow on White 10, no border (11.40:1) | Snow on Blue Dark 2, no border (8.61:1) | Snow on Blue Dark 3, no border (11.61:1) | accent ring, offset 1px; 3.95:1 on Blue Dark 2, 5.33:1 on Blue Dark 3 | White 20 glyph, no fill, no border (exempt) |

Joined tab toggles (TextAlign, Flow direction, the device pair, the device-variant tabs, the gizmos) overlap by 1px for one-pixel seams, take the outer radii on the first and last cell, and raise the selected or hovered cell over its neighbours; see "Segmented group" under Palette by role. A control drawn smaller than 24px is a 24 × 24 transparent button whose Figma-size container is its `::before`; for a tab toggle the container carries the border too. Lock and eye are single toggles: a locked node's lock, a hidden node's eye and a top-level GUI's eye are selected (Blue Dark 2).

✱ Deviations from the Figma sets, decided by the user on October 22, 2026 (Validate does not flag these):

| ✱ | Figma | Code |
| --- | --- | --- |
| Unselected toggle hover glyph | ToggleTab, WrapToggle, ScaleToggle, ViewModeToggle Off + Hover: **Silver** glyph | **Snow** glyph; the White 10 fill matches Figma |
| Tab toggles drawn from borderless sets | ViewModeToggle (the canvas device pair, the `Devices` tabs) and ToolbarButton (the gizmos) draw no border | the tab-toggle rule: 1px `--palette-neutral-onyx` at rest, on hover and disabled, a fill-coloured border when selected, as ToggleTab |
| Segmented seams | `ToggleTabs` slot: a Charcoal frame with a 1px Onix border around unjoined `ToggleTab` cells | cells overlap by 1px (one-pixel seams), outer radii on the first and last cell, no wrapper border |
| Lock and eye | Gray `#CFCDD4` glyph in every state, White 10 hover; no selected fill | single-toggle rule: Silver with no border at rest, Snow on White 10 on hover, Snow on Blue Dark 2 when pressed, Blue Dark 3 when pressed + hover |
| Interaction-state chip | `Interactions` set: active chip Blue Dark 3 `#243852` | Blue Dark 2, Blue Dark 3 on hover |
| UI Designer toolbar (retired by layer 3a2, user decision October 23, 2026; current until it lands) | `ToolbarButton` / `RuntimeControls`: a filled rest container | no rest container (icon-button, tab-toggle and single-toggle rules, scoped under `.ui-designer-toolbar`; the 3D toolbar keeps the set) |
| Help and bind link hover | HelpCTA and AddVariant draw no container; HelpCTA rests Cloudy Sky | White 10 container on hover; Help rests Silver |
| DeleteCTA hover glyph | `Neutrals/White` `#FFFFFF` | Snow `#FCFCFC` (3/255) |
| Canvas node-bar Delete hover | — (DeleteCTA) | the red danger hover is dropped |
| Focus, disabled, pressed | not drawn | accent ring in every state; WrapToggle Blocked for every disabled control (a tab toggle keeps its Onyx border); no pressed state |
| Hit target | 12–18px boxes | 24 × 24 button, Figma-size `::before` container |

### DeleteCTA (UI Editor Buttons)

Set [`21107:37893`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21107-37893) (copy `21671:45338`), 2 variants (`Hover` Yes `37894` / No `37892`). 16 × 16 glyph; Hover = Yes adds a 4px radius White 10 fill. Code: every trash / remove / clear in `components/UIDesigner` (Canvas node bar, CodeRootsList, NodeTree, PropertyPanel rows, CallbackField, the Logic panels) through the icon-button rule; glyph `TrashIcon` in `icons.tsx`.

| Variant | Fill | Contrast | A11y |
| --- | --- | --- | --- |
| Hover = No | none | glyph Silver `#A09BA8` (a 12 × 12 `Delete` instance inset 2px), 5.85:1 on panel | `<button aria-label="Delete <item>">` |
| Hover = Yes | White 10, 4px radius | glyph White `#FFFFFF` 11.69:1 on the fill; code paints Snow (11.40:1), a 3/255 deviation | 16px is **below the 24px target**: a 24px button with the 16px container as `::before` ✱ |

### HelpCTA (UI Editor Buttons)

Set [`21107:37499`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21107-37499) (copy `21671:45333`), 2 variants (`Hover` Yes `37500` / No `37498`). 12 × 12 circle, 100px radius, 1px border: No = Cloudy Sky `#716B7C`, Yes = Snow `#FCFCFC`; the "?" glyph (3.34 × 5.94) takes the same colour as the border. Code: the shared `ui/InfoTooltip` trigger beside UI Designer labels and in the MobileHUD header; its `VscQuestion` glyph is kept (the component is shared with the 3D panels) and the colours are scoped under the UI Designer rails. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Silver at rest, Snow on a White 10 container on hover.

| Variant | Border | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- |
| Hover = No | Cloudy Sky | 3.09:1 — passes 3:1 non-text barely | `<button aria-label="Help: <field>">`, tooltip text via `aria-describedby` |
| Hover = Yes | Snow | 15.45:1 | 12px is far below 24px — hit box must be larger ✱ |

### LockLayerToggle (UI Editor Buttons)

Set [`21068:32238`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21068-32238), 6 variants (`Parent` × `Active` × `Hover`): No/Off/No `21086:34988`, No/On/No `21086:34979`, Yes/Off/No `21068:32241`, Yes/Off/Yes `21107:37482`, Yes/On/Yes `21107:37478`, Yes/On/No `21068:32239`. `Parent` = No is 14 × 14 (a small dot-sized state), `Parent` = Yes is 16 × 16; Hover = Yes adds a 4px radius White 10 fill; Active toggles the closed / open lock glyph (shape only). Every variant's glyph is Gray `#CFCDD4` (Parent = Yes: 9.14 × 12; Parent = No: a 2 × 2 dot). No Parent = No / Hover = Yes variant exists. Copy `21671:45320`. Code: lock in `LeftPanel/NodeTree.tsx`, a `<button aria-pressed>` with `LockIcon` / `UnlockIcon` from `icons.tsx`; the code draws no inherited-lock dot. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): single-toggle rule, Silver at rest, Snow on White 10 on hover, Snow on Blue Dark 2 / 3 when locked; no border, as the set.

| Parent | Active | Hover | Size | Fill | Contrast / A11y |
| --- | --- | --- | --- | --- | --- |
| No | Off / On | No | 14 × 14 | none | Gray dot 10.07:1; inherited lock, display only; `aria-hidden` ✱ |
| Yes | Off | No / Yes | 16 × 16 | none / White 10 | Gray glyph 10.07:1 on panel, 7.43:1 on the White 10 hover fill (the glyph does not change on hover) |
| Yes | On | No / Yes | 16 × 16 | none / White 10 | same Gray glyph; `aria-pressed="true"`, name "Lock <node>" |
| No | any | Yes | — | ✱ not drawn | — |

### VisibilityToggle (UI Editor Buttons)

Set [`21028:16532`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16532), 4 variants (`Visible` × `Hover`): No/Yes `21107:37466`, No/No `21028:16535`, Yes/Yes `21107:37461`, Yes/No `21028:16533`. 16 × 16, 4px radius, Hover = Yes adds White 10; Visible = No swaps the eye for an eye-off glyph; every variant's glyph is Gray `#CFCDD4` inside a 14 × 14 instance inset 1px (eye 13.13 × 8.75, eye-off 13.13 × 10.49). Figma names the eye `Hide` and the eye-off `Show` (the action). Copy `21671:45311`. Code: every eye toggle in the UI Designer (`NodeTree.tsx`, `CodeRootsList.tsx`, the `PropertyPanel` header, `MobileHudPanel.tsx`) with `EyeIcon` / `EyeOffIcon` from `icons.tsx`. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): single-toggle rule, Silver at rest, Snow on White 10 on hover, Snow on Blue Dark 2 / 3 when pressed; no border, as the set.

| Visible | Hover | Fill | Contrast / A11y |
| --- | --- | --- | --- |
| Yes | No / Yes | none / White 10 | `aria-pressed="false"`, name "Hide <node>"; Gray glyph 10.07:1 on panel, 7.43:1 on White 10 |
| No | No / Yes | none / White 10 | `aria-pressed="true"`, name "Show <node>" |

### AddVariant (UI Editor Buttons)

Set [`21028:16516`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16516), 2 variants (`Hover` No `16519` / Yes `16517`). 18 × 18 `VariableSmall` diamond-plus glyph (10.32 × 10.32, inset 3.84px); no fill in either; hover changes only the glyph colour. The variant names are inverted in Figma (the layer named `Hover=Yes` is the Silver rest look, re-read October 22, 2026); code follows the design review: Silver at rest, Snow on hover. Copy `21671:45306`. Code: the bind affordance (`BindAffordance.tsx`, `.ui-designer-bindable-link`, the `bind.svg` mask) and `BindIcon.tsx`, whose paths are this glyph exactly; `DiamondPlus.tsx` is a stroked redraw for the menu rows. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): hover adds a White 10 container.

| Look | Fill | Contrast | A11y |
| --- | --- | --- | --- |
| rest (Figma `Hover=Yes`) | none | Silver glyph 5.85:1 | `<button aria-label="Bind to variable">`; 18px is below the 24px target ✱ |
| hover (Figma `Hover=No`) | none | Snow glyph 15.45:1 | — |

### ViewModeToggle (UI Editor Buttons)

Set [`21028:16511`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16511), 4 variants (`Selected` × `Hover`): Off/No `16512`, Off/Yes `21096:37105`, On/No `16514`, On/Yes `21096:37108`. 16 × 16, 4px radius; an `Icon` instance 14 × 14 inset 1px (vector 10.66 × 8.98, a monitor). Copy `21671:45297`. Code: the Canvas preview toggles (HUD guides, safe area) and the Desktop / Mobile device pair (`Canvas.tsx`, `.ui-designer-canvas-zoom-btn`, `.ui-designer-device-toggle-btn`) and the `PropertyPanel` device-variant tabs; the monitor is `DesktopIcon` in `icons.tsx`, and the mobile, HUD and safe-area glyphs have no Figma counterpart yet (`useRestorePersistedMode` is a different control). Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow; the device pair and the device-variant tabs are tab toggles and add the 1px Onyx border, while the HUD and safe-area toggles are single toggles and, like the set, draw none.

| Selected | Hover | Fill | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- |
| Off | No | none | Silver glyph 5.85:1 | `role="radio"` / `aria-pressed` |
| Off | Yes | White 10 | Silver glyph 4.31:1 on the fill (non-text ≥ 3:1) | — |
| On | No | Blue Dark 2 `#244B7D` | fill vs panel 1.79:1; Snow glyph 8.61:1 | `aria-pressed="true"` |
| On | Yes | Blue Dark 3 `#243852` | fill vs panel 1.33:1; Snow 11.61:1 | **hover on a selected toggle is darker than rest** — as `ToolbarButton` |

### ToggleTab (UI Editor Buttons)

Set [`21028:16506`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16506), 4 variants (`Selected` × `Hover`): Off/No `16507`, Off/Yes `21096:37090`, On/No `16509`, On/Yes `21096:37093`. Fixed 39 × 26; Off variants have a 1px Onix `#35333B` border; Off + hover adds White 10; On fills Blue Dark 2 (rest) / Blue Dark 3 (hover) with no border. The glyph is a `LayoutIcons` instance (18 × 18, vector 14 × 14; Free is the code's `FlowField/icons/absolute.svg`): Silver `#A09BA8` Off, Snow `#FCFCFC` On. Copy `21671:45288`. Code: every segmented cell in `PropertyPanel` (`TextAlignField`, `FlowField`, `FillField` modes, the interaction-state and device-variant tabs) through the tab-toggle rule, keyed on `aria-checked` / `aria-selected`. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow (the Onix Off border matches).

| Selected | Hover | Fill | Border | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Off | No | none | 1px Onix | border vs panel 1.27:1; Silver glyph 5.85:1 | `role="radio"` in a `radiogroup` |
| Off | Yes | White 10 | 1px Onix | Silver glyph 4.31:1 on the fill | — |
| On | No | `#244B7D` | none | Snow glyph 8.61:1 | `aria-checked="true"` |
| On | Yes | `#243852` | none | Snow 11.61:1; darker than rest | as `ViewModeToggle` |

### WrapToggle (UI Editor Buttons)

Set [`21028:16499`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16499), 5 variants (`Selected` × `Hover` × `Blocked`): Off/No/No `16500`, Off/Yes/No `21096:37082`, On/No/No `16502`, On/Yes/No `21096:37086`, Off/No/Yes `16504`. 26 × 26, 6px radius; fills as `ScaleToggle` (none, White 10, Blue Dark 2, Blue Dark 3); Blocked = no fill, glyph White 20. The glyph (12.71 × 11.72) is Silver Off and Snow On, and is the code's `FlowField/icons/wrap.svg`. Copy `21671:45277`. Code: the wrap toggle in `FlowField` (`aria-pressed`); Blocked is the disabled look of every UI Designer icon control. Wrap is a single toggle: no border, as the set. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow.

| Variant | Fill | A11y |
| --- | --- | --- |
| Off / No / No | none | Silver glyph 5.85:1; `aria-pressed="false"`, name "Wrap" |
| Off / Yes / No | White 10 | Silver glyph 4.31:1 on the fill |
| On / No / No · On / Yes / No | Blue Dark 2 · Blue Dark 3 | `aria-pressed="true"`; Snow 8.61:1 · 11.61:1 |
| Off / No / Yes | none, glyph White 20 | glyph 1.91:1 on panel (below 3:1, the disabled-state exemption applies); `aria-disabled="true"` with the reason (no flex flow) ✱; Blocked has no hover / selected variant — **✱ proposal: Blocked × Selected is not drawn** |

### ScaleToggle (UI Editor Buttons)

Set [`21028:16486`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16486), 4 variants (`Selected` × `Hover`): Off/No `16487`, Off/Yes `21096:37036`, On/No `16492`, On/Yes `21096:37041`. 26 × 26, 6px radius; fills none / White 10 / `#244B7D` / `#243852`; a 16 × 16 outline glyph at 5 / 5, Silver `#A09BA8` Off and Snow `#FCFCFC` On, plus a hidden `link` layer. The Off glyph (square and corner brackets) is the code's `PropertyPanel/icons/aspect-unlinked.svg`; the On glyph adds a dashed diagonal (0.5px ticks) and replaces `aspect-linked.svg`. Copy `21671:45252`. Code: the aspect lock in `LengthVecField` and `ResizeField` (`.ui-designer-vec-lock`, `aria-pressed`). The aspect lock is a single toggle: no border, as the set. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow.

| Selected | Hover | Fill | Contrast / A11y |
| --- | --- | --- | --- |
| Off | No / Yes | none / White 10 | Silver 5.85:1 / 4.31:1; `aria-pressed="false"`, name "Lock aspect ratio" (pressed: "Unlock aspect ratio") |
| On | No / Yes | Blue Dark 2 / Blue Dark 3 | Snow 8.61:1 / 11.61:1; hover darker than rest |

### Properties (UI Editor — PropertiesSections)

Set [`21028:16539`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16539), 1 variant (`Default` `21028:16540`): the assembled right panel as seven section frames — `Layout` `16566`, `Style` `16605`, `Text` `16621`, `Input` `16664`, `Dropdown` `16730`, `MouseEvents` `16781`, `Logic` `16787` — plus a `Variables` column; three slot properties (`Input`, `Input2`, `Input3`) = Default. Each section is built from the Components and PropertiesSubsections sets here. Code: `RightPanel/PropertyPanel/PropertyPanel.tsx` with `field-configs.groups.ts` (section grouping) and `LogicPanel`. No state of its own.

### AddAction (UI Editor — PropertiesSubsections)

Set `21281:45569` ([link](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21281-45569)), 2 variants (`AddAction`, `NoMoreActions`). Colours in the aggregate: Gray `#CFCDD4`, White 10, Silver `#A09BA8`. An "ADD ACTION" row with a `+` and a "No more actions to add" empty line. Code: `LogicPanel/CodeCallbacksPanel.tsx`. A11y: the `+` is `<button aria-label="Add action">`; the empty line is plain text.

### LogicInputs (UI Editor — PropertiesSubsections)

Set [`21032:44190`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-44190), 4 variants (`Property 1`): Empty `44189` (95 × 15 text), Variables `44191`, Inputs `44335` (both Fill 290 × Hug 26, 8px radius, gap 6), Events `44353` (vertical, Fill 290 × Hug 72, gap 2). Aggregate colours: Gray, Silver, Onix, Cloudy Sky. Code: `LogicPanel/CodeVariablesPanel.tsx`, `CodePropsPanel.tsx`.

### AddLogicInputs (UI Editor — PropertiesSubsections)

Set [`21028:16940`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16940), 3 variants (`Variants` `16941`, `Inputs` `16946`, `Events` `16950`). Fixed 292 × 26 (Variants Hug 26), horizontal, 8px radius, padding L / R 10, gap 6; Name / type (`string`) / Value fields. Aggregate colours: Onix, Silver, Cloudy Sky, Gray. Code: `LogicPanel/CodeVariablesPanel.tsx`, `VariablePicker/`.

### EventTag (UI Editor — PropertiesSubsections)

Set [`21028:16933`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16933), 2 variants (`Default` `16937`, `Hover` `16934`). Fixed 186 × 22 pill, 100px radius, padding 6 / 4 / 6 / 8, gap 8, fill White 10 in both; a handler name (`Inter` 400 12 / 100%, Snow, 150 × 15) and a `Close-Button` (Search Bar) 16 × 16, 100px radius. Hover recolours the `Close-Button`: fill White 5 → White 10, glyph Silver → Snow. Code: `PropertyPanel/CallbackField`.

| Variant | Fill | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- |
| Default | White 10; close button White 5 | Snow text 11.40:1 on the chip; Silver `×` 3.70:1; chip vs panel 1.36:1 | `<span>` with a `<button aria-label="Remove <handler>">` |
| Hover | White 10; close button White 10 | Snow `×` 8.36:1 on the lifted button | 22px chip, 16px `×` hit box below 24px ✱ |

### EventHandler (UI Editor — PropertiesSubsections)

Set [`21028:16916`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16916), 4 variants (`Default` `16917`, `DefaultHover` `16922`, `Defined` `16927`, `DefinedHover` `16930`). Fixed 292 × Hug 22, horizontal, padding L / R 10, gap 6; "Title" (`Inter` 400 12 / 100%, Gray `#CFCDD4`, 10.07:1 on panel) + a field or an `EventTag` chip. The field is an `Input` instance, Fill 186 × Fixed 22, 100px radius, padding 6 / 4 / 6 / 8, gap 8, no border in any state; its placeholder "Bind an event handler" is `Inter` 400 12 Cloudy Sky `#716B7C` and its glyph Silver. Code: `PropertyPanel/CallbackField`, `edit-event.ts`.

| Variant | Fill | Content | Contrast | A11y |
| --- | --- | --- | --- | --- |
| Default | field Onix `#35333B` | empty bind field | placeholder 2.43:1 on Onix — **fails 4.5:1**; field vs panel 1.27:1 | `<input aria-label="<event> handler">` |
| DefaultHover | field White 10 | same | placeholder 2.28:1 on the fill; field vs panel 1.36:1 | hover is a fill change only (no border) |
| Defined | none (chip is White 10) | `EventTag` Default | as `EventTag` | chip removal returns to Default |
| DefinedHover | none | `EventTag` Hover (close button White 10, glyph Snow) | as `EventTag` | — |

### Border (UI Editor — PropertiesSubsections)

Set [`21028:16901`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16901), 2 variants (`Off` `16902`: Fixed 292 × Hug 20, horizontal, padding R 14 L 10, gap 10 — a header with a `+`; `On` `16905`: vertical, Fixed 290 × Hug 104, padding L / R 10, gap 10 — colour field + weight). Aggregate colours: Cloudy Sky, Gray, Onix, Silver, White 20 +1. Code: `PropertyPanel/BoxModelField`, `FillField` (colour row).

### Fill (UI Editor — PropertiesSubsections)

Set [`21028:16839`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16839), 4 variants (`Property 1` = Paint `16840`, Image `16857`, Avatar `16877`, None `16890`). Fill 290, padding L / R 10: Paint vertical Hug 52 gap 6; Image vertical Hug 111 gap 12 (adds scale type and image source); Avatar Hug 52 gap 6 (user id); None horizontal Hug 20 gap 10. Aggregate colours: Onix `#35333B`, Silver, Cloudy Sky, Gray, Charcoal +5. **No video variant — the react-ecs authoring type has none** (see CLAUDE.md). Code: `PropertyPanel/FillField` (Colour / Image / Avatar).

### Devices (UI Editor — PropertiesSubsections)

Set [`21028:16830`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16830), 2 variants (`Off` `16836`: Fixed 292 × Hug 20, horizontal, padding R 14 L 10, gap 10; `On` `16831`: vertical, Fixed 292 × Hug 45, padding L / R 10, gap 4 — a Desktop / Mobile `ViewModeToggle` pair). Aggregate colours: Cloudy Sky, Silver, Gray, Snow, White +1. Code: the device-variant section of `PropertyPanel` (platform variants are a recognised construct — see CLAUDE.md).

### Interactions (UI Editor — PropertiesSubsections)

Set [`21028:16819`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16819), 2 variants (`Off` `16827`, `On` `16820`: Fixed 292 × Hug 45, vertical, gap 4, a Default / Hover / Pressed / Selected chip row with the active chip in Blue Dark 3 `#243852`); code paints the active chip Blue Dark 2 and Blue Dark 3 on hover, ✱ user decision October 22, 2026, see UI Editor Buttons). Aggregate colours: Silver, Cloudy Sky, Gray, Snow, Blue Dark 3. Code: the `useInteraction({ base, hover, press, active })` construct (`code/interaction-convention.ts`) through `PropertyPanel`.

### MinMaxSize (UI Editor — PropertiesSubsections)

Set [`21028:16810`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16810), 2 variants (`Off` `16816`, `On` `16811`: Fixed 292 × Hug 47, vertical, gap 6, a W / H `Input` pair). Aggregate colours: Cloudy Sky, Gray, Silver, Onix. Code: `PropertyPanel/LengthVecField`, `BoxModelField`.

### LogicError and Header (UI Editor — PropertiesSubsections)

Not sets. `LogicError` `21124:5300` is an `ErrorOutline` glyph + a one-line message, both `#FF2D55` Primary — **Primary on `#242129` is 4.35:1, below 4.5:1 for 12px text**; keep a distinct error token ✱ (the Creator Hub error red is `#FB3B3B`, 5.04:1). `Header` `21067:22621` is a frame of three instances (`NodeTypeHierarchy` PropertiesHeader, `Toggles`, `Dropdown` `21180:30481`). Code: `LogicPanel` error text; `PropertyPanel` header.

### ConstraintsIcons — 25 (UI Editor — Icons)

Set [`21028:16247`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16247), 25 variants (pin edges and scaling: `Scale`, `L`, `R`, `C`, `L+R`, `T`, `B`, `T+B` with `ScaleVertically` / `ScaleHorizontally` suffixes, combinations such as `L+T`, `L+T+B`, `L+C`). 16 × 16 cells on the Icons board. The pinned edge is System/Blue `#2196F3`; the rest White, White 40 and White 20, with Rarities/Epic Light `#81E1FF` in the aggregate. Code: `PropertyPanel/AnchorPresetField` and `icons/`. A second set [`21028:16124`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16124) `ConstraintsIcons` has 2 variants (`L+R`, `T+B`, white) — same name, different set.

### Icons — layout and box model (UI Editor — Icons)

| Set | Id | Variants | Glyph colour |
| --- | --- | --- | --- |
| LayoutIcons | `21028:16226` | 5 (`Free`, `ColumnDown`, `ColumnUp`, `RowRight`, `RowLeft`) | White |
| MarginsIcons | `21028:16135` | 4 (`Bottom`, `Top`, `Right`, `Left`) | White |
| PaddingIcons | `21028:16201` | 4 (`Bottom`, `Top`, `Right`, `Left`) | White |
| Spacing | `21028:16192` | 2 (`Vertical`, `Horizontal`) | White |
| TextAlign | `21028:16163` | 6 (`Middle`, `Bottom`, `Top`, `Left`, `Center`, `Right`) | White |
| Position | `21028:16219` | 2 (`Y`, `X`) | Cloudy Sky `#716B7C` |
| Size | `21028:16214` | 2 (`Height`, `Width`) | Cloudy Sky |

Each set is its own `###`-sized unit in Figma; they share one spec: 16 × 16 cells, filled vector glyphs, `fill="currentColor"`, no states. White on `#242129` 15.45:1; Cloudy Sky 3.09:1. Not sets: `AspectRatio/Colour` `21028:16224` (one `Rectangle` 16 × 16, 4px radius, 1px White 20, Lavender `#C640CD`) and `LayoutIcons/ViewMode/Align` `21028:16435` (three frames of nine align glyphs; Snow, White 40, White 0). Code: `PropertyPanel/icons/`, `Canvas/toolbar-icons.tsx`, `RightPanel/PropertyPanel/alignment-presets.ts` — the Figma names above are not the repo's file names. The icon cells carry no `aria-label`; the control around each names it.

### VariableMenu (UI Editor — Variables&EventsMenus)

Set [`21032:43818`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-43818), 3 variants (`Property 1`): NewVariable `43819` (Hug 202 × Hug 90), NewAction `43825` (Hug 202 × Hug 163), AddNewAction `43834` (Hug 202 × Hug 235). Vertical, 1px White 10 border; aggregate colours Snow, White 10, Silver, Onix, White +1. A popover of `Menu-Entry` rows with a name field and a danger action (canvas). Code: `LogicPanel/VariablePicker/`. Reuse `Menu` / `Menu-Entry` for the rows; spec only the three compositions.

### EventsMenu (UI Editor — Variables&EventsMenus)

Set [`21032:43794`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-43794), 3 variants (`Property 1`): NewVariable `43795` (Hug 202 × 90), NewAction `43801` (Hug 202 × 139), AddNewAction `43809` (Hug 202 × 211). Same anatomy as `VariableMenu`, shorter (no extra row). Code: `LogicPanel/CodeCallbacksPanel.tsx`. A11y for both: `role="menu"`, the name field is auto-focused, Escape closes and returns focus to the opener.

### Slider (UI Editor — ColourPanel)

Set [`21032:44146`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-44146), 2 variants (`Property 1` = Colour `44147` / Transparency `44150`). Fixed 170 × 20, 100px radius; Colour is the rainbow track, Transparency the checkered alpha ramp tinted to the current colour (canvas); the thumb is a white-ringed disc. `HUE` `21032:44154` is the 170 × 170, 6px-radius saturation / value square (linear gradient white → black over the hue); `ColourPanel` `21032:44156` assembles them: Fixed 193 × 296, 12px radius, padding 12 / 11, gap 12, fill Onix, 1px White 10, shadow `0 4px 10px #000 25%`, and a hex row ("C640CD" placeholder, "100%"). Code: the colour popover of `PropertyPanel/FillField`. A11y: sliders are `role="slider"` with `aria-valuemin/max/now` and arrow-key steps ✱; the square is a 2D slider with a hex field as the keyboard path. Onix vs panel 1.27:1 — the 1px White 10 border and the shadow carry the popover edge.

### InputAction (UI Editor — InputActions)

Set [`21301:5373`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21301-5373), 4 variants (`InputAction`): Default `5372`, Hover `5371`, Hiden `5370`, HidenHover `5369` (sic — "Hiden"). All Fixed 348 × Hug 96, vertical, 6px radius, 1px top border, padding 4 / 10 / 12 / 10, gap 2: a drag handle, the action name, a "Main" radio, an eye toggle (active tint in the Hiden variants) and a "Custom Icon" dropdown with link and folder buttons. Code: `MobileHud/` (the MobileHUD input-action rows) in `components/UIDesigner`.

| Variant | State | Fill | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- |
| Default | rest | Onix Dark 1 `#2D2A33` | fill vs panel 1.13:1; Gray 8.95:1; Silver 5.20:1 | row is a `role="group"` named by the action |
| Hover | pointer over | Pale Black `#43404A` | fill vs panel 1.56:1; Gray 6.44:1; **Silver 3.74:1 — fails 4.5:1 for 12px text** | hover must not be the only cue ✱ |
| Hiden | hidden action | Onix Dark 1 | as Default | eye `aria-pressed` |
| HidenHover | hidden + hover | Pale Black | as Hover | — |
| any | ✱ focus / disabled / dragging | — | ring `--ui-designer-control-accent` | not drawn |

### BottomPanel2D (UI Editor — Panels)

Set [`21221:41852`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21221-41852), 2 variants (`Blocked` `21221:41853`, `Default` `21138:18798`), 1960 × 635, dashed `#8A38F5` chrome; the logic / code panel docked under the canvas. Code: `RightPanel/LogicPanel/` (`CodeCallbacksPanel.css`, `CodeVariablesPanel.css`) — the code has no bottom dock today (absence is not removal).

| Variant | Frame | Fill | Border | Contrast (on Charcoal) | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | Fixed 1920 × Hug 320, vertical, padding 10 / 10 / 100 / 10, gap 10 | Charcoal `#25212A` | none | Silver section labels 5.83:1; Gray names 10.03:1 | `role="region"` named by its heading ✱ |
| Blocked | Fixed 1920 × Fixed 225, same padding and gap | Charcoal | none | the section label "NODES" is Silver `Inter` 400 12 (5.83:1); its two children list White 20 and White 10 besides Charcoal and Silver (the dimmed content: White 20 on Charcoal 1.91:1) | `aria-disabled="true"` on the controls, with the reason ✱ |

### Tooltip (UI Editor — Panels)

Component `21151:7716` (`Property 1` = Top; Figma defines this one variant only, so the other directions are genuinely undrawn): Hug 340 × Hug 87.77, vertical; `Container` `21551:3941` Hug 340 × Hug 77, 12px radius, padding 16 / 20, gap 10, Onix `#35333B` with Snow text; `Peak` `21551:3943` 26 × 26, 5px radius, rotated −45°, Onix; shadow `0 2px 6px #000 25%`. This is a wider, shadowed copy of the shared Tooltip (Tooltips) — **a second tooltip spec: confirm with design whether the UI Editor tooltip replaces it** ✱. Snow on Onix 12.13:1. Code: help tooltips in `PropertyPanel`; the inspector has no shared tooltip component listed in this doc.

### Viewport (Viewport)

Page `20506:34918`; board `Frame 1` `21221:39035` (title "Viewport" `21221:39108`) holding one set [`21032:43255`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-43255), 2 variants (`Property 1` = 2D `21032:43254` / 3D `21032:43256`), dashed chrome, 1332 × 2100. Both are Fixed 1292 × 1020, vertical, with a nested `Viewport` Default instance; 2D fills Onix Dark 1 `#2D2A33`; 3D (gap 954) holds a pasted scene screenshot — a fixture, never spec. Overlaid are the viewport `Toolbar` (next page) and bottom-right zoom / camera controls ("100%"); in 3D a camera menu lists Free, Player and Insert Camera Position (canvas reading). Aggregate colours: Onix, Shadow, Gray, Snow, Silver +8. Code: inspector `Canvas/` (2D, `Canvas.tsx`) and the Babylon / Bevy viewport; Creator Hub none (it iframes the inspector).

| Variant | Fill | A11y |
| --- | --- | --- |
| 2D | Onix Dark 1 `#2D2A33` | canvas `role="application"` with a text alternative via the node tree; zoom keyboard shortcuts documented |
| 3D | renderer surface | the viewport is the one place where contrast is not enforced — overlay controls carry their own fills |

### Toolbar (Viewport Toolbar)

Page `21023:11034`; board `EditorHeader` `21028:42719` (title "Viewport Toolbar") with `<Toolbar>`, a camera menu and `<RuntimeControls>`. Set [`21028:42986`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-42986), 2 variants (`Property 1` = 2D `21028:42987` / 3D), 1332 × 132 with dashed chrome. A 2D variant is Fixed 1292 × 36, fill Shadow `#161518`, 1px Onix bottom border; `LeftSide` / `RigthSide` (sic) tool groups of `ToolbarButton` instances (undo, redo, select, move, rotate, scale, …), the centred `RuntimeControls`, and `Edit`, `Save`, a divider and `Kebab` on the right. 3D adds the camera tools and a "Player" dropdown whose menu is `Menu` + `Menu-Entry` (Free ✓ / Player / rule / "Invert Camera Rotation" checkbox). The `ToolbarButton` (Buttons) states apply unchanged (26 × 26; `Active` × `Selected`, `Disabled`).

Both variants were read layer by layer (3D October 22, 2D October 23, 2026). Their groups are named against their position: `RigthSide` is the left group, `LeftSide` the right one.

- **`RigthSide`** (the left group; 3D `21023:11116`, 2D `21028:42995` Hug 166): Top 5, Left 10, gap 6. Each `Tools` frame in it has a 6px radius, a 1px Onix border, an Onix fill and a 1px gap between cells. It holds:
  - `Tools` (3D `21023:11117`, 2D `21028:42996`): undo / redo, 53 × 26.
  - `Tools` (3D `21023:11120`, 2D `21028:42999`): four gizmos, 107 × 26. In 2D, rotate is `Disabled`.
  - **3D only.** `Tools` `21023:11125`: two toggles, **Snap** (a grid and magnet glyph, shown Selected) and **Align to world** (a pivot glyph). They are the code's snap-panel checkboxes, drawn as toolbar toggles.
  - **3D only.** `Interact` `21023:11128`: 26 × 26, 6px radius, no border.
  - **3D only.** `CameraSettings` `21023:11130`: holds `CameraButton` `21023:11131` and the menu below.
- **`CameraButton` `21023:11131`:**
  - **Box:** Hug 86 × Fixed 26, 6px radius, fill Onix `#35333B`, no border, padding 0 / 8 / 0 / 4, gap 4.
  - **Content:** a `Camera` icon 18 × 18 (Silver outline); the label "Player" in Inter 400 12px / 100% Gray `#CFCDD4`; an `arrow-down` chevron 8 × 8 (White 60).
- **Camera menu** (`Menu` `21023:11140`, a 0.71-scaled `Menu`):
  - **Box:** Fixed 176, Onix, a 0.71px White 10 border, radius 8.52, padding 7.1, drop shadow `0 2.84 5.68` Black 40.
  - **Entries:** Free ✓, Player, a rule, and an "Invert Camera Rotation" checkbox row.
- **`RuntimeControls`** (3D `21028:33543`, 2D `21028:43015`): `Preview=Off`, centred at Left 618, gap 3.
- **`LeftSide`** (the right group; 3D `21023:11109`, 2D `21028:42988`): Left 1202, gap 6, padding-right 4. It holds:
  - the `Edit` and `Save` frames, each 26 × 26 with a 6px radius and a 1px Onix border and fill;
  - a `Div` (a 24px White 10 vertical rule);
  - a 16 × 16 `Kebab`: three Snow dots, no frame.

**Final design** (user decisions October 22–23, 2026): both bars follow their variant.

- **Bar:** 36px tall with a 1px `--palette-neutral-onyx` bottom border, insets 10 / 4, 6px gaps.
- **Groups:** each joined group's cells carry their own 1px Onix border and overlap by 1px, so seams are single pixels and groups come out 51 / 103px wide (✱; the code has no frame wrappers).
- **RuntimeControls:** centred in the free space between the left groups and the right group (✱).
- **Right side:** Edit ("Edit Scene"), Save, the rule and a ⋮ menu named "More options".
  - **Save** (the floppy disk) is **hidden while auto-save is on and shown while it is off**, as before, now on the right.
  - **2D has no Save** (✱ against `21028:42987`): code-as-source writes every edit to its file.
  - **2D Edit** switches to 3D and selects the scene root.
- **⋮ menu** (the board draws no open state; it takes the camera menu's Menu-Entry look):
  - **3D:** Enable autosave (checkable), Scene Info (checkable), "Invert Camera Rotation" (checkable, Babylon only, where there is no camera menu), and the Babylon inspector.
  - **2D:** Scene Info.
  - **Preferences** is removed: its two settings moved to ⋮ and the camera menu.
- **Snap (3D):** Figma's two toggles, Snap and Align to world, with the grouped Onix pressed edge.
  - While Snap is on, a caret named "Snap increments" opens the increments panel below it, right-aligned, without stealing focus (the user's addition).
  - **2D has no snap control** (as `21028:42987` draws it); snapping still works as before.
- **3D order:** Interact, then the camera button, then Mute (Figma draws no Mute; it stays in the bar).
- **Camera button:** takes `21023:11131`'s values (icon stroke `--palette-neutral-gray3`), and its menu gains the "Invert Camera Rotation" checkbox, in Figma's Title Case everywhere it renders.
- **Focus:** Snow `--focus-ring` on every control of both bars.

**Current state** (`2b5b7efe4`):

- **3D bar:** the bar, groups and run controls follow the final design, but it still has the snap caret + panel, Preferences, the Babylon inspector, Scene Info, camera-then-Interact order, and Save on the left (autosave off only). Its camera dropdown is unchanged (30px, `--gray-0`, 13px label).
- **2D bar** (`UIDesignerToolbar.tsx`, `Tools.tsx`): still review 2's (46px, no border, no rest container).
- **Next:** layer 3a2, implementation pending.

| Variant | Fill | Border | Contrast | A11y |
| --- | --- | --- | --- | --- |
| 2D (`21028:42987`) | Shadow `#161518`, Fixed 1292 × 36 | 1px Onix bottom | Snow 17.73:1; border 1.46:1 | `role="toolbar"` with arrow-key roving focus (not implemented in either bar yet, G31) |
| 3D (`21023:11108`) | Shadow `#161518`, Fixed 1292 × 36 | 1px Onix bottom | identical to 2D: Snow 17.73:1; border 1.46:1 | the camera menu: `aria-haspopup="menu"` |

### RuntimeControls (Viewport Toolbar)

Set [`21028:16521`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16521), 2 variants (`Preview` Off / On), 93 × 109 with dashed chrome. A Hug 55 × 26 row, gap 3, of two `ToolbarButton` instances in 26 × 26, 6px-radius frames (layers `Play` and `Pause`). Each carries `Active` and `Selected` properties (and `Disabled`). In `Preview=On`, the `Play` slot holds a **Stop** (square) glyph. The `Disabled` property on `Preview=Off`'s Pause doesn't change its look (Figma-side, G10).

Code:

- **3D toolbar** (`components/Toolbar`, Bevy only; since `2b5b7efe4`): follows this set as one centred `RuntimeControls` group.
  - **Slots:** slot 1 is Play / Stop; slot 2 is a Pause toggle.
  - **States:** stopped is `Preview=Off`; running is slot 1 Stop + Pause unpressed; paused is slot 1 Stop + Pause pressed. `Preview=On` depicts **paused** (user decision October 22, 2026); running is the set's plain default variant.
- **2D toolbar** (`UIDesignerToolbar.tsx`): **final design** is the same group and state machine (user decision October 23, 2026; layer 3a2, implementation pending). Play still leaves 2D before it runs the scene. Today it keeps a Run ⇄ Pause toggle plus a separate Stop. Scene-run intent: see [`UIDesigner.md`](UIDesigner.md).

| Preview | Play slot | Pause slot | A11y (3D) |
| --- | --- | --- | --- |
| Off (`21028:16522`) | Play glyph; frame Onix fill + 1px Onix border; `Active` On, `Selected` Off | frame Onix fill + 1px Onix border; `Active` Off, `Selected` Off, `Disabled` true | slot 1 `aria-label="Run scene"`; Pause native `disabled` |
| On (`21028:16527`) | **Stop** glyph (Gray); frame Onix fill + 1px Onix border; `Active` On, `Selected` Off | frame has no fill and no border; `Active` On, `Selected` On (Blue Dark 2, Snow) | slot 1 named for Stop; Pause `aria-pressed` |

---

## Pages inventory

Harvested October 16, 2026 from the Figma file's own page list (`store.getState().mirror.appModel.pagesList` in the web client; the ids were spot-checked against the URL after clicking into eight pages); the Slider page was added October 20, 2026. 53 pages: 8 section headers, 1 cover, 36 in scope, 8 skipped. **Pages whose name contains `🟡 Outdated` are not sources.** Address a page as `?node-id=<id with : as ->`, or pass the id to `get_metadata` to list its frames; pass frame or set ids, never the page id, to `get_variable_defs`.

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
| Slider | Inputs | `21625:14984` | in scope (added October 20, 2026) |
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
