---
name: figma
description: Project umbrella for Figma→code work in the inspector / Creator Hub. Read this FIRST whenever a task involves Figma — a figma.com URL, the word "figma", "design from figma", "match the design", or restyling/building UI to a spec. It establishes the two loops that make visual work autonomous (pull the Figma source of truth; verify against the real running app), delegates the core spec→code flow to the installed figma-implement-design / figma-create-design-system-rules skills, and adds this repo's browser fallback, palette→docs sync, live verification, and SVG/CSS gotchas.
---

# Figma → code (project workflow)

## When to use

Any visual/design task tied to Figma: a figma.com URL, "figma", "design from
figma", "match the design", or restyling a panel / building icons / tuning
colours-sizes-spacing to a spec. NOT for logic changes or refactors.

Visual pixel-match is a render→adjust loop. Run it against the **source of
truth** (Figma) and the **real render** (the running app) — never guess-and-check
through the user. If you have neither, you become the spec sheet and the screen.

## Core spec→code flow → the installed leaf skills

Delegate the mechanics to the OpenAI leaf skills (in `.claude/skills/`):

- **figma-implement-design** — `get_design_context` → (`get_metadata` to drill if
  large) → `get_screenshot` → download assets → translate to this project's
  tokens/components → validate against the design.
- **figma-create-design-system-rules** — generate/refresh design-system rules for
  this repo.

They are installed per-developer (they live in `.claude/skills/`, symlinked from
`.agents/skills/`, and are not committed). If missing, install with:

```
npx skills add openai/skills --skill figma-implement-design,figma-create-design-system-rules --full-depth --copy --yes
```

⚠️ The CLI installs to **all** detected agents by default and litters the repo
root with `.<agent>/` dirs (`.commandcode`, `.devin`, `.goose`, `.grok`, `.pi`,
…). After installing, delete any top-level `.<agent>/` dir that contains only
these skills. Keep `.claude/`, `.agents/`, `.ai/`, `.cursor/`.

## What the leaf skills do NOT cover — do these (repo-specific)

### 1. Pull the design directly, with a browser fallback

Never hand-type values you can extract.

- **Figma MCP first**: `get_design_context`, `get_variable_defs`,
  `get_screenshot`, `download_assets`. Extract every state and all tokens in one
  pass; ask for the frame/node link if not given.
- **MCP unavailable / capped → Claude-in-Chrome (ALL of it).** The Figma MCP seat
  is View-tier and returns `reached the Figma MCP tool call limit` on *every*
  call (`get_metadata` included — the cap is account-wide). Fall back to the
  browser: open the `?node-id=` URL in Chrome, enumerate the component's variants
  in the Layers panel, `shift+2` to zoom to selection, and read the **designs,
  colours, CSS values, and icon SVGs** directly. (This is the CLAUDE.md "Design
  handoff" note, made actionable — it owns the procedure now.)

### 2. Validate frame ↔ screen

Before editing, confirm the Figma node maps to the **exact** app surface you are
changing (which panel / component / screen). State the mapping so a wrong frame
is caught before any code changes.

### 3. Sync the palette into the design system

When colours change, reconcile into BOTH, kept in sync:

- `packages/inspector/src/theme/vars.css` — the **source of truth** (`:root`; the
  21-step `--base-01 … --base-21` light→dark ramp, role tokens like
  `--primary-main`, and the `--ui-designer-*` family). No hardcoded hex in
  inspector CSS — if a colour isn't a token, add one here.
- `docs/DESIGN.md` — the human doc: role tables (`| Token | Value | Use |`) under
  "Palette by role", plus the "neutral ramp runs LIGHT → DARK" section. Refresh
  the WCAG contrast notes where accent luminance changes.

Respect intentional deviations (e.g. `--ui-designer-panel-bg` deliberately reuses
`--base-19` `#242129`, not Figma's `#25212a`) — don't blindly overwrite. Use the
`figma-create-design-system-rules` skill to (re)generate the rules doc.

### 4. Verify against the REAL render — not a mock

Preferred: run the Creator Hub app and navigate to the inspector, rather than
spinning the inspector server each time.

- `cd packages/creator-hub && npm run start`. CH loads the inspector from
  `packages/inspector/public` at runtime, so rebuilding the inspector's `public/`
  (its own `npm run start` watch in `packages/inspector`) refreshes it with **no
  CH rebuild**.
- Reach 2D: **Settings → Experimental → UI Editor**, then the toolbar
  **ModeSwitcher "2D"** tab (needs scene `@dcl/sdk` ≥ 7.26.0).
- **Tradeoff:** CH is an Electron window that Chrome automation can't attach to.
  For pure 2D visual checks (canvas, panels, toolbar layout — no Bevy run
  controls, no persistence), the **standalone inspector dev server** (`cd
  packages/inspector && npm run start`, set `VITE_INSPECTOR_PORT` for a fixed
  port) is the browser-automatable surface — Babylon-only, non-persistent
  fixture. Use CH for anything touching Bevy scene-run or mode persistence.
- **Screenshots are ground truth.** `getComputedStyle` over CDP is unreliable for
  `:hover` / `:focus-within`.

### 5. SVG / CSS gotchas (learned on the UI Designer toolbar)

- **viewBox padding shrinks icons** — an icon drawn in the centre ~60% of its
  viewBox renders ~40% smaller than one filling its box at the same size. Crop
  the viewBox to the artwork (e.g. `0 0 16 16` → `3 3 10 10`).
- **SVG inner-shadow ≠ CSS `box-shadow`** — a `feComposite` inner-shadow renders
  weaker than `box-shadow: inset` at the same numbers, and CSS `blur ≈ 2 ×
  feGaussianBlur stdDeviation`. Match the *look* in the browser, not the number.
- **`fill="currentColor"` + state cascade** — a higher-specificity state rule
  (`.active { color: … }`) silently overrides the base colour whenever that state
  is on. Check every state's *resolved* colour.
- **CSS/TSX are not linted or formatted by the repo gates** — `make format` /
  `make lint` skip `.css` and `.tsx`. Run `npx prettier --check` on touched
  `.css`, and `npx eslint` on touched `.tsx`, explicitly.
