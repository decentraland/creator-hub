# Map, reuse, sync and verify

## Validate frame ↔ screen

Before editing, confirm the Figma node maps to the **exact** app surface you are changing (which panel / component / screen). State the mapping so a wrong frame is caught before any code changes.

- **Placeholder data is not spec.** A truncated address like `40f5...4tgh` (`4tgh` isn't hex) is filler — reuse the existing format, don't invent one.
- **Absence is not removal.** A control missing from one frame isn't evidence it was cut; confirm before deleting anything.

## Reuse before you write — a mock can't tell you what already exists

Before adding any CSS or a new control, prove it isn't already built:

- **Creator Hub surfaces use a different token system.** The `vars.css` rules in this skill are inspector-only. For Creator Hub renderer UI, map each literal to the `decentraland-ui2` theme or `renderer/src/themes/theme.css`, and update the table in `docs/DESIGN.md` → "Creator Hub (renderer)". No token crosses the iframe.
- **grep `theme/vars.css` for every literal in the spec** (hex, px, radius) before writing a rule — the value is often already a token (the spec's `#43404A` is `--gray-0` (legacy); `docs/DESIGN.md` → "Token naming" lists the canonical names), so the "new" style is zero new CSS.
- **check `components/ui/` for a component that already renders this control** — a plain box in the mock may already exist as e.g. `WalletField` (validates on blur, shows an error) that a bare `TextField` would silently drop.
- **state the finding explicitly** — a mock can't express validation, focus order, or that a value is already a token, so "match the mock" silently becomes "re-implement what exists."

## Sync the palette into the design system

When colours change, reconcile into BOTH, kept in sync:

- `packages/inspector/src/theme/vars.css` — the code's token file; Figma wins where it draws (`:root`; the 21-step `--base-01 … --base-21` light→dark ramp, role tokens like `--primary-main`, and the `--ui-designer-*` family). No hardcoded hex in inspector CSS — if a colour isn't a token, add one here.
- `docs/DESIGN.md` — the human doc: one table per Figma colour group under Tokens → "Colors" (`| Figma variable | Value | Use | vars.css | theme.css / ui2 | Status |`), the "Inspector role tokens" table (`| Token | Value | Figma equivalent | Use |`) for role tokens that aren't Figma variables, plus the "neutral ramp runs LIGHT → DARK" section. Always update it when tokens change. Refresh the WCAG contrast notes where accent luminance changes.

Respect intentional deviations (e.g. `--ui-designer-panel-bg` deliberately reuses `--base-19` `#242129`, not Figma's `#25212a`) — don't blindly overwrite.

## Verify against the REAL render — not a mock

Preferred: run the Creator Hub app and navigate to the inspector, rather than spinning the inspector server each time.

- `cd packages/creator-hub && npm run start`. CH loads the inspector from `packages/inspector/public` at runtime, so rebuilding the inspector's `public/` (its own `npm run start` watch in `packages/inspector`) refreshes it with **no CH rebuild**.
- Reach 2D: the toolbar **ModeSwitcher "2D"** tab (needs scene `@dcl/sdk` ≥ 7.26.0).
- **Tradeoff:** CH is an Electron window that Chrome automation can't attach to. For pure 2D visual checks (canvas, panels, toolbar layout — no Bevy run controls, no persistence), the **standalone inspector dev server** (`cd packages/inspector && npm run start`, set `VITE_INSPECTOR_PORT` for a fixed port) is the browser-automatable surface — Babylon-only, non-persistent fixture. Use CH for anything touching Bevy scene-run or mode persistence.
