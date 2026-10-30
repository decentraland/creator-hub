---
name: figma
description: Project umbrella for Figma→code work in the inspector / Creator Hub. Read this FIRST whenever a task involves Figma — a figma.com URL, the word "figma", "design from figma", "match the design", or restyling/building UI to a spec. It establishes the two loops that make visual work autonomous (pull the Figma source of truth; verify against the real running app), delegates the core spec→code flow to the installed figma-implement-design / figma-create-design-system-rules skills, and adds this repo's browser fallback, palette→docs sync, live verification, and SVG/CSS gotchas.
---

# Figma → code (project workflow)

## When to use

Any visual/design task tied to Figma: a figma.com URL, "figma", "design from figma", "match the design", or restyling a panel / building icons / tuning colours-sizes-spacing to a spec. NOT for logic changes or refactors.

Visual pixel-match is a render→adjust loop. Run it against the **source of truth** (Figma) and the **real render** (the running app) — never guess-and-check through the user. If you have neither, you become the spec sheet and the screen.

`dcl-designer-specialist` (`.claude/agents/`) is the agent that owns this loop end to end: it turns a frame into a spec for the inspector and Creator Hub specialists, syncs Figma into `docs/DESIGN.md` and the token files, and validates the implemented render. This skill is the how-to it follows.

## Core spec→code flow → the installed leaf skills

Delegate the mechanics to the OpenAI leaf skills (in `.claude/skills/`):

- **figma-implement-design** — `get_design_context` → (`get_metadata` to drill if large) → `get_screenshot` → download assets → translate to this project's tokens/components → validate against the design.
- **figma-create-design-system-rules** — generate/refresh design-system rules for this repo. Its `create_design_system_rules` MCP tool isn't exposed by the Figma server configured here, so token and component extraction runs on `get_variable_defs`, `get_metadata`, `get_design_context`, and `get_screenshot` instead.

The downloaded skills are pinned in `skills-lock.json`; `web-design-guidelines` is vendored in `.ai/skills/` at a fixed commit. If missing, run `make install-skills`, then `/reload-skills`.

## What the leaf skills do NOT cover — do these (repo-specific)

### 1. Pull the design directly, with a browser fallback

Never hand-type values you can extract.

