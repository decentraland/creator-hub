---
name: figma
description: Project umbrella for Figma→code work in the inspector / Creator Hub. Read this FIRST whenever a task involves Figma — a figma.com URL, the word "figma", "design from figma", "match the design", or restyling/building UI to a spec. It establishes the two loops that make visual work autonomous (pull the Figma source of truth; verify against the real running app), delegates the core spec→code flow to the installed figma-implement-design / figma-create-design-system-rules skills, and adds this repo's browser fallback, palette→docs sync, live verification, and SVG/CSS gotchas.
---

# Figma → code (project workflow)

## When to use

Any visual/design task tied to Figma: a figma.com URL, "figma", "design from figma", "match the design", or restyling a panel / building icons / tuning colours-sizes-spacing to a spec. NOT for logic changes or refactors.

Visual pixel-match is a render→adjust loop. Run it against the **source of truth** (Figma) and the **real render** (the running app) — never guess-and-check through the user. If you have neither, you become the spec sheet and the screen.

## Core spec→code flow → the installed leaf skills

Delegate the mechanics to the OpenAI leaf skills (in `.claude/skills/`):

- **figma-implement-design** — `get_design_context` → (`get_metadata` to drill if large) → `get_screenshot` → download assets → translate to this project's tokens/components → validate against the design.
- **figma-create-design-system-rules** — generate/refresh design-system rules for this repo.

They are installed per-developer (they live in `.claude/skills/`, symlinked from `.agents/skills/`, and are not committed). If missing, install with:

```
npx skills add openai/skills --skill figma-implement-design,figma-create-design-system-rules --full-depth --copy --yes
```

⚠️ The CLI installs to **all** detected agents by default and litters the repo root with `.<agent>/` dirs (`.commandcode`, `.devin`, `.goose`, `.grok`, `.pi`, …). After installing, delete any top-level `.<agent>/` dir that contains only these skills. Keep `.claude/`, `.agents/`, `.ai/`, `.cursor/`.

## What the leaf skills do NOT cover — do these (repo-specific)

### 1. Pull the design directly, with a browser fallback

Never hand-type values you can extract.

- **Figma MCP first**: `get_design_context`, `get_variable_defs`, `get_screenshot`, `download_assets`. Extract every state and all tokens in one pass; ask for the frame/node link if not given.
- **MCP unavailable / capped → Claude-in-Chrome (ALL of it).** The Figma MCP seat is View-tier and returns `reached the Figma MCP tool call limit` on _every_ call (`get_metadata` included — the cap is account-wide). Fall back to the browser: open the `?node-id=` URL in Chrome, enumerate the component's variants in the Layers panel, `shift+2` to zoom to selection, and read the **designs, colours, CSS values, and icon SVGs** directly. (This expands the CLAUDE.md "Design handoff" note into an actionable procedure.)

### 2. Validate frame ↔ screen

Before editing, confirm the Figma node maps to the **exact** app surface you are changing (which panel / component / screen). State the mapping so a wrong frame is caught before any code changes.

