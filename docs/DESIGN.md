# Inspector Design System

The visual language for the **`@dcl/inspector`** web UI (the Babylon.js scene inspector and its panels, including the UI Designer). It is the reference for every color, spacing, focus, and motion decision in inspector `.css`/`.tsx`.

**Scope.** This documents the *inspector*. The creator-hub Electron shell renders the inspector inside an `<iframe>` and uses `decentraland-ui2` (MUI) for its *own* chrome — a separate system with its own theme that cannot cross the iframe boundary. Do not import ui2 tokens here, and do not apply this file to creator-hub renderer code.

**Not our brand kit.** Anthropic brand assets (Poppins/Lora, orange `#d97757`, etc.) and the `brand-guidelines` skill do **not** apply to this codebase. The inspector's brand is Decentraland: pink `--primary-main #ff2d55`, the cyan UI-Designer accent, and Inter.

---

## Where tokens live

All tokens are CSS custom properties on `:root` in **`packages/inspector/src/theme/vars.css`**, loaded with `theme/index.css` (fonts + a few resets). Several tokens pass through VS Code webview variables (`--vscode-*`) with a fallback, so the inspector adopts the host editor theme when embedded there.

**The one rule:** style with these tokens. Do not introduce new hardcoded hex/`rgba()` in inspector CSS — if a needed color isn't a token, add a token.

---

## Palette by role

### Surfaces (backgrounds)
| Token | Value | Use |
|---|---|---|
| `--main-bg-color` | `--vscode-editor-background` → `--background` | App/editor background |
| `--tree-bg-color` | `--base-20` `#161518` | Panels, trees, **dropdown/popover surfaces** |
| `--modal-content-bg-color` | `--tree-bg-color` | Modals |
| `--ui-designer-control-bg` | `--gray-0` `#43404a` | Inputs/selects/textarea chrome |
| `--disabled-bg-color` | `#323036` | Disabled control fill |

### Foreground (text)
| Token | Value | Use |
|---|---|---|
| `--title` | `#eeeeef` | Primary text **on dark surfaces** |
| `--sub-text` | `#ffffffcf` | Secondary text on dark |
| `--text-primary` | `#000000de` | Text **on light surfaces** |

There is no single `--text` token — pick the foreground that matches the surface. **Never rely on `color: inherit` for a control on a themed surface** (that is exactly how the white-on-white callback autocomplete happened); set an explicit foreground.

### Borders, focus & accent
| Token | Value | Use |
|---|---|---|
| `--ui-designer-control-border` | `rgba(255,255,255,.12)` | Control borders |
| `--ui-designer-hairline` | `rgba(255,255,255,.07)` | Subtle dividers |
| `--border-focused` | `#127fd4` | Focus ring (VS Code blue) |
| `--ui-designer-accent` | `rgb(80,200,255)` | UI-Designer selection/canvas cyan |
| `--ui-designer-accent-80/-40/-12/-08/-05` | cyan @ .8/.4/.12/.08/.05 | Hover/selection fills, drop targets |

### DCL brand & status
| Token | Value | Use |
|---|---|---|
| `--primary-main` / `--primary-dark` | `#ff2d55` / `#f70038` | Brand pink — the "armed/active tool" signal. Distinct from the cyan accent; don't use it for field errors. |
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
  background: var(--tree-bg-color);          /* --base-20, dark */
  border: 1px solid var(--ui-designer-control-border);
  color: var(--title);                        /* explicit light fg, NOT inherit */
}
.some-dark-surface .row:hover,
.some-dark-surface .row[aria-selected='true'] {
  background: var(--ui-designer-accent-12);
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

## Fonts

`--font-family` → **Inter** (system-ui fallbacks). `--font-monospace` → **Inconsolata** (code/callback editors). Use `font-variant-numeric: tabular-nums` for numeric readouts (zoom %, counters).

---

## Component & CSS conventions

Derived from the Vercel Web Interface Guidelines (`web-design-guidelines` skill) and applied throughout the inspector:

- **Focus:** every interactive element has a visible `:focus-visible` ring (`--border-focused` or `--ui-designer-accent`). Prefer `:focus-visible` over `:focus`. **Never** `outline: none` without a replacement ring.
- **Contrast (WCAG AA):** text ≥ **4.5:1**, non-text/UI (borders, focus rings, canvas markers, icons) ≥ **3:1** against their background.
- **ARIA/semantics:** icon-only buttons need `aria-label`; use `<button>` for actions and `<a>`/`<Link>` for navigation (never `<div onClick>`); tie every input to a `<label>` or `aria-label`; async updates use `aria-live="polite"`.
- **Motion:** honor `prefers-reduced-motion` (reduced/none variant); animate only `transform`/`opacity`; **never** `transition: all` — list properties.
- **During drag:** `user-select: none` + `touch-action: manipulation`.
- **Content:** truncate/clamp long text (flex children need `min-width: 0`); handle empty states; placeholders end with `…`.
- **Color:** tokens only — no new hardcoded hex.

Reviewing UI against these? Run the `web-design-guidelines` skill over the changed files.

---

## Related standards

- [`coding-standards.md`](./coding-standards.md) — React patterns (controlled-input prop-sync, memoized components).
- [`testing-standards.md`](./testing-standards.md) — E2E/Playwright patterns.