- **Figma MCP first**: `get_design_context`, `get_variable_defs`, `get_screenshot`, `download_assets`. Extract every state and all tokens in one pass; ask for the frame/node link if not given.
- **Node-addressed MCP calls work on any page; only the page listing is pinned.** `get_metadata` with no `nodeId` lists only the COVER page whatever is open, but `get_metadata`, `get_design_context`, `get_variable_defs`, and `get_screenshot` on an explicit id serve any page (verified October 16, 2026 on the Buttons page with COVER open). `get_variable_defs` fails on a page id ("nothing selected") and works on a frame or set id, returning only the variables that subtree references; `get_metadata` on a component set lists its variants, so count from it. Page ids: every page is tabulated with its id in `docs/DESIGN.md` → "Pages inventory" — read that before touching the browser. To re-harvest, don't drive the Pages panel (it is virtualised, and synthetic clicks, real `computer` clicks, Enter, and Space all fail to switch pages reliably, while a micro `left_click_drag` lands one step late); read Figma's own client store instead: in `javascript_tool`, `store.getState().mirror.appModel.pagesList` lists every page with its id (web app, October 16, 2026). Skip every page whose name contains `🟡 Outdated`.
- **Budget the MCP: hard fetches on the MCP, easy reads in the browser.**
  - **The limit.** It attaches to a seat on a plan (the server's `rate-limits-access.md` resource): View and Collab seats, and any seat on a Starter plan, get **20 read calls per month**; Full and Dev seats on Pro or higher get 200 per day; per-minute limits apply on top. Every read tool counts, `get_metadata` included.
  - **Free checks.** `whoami` is exempt from the limit and lists each plan and seat; reading MCP resources costs nothing. Nothing reports the remaining count, and a call that succeeds after a cap error is luck, not a reset.
  - **What to spend calls on.** What the browser does worst: `get_metadata` for a page's structure (one call = every set, variant id, size and position; densest pages first; the XML has no `<component-set>` element, a variant set is a `<frame>` whose children are `<symbol name="Property 1=…">`), and `get_design_context` / `get_variable_defs` on a dense, new or ambiguous set. Read simple values and take reference captures in the browser.
  - **How.** Never spend a call to probe the budget: the first needed fetch is the probe. Pace calls ≥10 s apart. On `reached the Figma MCP tool call limit`, put the error text in the handoff and finish browser-only.
- **MCP unavailable / capped → Claude-in-Chrome, with the Properties panel as the source of truth** (≈1 min per variant once set up; measured on the October 2026 extraction):
  - Navigate to `?node-id=<id>`: it switches pages (the Pages panel won't) and selects that node on load, so one navigation per far-away subtree beats scrolling. The **Properties** tab reverts to Comments on every load — click it, then confirm with a read, not a wait.
  - Read `[data-testid="properties-panel"]` innerText with a synchronous `javascript_tool` snippet (the Comments pane shares the test id; pick the element whose text has Layout/Typography). Async loops hit the 45 s CDP timeout, `get_page_text` serves stale text, and a `browser_batch` over ~50 actions dies.
  - Select a layer by id with no coordinates: dispatch pointerdown/mousedown/pointerup/mouseup/click on the `[data-testid="<id>-layers-panel-row"]` element itself (its text node is a `div`, not a `span`), then take a 0.1-scale screenshot — `requestAnimationFrame` never fires in the automation tab, so the screenshot is the only thing that ticks a frame and commits the selection; no JS nudge works. Fold "read the current panel + select the next node" into one `javascript_tool` call (two calls per node, not three). Rows exist only while inside the virtualised list (~37 rows); selecting auto-scrolls neighbours into reach. Never click rows by coordinate.
  - Walk by keyboard, one key per `computer` action: Enter = all children (the panel then aggregates every colour and variant prop of the subtree — a free palette read, but it collapses the Typography block, so read text layers singly), Tab / Shift+Tab = sibling, Shift+Enter = parent. Inside a set, Enter selects all variants; pick one by id.
  - An instance shows "Component properties" in the panel (`State · Hover …`): read a variant there without opening its main. Ids under an instance are session-synthetic; only main-node ids survive a reload.
  - Node values are not reachable from Figma's client store (embind handles); `store.getState().mirror.appModel.pagesList` is its one useful read. `shift+2` zooms to selection; `computer` → `zoom` screenshots are for orientation and for what the panel doesn't show — label such values "canvas measurement (±2px)". (This expands the CLAUDE.md "Design handoff" note into an actionable procedure.)

### 2. Validate frame ↔ screen

Before editing, confirm the Figma node maps to the **exact** app surface you are changing (which panel / component / screen). State the mapping so a wrong frame is caught before any code changes.

- **Placeholder data is not spec.** A truncated address like `40f5...4tgh` (`4tgh` isn't hex) is filler — reuse the existing format, don't invent one.
- **Absence is not removal.** A control missing from one frame isn't evidence it was cut; confirm before deleting anything.

### 3. Reuse before you write — a mock can't tell you what already exists

Before adding any CSS or a new control, prove it isn't already built:

- **Creator Hub surfaces use a different token system.** The `vars.css` rules in this skill are inspector-only. For Creator Hub renderer UI, map each literal to the `decentraland-ui2` theme or `renderer/src/themes/theme.css`, and update the table in `docs/DESIGN.md` → "Creator Hub (renderer)". No token crosses the iframe.
- **grep `theme/vars.css` for every literal in the spec** (hex, px, radius) before writing a rule — the value is often already a token (the spec's `#43404A` is `--gray-0`), so the "new" style is zero new CSS.
- **check `components/ui/` for a component that already renders this control** — a plain box in the mock may already exist as e.g. `WalletField` (validates on blur, shows an error) that a bare `TextField` would silently drop.
- **state the finding explicitly** — a mock can't express validation, focus order, or that a value is already a token, so "match the mock" silently becomes "re-implement what exists."

### 4. Sync the palette into the design system

When colours change, reconcile into BOTH, kept in sync:

- `packages/inspector/src/theme/vars.css` — the **source of truth** (`:root`; the 21-step `--base-01 … --base-21` light→dark ramp, role tokens like `--primary-main`, and the `--ui-designer-*` family). No hardcoded hex in inspector CSS — if a colour isn't a token, add one here.
- `docs/DESIGN.md` — the human doc: one table per Figma colour group under Tokens → "Colors" (`| Figma variable | Value | Use | vars.css | theme.css / ui2 | Status |`), the "Inspector role tokens" table (`| Token | Value | Figma equivalent | Use |`) for role tokens that aren't Figma variables, plus the "neutral ramp runs LIGHT → DARK" section. Always update it when tokens change. Refresh the WCAG contrast notes where accent luminance changes.

Respect intentional deviations (e.g. `--ui-designer-panel-bg` deliberately reuses `--base-19` `#242129`, not Figma's `#25212a`) — don't blindly overwrite. Use the `figma-create-design-system-rules` skill to (re)generate the rules doc.

### 5. Verify against the REAL render — not a mock

Preferred: run the Creator Hub app and navigate to the inspector, rather than spinning the inspector server each time.

- `cd packages/creator-hub && npm run start`. CH loads the inspector from `packages/inspector/public` at runtime, so rebuilding the inspector's `public/` (its own `npm run start` watch in `packages/inspector`) refreshes it with **no CH rebuild**.
- Reach 2D: the toolbar **ModeSwitcher "2D"** tab (needs scene `@dcl/sdk` ≥ 7.26.0).
- **Tradeoff:** CH is an Electron window that Chrome automation can't attach to. For pure 2D visual checks (canvas, panels, toolbar layout — no Bevy run controls, no persistence), the **standalone inspector dev server** (`cd packages/inspector && npm run start`, set `VITE_INSPECTOR_PORT` for a fixed port) is the browser-automatable surface — Babylon-only, non-persistent fixture. Use CH for anything touching Bevy scene-run or mode persistence.
- **Screenshots are ground truth.** `getComputedStyle` over CDP is unreliable for `:hover` / `:focus-within`.
- **Compare the full window at Figma's frame size, DPR 1.** Size the window to the frame (1920 × 1080): Playwright `page.setViewportSize` or CDP `Emulation.setDeviceMetricsOverride`, then `screenshot({ scale: 'css' })`; launch Electron with `--force-color-profile=srgb`. A window capped by the display height (953 on a laptop) is not a valid capture. Never compare crops at mismatched scales. Compare side by side, as a 50% overlay, and as per-row pixel profiles, and report measured numbers (px, alpha, ratio), not impressions.
- **Render traps that move pixels against Figma:**
  - Variable Inter applies its optical-size axis automatically (`opsz` = font size), rendering 2–3% narrower than Figma. `font-optical-sizing: none` gives Figma's widths.
  - Fractional line heights (MUI h1 1.167 → 56.016px) push every rule below onto half pixels, smeared over two device rows. Pin line heights to whole px.
  - `border-collapse: collapse` borders straddle the cell edge and smear the same way. Use `separate` and an inset `box-shadow`.
  - Figma layer blur N = CSS `blur(N / 2)`.
  - A centre-constrained child (a modal's glow) is positioned from the parent's centre, not its top: `top: calc(50% + offset)`.
  - A frame's background can be a different image from the app's. Measure the wash row by row against the app's render rather than copying the layer.
- **An element screenshot of a panel taller than its scroll area lies.** Playwright captures the element's whole box: the part clipped by the scroll container comes out as a dark band, and whatever is painted over the rest (the docked asset panel) lands in the image — it reads as a layout overlap that isn't there. Before shooting a tall panel, raise the viewport until the element sits entirely inside every `overflow` ancestor, check that in the page, and refuse the shot otherwise; shoot the base and the head at that same viewport. An all-dark shot of a panel is this artifact, not a design.

### 6. SVG / CSS gotchas (learned on the UI Designer toolbar)

- **Exporting glyphs from a View seat.** Quick actions hide "Copy as SVG" in view mode; right-click the node → Copy as → Copy as SVG and read the clipboard (`pbpaste`). Split an exported bar per cell. White and Snow fills and strokes become `currentColor`, named colours like `white` included, but never inside a `<mask>` (a mask reads luminance); any other colour stays as drawn. Icons go through the library's generator (`npm run generate:icons` in `packages/inspector`; lands with #1733), never into a hand-made module.
- **Keep the frame viewBox.** Figma scales an icon's whole frame, padding included, when a board places it (`arrow-right` at 10 draws 5.42 × 9.17; `Close` at 16 draws 9.33 at 3.33). Export at the frame (`0 0 24 24`, or `0 0 16 16`) and set the box the board draws; cropping to the artwork makes every icon a different size at the same box. Recipe: `docs/DESIGN.md` → Icons → "Adding an icon".
- **SVG inner-shadow ≠ CSS `box-shadow`** — a `feComposite` inner-shadow renders weaker than `box-shadow: inset` at the same numbers, and CSS `blur ≈ 2 × feGaussianBlur stdDeviation`. Match the _look_ in the browser, not the number.
- **`fill="currentColor"` + state cascade** — a higher-specificity state rule (`.active { color: … }`) silently overrides the base colour whenever that state is on. Check every state's _resolved_ colour.
- **Element-type selectors defeat class-scoped overrides.** A panel rule like `.Container.Scene .content svg { … }` (specificity 0,3,1) reaches a subcomponent's icon and out-ranks a `.Parent > .Child` override (0,2,0) — renaming the class can't dodge it. When nesting a subcomponent under a panel, grep for element-type selectors (`svg`, `input`, `img`) scoped to that panel, not just class names.
- **Relabelling a control can strip its accessible name.** A control whose visible label isn't associated with it (no `htmlFor`, no wrapping `<label>`) is named only by its `aria-label` or placeholder; deleting that as "redundant" after a rename passes typecheck, eslint, tests, and a grep for the old string. `ui/CheckboxField` and `ui/TextField` link their `Label` with `htmlFor`; check any other control. Verify the accessible name still **exists** in the accessibility tree, not just that the old string is gone.
- **CSS/TSX slip past the repo gates** — `make lint` skips `.tsx`, and neither `make lint` nor `make format` covers `.css`. Run `npx prettier --check` on touched `.css`, and `npx eslint` on touched `.tsx`, explicitly. The `.tsx` glob carries a standing baseline of pre-existing problems (never zero) — capture the count before editing, diff against it, and never `--fix` across the glob.

### 7. Running a multi-page extraction (the Design System → `docs/DESIGN.md` sync)

Learned on the October 2026 extraction (52 pages, 8 sections, a dozen runs). One lead session orchestrates; each run is one `dcl-designer-specialist` invocation.

- **Structure first, with the MCP; values with the browser.** Before any run, harvest `get_metadata` per page (densest pages first, calls ≥10 s apart) and save each XML to a file the runs read; stop at the first limit error. Everything else is the Properties-panel procedure in §1.
- **One run per Figma section, ≤5 pages or ~1 hour.** Split a dense section (Surfaces, Inputs) in two. `sonnet` for these runs, `haiku` for the harvest, `inherit` only for Spec/Validate feature work.
- **Every run** reads `docs/DESIGN.md` first and copies its structure: the doc follows Figma's order, and its "Sections index" maps each Figma page to its section and set blocks. Each Figma section is a `##` with a "<Section> tokens" table, then one block per component set headed `### <Figma set name> (<page>)`: a header line (set link, variants with node ids, size, read date, Code line), one value table with the ✱ rows, then the dated **Decisions** rows; tables only, no prose; verifies variant counts against the Layers tree; computes every contrast with a `node` WCAG script (3-digit hex bites); **persists readings to a notes file after each set**, so a usage-limit stop costs a relaunch, not the work — a stopped run resumes from its notes and never re-reads; ends in one checkpoint commit of `docs/DESIGN.md` only (`git add -- docs/DESIGN.md && git commit --no-verify …`, because the pre-commit hook rewrites and stages the whole tree); does not push; and reports cost (minutes, panel reads vs canvas measurements, confidence) plus findings split into **Figma-side defects (for design)** and **code-side decisions (for the user)**.
- **Token values never change in an extraction run.** Proposed tokens and values go in the handoff as PROPOSED; names are the user's call; value changes ship in their own PR with before/after shots of every `rg -l "var(--<token>)"` consumer.
- **The lead** pushes after each checkpoint, stops each agent once it has reported, switches branches only while no agent holds the tree, keeps one decision list, and asks the user once — after the runs — not per run.

### 8. The design loop: validate the running app against Figma

Figma → `docs/DESIGN.md` → spec → code → validate against Figma → refine, until nothing is left unexplained. `docs/DESIGN.md` is a snapshot and design keeps adding nodes, so Validate judges the render against the Figma frame itself, never against the spec alone.

- **Work in units, small to big.** A unit is one Figma component set (`ToolbarButton`, a split button, a menu, `RuntimeControls`), and it gets its own spec, Before/After set, Validate and PR. Order them as a dependency graph: primitives first, then the composites built from them, then one **assembly unit** per surface. The assembly unit validates the composition against the **board** that draws every variant of the surface (both toolbars, every panel state): order, insets, centring, which controls each variant carries, tab order. A Figma change then reaches only the unit in progress or a later one. Learned on the viewport toolbars (#1714), where one surface-wide layer took three rounds.
- **PRs form a star, not a stack.** One **hub** PR carries every change that paints nothing: `docs/DESIGN.md`, skills, agents and the PR template. Each unit's PR is a **spoke**: code and CSS. New tokens and aliases go in the hub PR with their `DESIGN.md` row; a value change to an existing token goes in a spoke PR with its Before | After. A spoke branches from the hub, or from `main` once the hub has merged, and touches no docs. It stacks on another spoke only when it edits that spoke's code. Merge the hub early and often, so new work branches from `main` and already has the latest design rules.
- **Align before the hard work, sign off after it.** Each unit opens with a cheap **match pass**: the unit's set and its board, read fresh, against the running code, as a short table of matches and mismatches. This is a flow to align the code to Figma: where Figma draws a value or a control, the code follows it, so a mismatch there is fixed, never asked about, and no option recommends a deviation from it (not for contrast, not to keep an extra control). It ends with every question for the user about what Figma doesn't draw (focus, drop, keyboard, user-facing names, behaviour, which board governs), brainstormed with them, each with a recommended default, asked interactively in one sitting (AskUserQuestion, up to four per call, recommended option first). No spec or code starts until those answers are in. The unit closes with a **sign-off**: show the user the Before | After | Figma result and ask whether it is what they meant, before the PR is opened or marked done.
- **Decisions live in `docs/DESIGN.md`.** Write every answer from the match pass, the rounds and the sign-off into the component's section as the current rule: in the value row it governs, or as a `| Topic | Rule |` row in its **Decisions** table, marked ✱ where it departs from Figma and "user decision" where it was the user's call. No dates, question numbers or earlier answers: a changed decision rewrites its row. Specs, chats and memory are not the record: the next unit, and the next session, grep `DESIGN.md` before asking again.
- **Spec from the board, not from its parts.** Before a unit's spec, open the board that composes it and list every variant with its node id. A decision such as "keep the 2D bar unchanged" is re-confirmed against the board's variant in every spec, never carried as settled: the board may draw that variant differently.
- **Figma moves while you work: re-read at every gate.** Re-read the unit's set and its board at the start of Spec, right before handing to the implementer, and at the start of every Validate round. Record the read time and the diff against the previous read in the spec's §0. Two free checks make this cheap: diff the page list read from Figma's client store (`store.getState().mirror.appModel.pagesList`) against `docs/DESIGN.md` → "Pages inventory" by node id, and diff the set's variant names and node ids in the Layers panel against the previous read. Only a set whose structure is unchanged needs its values re-read. If the board changes during a read, ask the user whether to wait for it to settle.

- **One image per component, states as rows.** Capture each state separately, then compose one grid per component or surface: a row per state (idle, hover, active, selected, focus, disabled…), columns **Before | After | Figma**, each row and column labelled (ImageMagick `montage`, with `-font /System/Library/Fonts/Supplemental/Arial.ttf` or it fails here). A button recoloured across four states is one image, not four. Where Figma is silent for a state, that cell says so. The Figma image is a browser capture zoomed to selection, or `get_screenshot` when the day's budget allows.
- **Inside Creator Hub too.** Shoot the full list on the standalone inspector, and the key surfaces inside the app: Creator Hub in dev with `VITE_INSPECTOR_PORT` set to the port serving the inspector under test, signed out under a temp `HOME` and `--user-data-dir`, with `--force-color-profile=srgb`. The host sets the iframe width, the colour profile and the chrome around the panel, which the standalone server can't show. After a CSS change, a plain iframe reload in a running Creator Hub can keep serving the cached `bundle.css`; fetch it with a cache-busting query (or restart the app) before you judge the render. To shoot Before and After inside Creator Hub side by side, build one renderer per inspector port (`VITE_INSPECTOR_PORT` is baked in at build time) and pair each with the same `main/dist` and `preload/dist` in its own scratch app folder, since main loads the renderer relative to its own real path. Launch each with Playwright `_electron`, signed out under its own temp `HOME` and `--user-data-dir`.
- **Class every mismatch; the class picks the owner.** Code drift (`docs/DESIGN.md` right, render wrong) goes to the implementer. Doc drift (`docs/DESIGN.md` ≠ Figma) goes to the designer, who fixes the doc and the spec before the implementer runs again. Figma silent or defective (no focus state drawn, a contrast miss) goes to the user; an accepted answer becomes a ✱ deviation row, so later rounds don't flag it again.
- **The user confirms the comparison before any spec delta.** Show the full-window comparison (§5) and its numbers first; change the spec only once the user agrees it shows the mismatch. An accepted ✱ on a visible property is the user's call, never the designer's.
- **An accepted deviation is not drift.** Before classing a mismatch, grep `docs/DESIGN.md`'s ✱ rows, the gap ledger and the spec's resolved decisions. A match there means the render is right, even where it differs from Figma (the inset menu rule, the user's decision on #1707).
- **Check the accessibility tree, not just pixels.** Playwright `ariaSnapshot` on every touched control: the name, the role, the state (`aria-pressed`, `aria-selected`, `aria-expanded`), and no unnamed `img` from a decorative glyph.
- **Stop condition.** Every mismatch is fixed or an accepted deviation. After three rounds without that, stop and ask the user.

### 9. Screenshots: capture and the PR body

- **Before / After, never base / head.** That goes for captions, file suffixes (`-before` / `-after`), grid columns (Before | After | Figma) and PR headings.
- **One script per environment, run at both ends**, so a pair can only differ because of the code. A PR body's Before is the PR's base commit, not the previous round's state.
- **Reset state before every shot, and log it.** Step order and starting state produce false findings: a 2D round trip earlier in a script reset Align to World, and a toggle that starts on was turned off by the shot's own click. A forced `:hover` can fail to register; move the real mouse.
- **Name the renderer and fixture per row.** The standalone inspector runs Babylon and Creator Hub runs Bevy, and some controls exist under only one. A state the fixture can't reach (a menu that needs scene info) is listed as such, or shot on a fixture that has it.
- **Evidence must be newer than the code.** Compare the shots' timestamps with the touched files' modification times before judging them.
- **Composites:** `montage -depth 8` (it writes 16-bit PNGs by default, twice the size); stack a pair vertically when the image is ≥ 4× wider than tall.
- **Upload without posting.** `gh` can't upload images, so you upload them yourself (user decision): attach them in the PR's comment box, harvest each `user-attachments` URL, clear the box, and never submit it. Upload in batches of 5–10, under 8 MB per call (the browser upload tool refuses more than 10 MB at once), and count the resolved links after each batch. GitHub silently stops accepting uploads after a burst of attachments: the tool still reports success, but no link appears. Plan a large set as batches of about 60 roughly two hours apart (one wait of 70 minutes after 66 uploads was not enough), and probe with a single file before each batch. GitHub drops each upload into the box as an `<img … src="https://github.com/user-attachments/assets/…">` tag, not markdown, so harvest the `src` attributes. Fill the body from the first batch right away and leave the missing slots as HTML comments, which render as nothing. After writing the body, check every image with a ranged GET (`curl -r 0-0`, expect 206; HEAD returns 403). A brand-new upload can 404 for a few seconds until a posted body references it. An upload stays reachable on the public repo even if the comment is never posted, which is safe because a shot only ever captures fixture data: never a signed-in profile's wallet, email or scene names.

## After the change, verify these are still TRUE

A Figma→code task fails quietly, not loudly. Confirm:

- no CSS was added for a value that's already a token or a shipped default;
- an existing component (with its validation) was reused, not re-implemented;
- every control still has an accessible name — not just that the old label is gone;
- the `.tsx` eslint baseline didn't grow.