- **Placeholder data is not spec.** A truncated address like `40f5...4tgh` (`4tgh` isn't hex) is filler — reuse the existing format, don't invent one.
- **Absence is not removal.** A control missing from one frame isn't evidence it was cut; confirm before deleting anything.

### 3. Reuse before you write — a mock can't tell you what already exists

Before adding any CSS or a new control, prove it isn't already built:

- **grep `theme/vars.css` for every literal in the spec** (hex, px, radius) before writing a rule — the value is often already a token (the spec's `#43404A` is `--gray-0`), so the "new" style is zero new CSS.
- **check `components/ui/` for a component that already renders this control** — a plain box in the mock may already exist as e.g. `WalletField` (validates on blur, shows an error) that a bare `TextField` would silently drop.
- **state the finding explicitly** — a mock can't express validation, focus order, or that a value is already a token, so "match the mock" silently becomes "re-implement what exists."

### 4. Sync the palette into the design system

When colours change, reconcile into BOTH, kept in sync:

- `packages/inspector/src/theme/vars.css` — the **source of truth** (`:root`; the 21-step `--base-01 … --base-21` light→dark ramp, role tokens like `--primary-main`, and the `--ui-designer-*` family). No hardcoded hex in inspector CSS — if a colour isn't a token, add one here.
- `docs/DESIGN.md` — the human doc: role tables (`| Token | Value | Use |`) under "Palette by role", plus the "neutral ramp runs LIGHT → DARK" section. Always update it when tokens change; **if it does not exist, create it** from `theme/vars.css` (or the general styles — the `figma-create-design-system-rules` skill can scaffold it). Refresh the WCAG contrast notes where accent luminance changes.

Respect intentional deviations (e.g. `--ui-designer-panel-bg` deliberately reuses `--base-19` `#242129`, not Figma's `#25212a`) — don't blindly overwrite. Use the `figma-create-design-system-rules` skill to (re)generate the rules doc.

### 5. Verify against the REAL render — not a mock

Preferred: run the Creator Hub app and navigate to the inspector, rather than spinning the inspector server each time.

- `cd packages/creator-hub && npm run start`. CH loads the inspector from `packages/inspector/public` at runtime, so rebuilding the inspector's `public/` (its own `npm run start` watch in `packages/inspector`) refreshes it with **no CH rebuild** (true for the iframe UI; the Bevy renderer has a second consumer, `dist/tooling-entrypoint.js`, loaded by `sdk-commands start --data-layer` from the _scene project's_ `node_modules` — but design work is UI-only so it rarely applies).
- Reach 2D: **Settings → Experimental → UI Editor**, then the toolbar **ModeSwitcher "2D"** tab (needs scene `@dcl/sdk` ≥ 7.26.0).
- **Tradeoff:** CH is an Electron window that Chrome automation can't attach to. For pure 2D visual checks (canvas, panels, toolbar layout — no Bevy run controls, no persistence), the **standalone inspector dev server** (`cd packages/inspector && npm run start`, set `VITE_INSPECTOR_PORT` for a fixed port) is the browser-automatable surface — Babylon-only, non-persistent fixture. Use CH for anything touching Bevy scene-run or mode persistence.
- **Screenshots are ground truth.** `getComputedStyle` over CDP is unreliable for `:hover` / `:focus-within`.

### 6. SVG / CSS gotchas (learned on the UI Designer toolbar)

- **viewBox padding shrinks icons** — an icon drawn in the centre ~60% of its viewBox renders ~40% smaller than one filling its box at the same size. Crop the viewBox to the artwork (e.g. `0 0 16 16` → `3 3 10 10`).
- **SVG inner-shadow ≠ CSS `box-shadow`** — a `feComposite` inner-shadow renders weaker than `box-shadow: inset` at the same numbers, and CSS `blur ≈ 2 × feGaussianBlur stdDeviation`. Match the _look_ in the browser, not the number.
- **`fill="currentColor"` + state cascade** — a higher-specificity state rule (`.active { color: … }`) silently overrides the base colour whenever that state is on. Check every state's _resolved_ colour.
- **Element-type selectors defeat class-scoped overrides.** A panel rule like `.Container.Scene .content svg { … }` (specificity 0,3,1) reaches a subcomponent's icon and out-ranks a `.Parent > .Child` override (0,2,0) — renaming the class can't dodge it. When nesting a subcomponent under a panel, grep for element-type selectors (`svg`, `input`, `img`) scoped to that panel, not just class names.
- **Relabelling a control can strip its accessible name.** In `CheckboxField` the visible `Label` is a sibling with no `htmlFor`, so `aria-label` is the input's only accessible name; deleting it as "redundant" after a rename passes typecheck, eslint, tests, and a grep for the old string. Verify the accessible name still **exists**, not just that the old string is gone.
- **CSS/TSX are not linted or formatted by the repo gates** — `make format` / `make lint` skip `.css` and `.tsx`. Run `npx prettier --check` on touched `.css`, and `npx eslint` on touched `.tsx`, explicitly. The `.tsx` glob carries a standing baseline of pre-existing problems (never zero) — capture the count before editing, diff against it, and never `--fix` across the glob.

## After the change, verify these are still TRUE

A Figma→code task fails quietly, not loudly. Confirm:

- no CSS was added for a value that's already a token or a shipped default;
- an existing component (with its validation) was reused, not re-implemented;
- every control still has an accessible name — not just that the old label is gone;
- the `.tsx` eslint baseline didn't grow.
