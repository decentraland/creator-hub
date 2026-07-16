# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decentraland Creator Hub is a monorepo (npm workspaces) with three packages:

- **`@dcl/asset-packs`** (`packages/asset-packs`) — Curated 3D assets and Smart Items for Decentraland scenes. Publishes to npm.
- **`@dcl/inspector`** (`packages/inspector`) — Web-based 3D scene inspector using Babylon.js and Redux/Redux-Saga. Publishes to npm.
- **`creator-hub`** (`packages/creator-hub`) — Electron desktop app (main/preload/renderer architecture) with React + Redux Toolkit frontend. Uses `decentraland-ui2` (MUI-based) for UI components.

Dependencies flow: `asset-packs` → `inspector` → `creator-hub` (each depends on the previous via `file:` links).

## Common Commands

### Setup

```bash
make init          # Full setup: clean, install deps, protoc, build all
```

### Build

```bash
make build                # Build all packages (order: asset-packs → inspector → creator-hub)
make build-asset-packs    # Build only asset-packs
make build-inspector      # Build only inspector
make build-creator-hub    # Build only creator-hub
```

### Development

```bash
cd packages/creator-hub && npm run start    # Electron app in watch mode
cd packages/inspector && npm run start      # Inspector in watch mode
cd packages/asset-packs && npm run start    # Asset packs dev server (port 8001)
```

### Testing

```bash
make test                  # Unit tests for all packages (vitest)
make test-e2e              # E2E tests (Playwright) for inspector + creator-hub

# Per-package tests
cd packages/creator-hub && npm run test:unit      # All unit tests (main, preload, renderer, shared)
cd packages/creator-hub && npm run test:main       # Main process tests only
cd packages/creator-hub && npm run test:renderer   # Renderer tests only
cd packages/creator-hub && npm run test:shared     # Shared tests only
cd packages/inspector && npm run test              # Inspector unit tests
cd packages/inspector && npm run test:e2e          # Inspector E2E tests
```

**Note:** run vitest from inside the package (`cd packages/<pkg> && npx vitest run`). Invoking `npx vitest run` from the repo root sweeps up every workspace's specs without their per-package configs/setup and reports mass failures that are pure cwd artifacts.

### Code Quality

```bash
make lint          # ESLint across all packages
make lint-fix      # ESLint autofix + syncpack
make format        # Prettier check
make format-fix    # Prettier write
make typecheck     # TypeScript type checking across all workspaces
```

**Note:** `make lint-fix` runs `make sync-deps` first, which can fail on branches that pin `@dcl/*` packages to SDK-toolchain tarball URLs (syncpack reports `UnsupportedMismatch`). When this happens, run `npm run lint:fix` directly to skip syncpack and still get ESLint autofixes.

**Note:** npm won't repair a missing transitive lockfile node. When `npm ls` / a build's `ELSPROBLEMS` reports a transitive dep `missing` (e.g. `buffer-crc32` under the `@dcl/sdk-commands` tarball subtree), a plain `npm install` will NOT add it — npm trusts the existing lockfile and reports "up to date". Add the `node_modules/<dep>` package node to `package-lock.json` directly (version + registry `resolved`/`integrity`), then `npm install`/`npm ci` to reify it. Since the parent packages declare the dep, the node then sticks.

### Protocol Buffers

Proto files live at `packages/inspector/src/lib/data-layer/proto/`. After modifying `.proto` files:

```bash
make protoc        # Regenerate TypeScript from .proto files
```

## Architecture Notes

### Creator Hub (Electron)

- **main/** — Electron main process (Node.js). Manages scenes, runs local servers, handles IPC.
- **preload/** — Preload scripts bridging main↔renderer via contextBridge.
- **renderer/** — React SPA with Redux Toolkit, `react-router-dom`, `react-intl` for i18n. Uses `decentraland-ui2` (wraps MUI).
- **shared/** — Shared types and utilities used across main/preload/renderer.
- Build tool: Vite for all three layers.

### Inspector

- 3D editor using Babylon.js with a React UI layer.
- State management: Redux Toolkit + Redux-Saga.
- Data layer communicates via Protocol Buffers (gRPC-like, using `@dcl/mini-rpc`).
- Build: custom `build.js` using esbuild.
- **Codegen safety (UI Designer splices):** when emitting author-controlled strings into generated/spliced TS source, escape BOTH positions — _values_ via proper string-literal escaping and _identifiers_ (variable/prop/callback names) via the `isValidIdentifier` gate (`lib/sdk/operations/validators.ts`). Raw `"${name}"` interpolation is an injection / build-break vector.
- **UI Designer canvas direct-manipulation commits are async.** A drag/resize handler splices the source, which round-trips (RPC parse → tree rebuild) later. Clearing the live CSS offset / `isDragging` on mouseup _before_ that lands snaps the node back to its old position for a frame, then jumps to the new one. Hold the dropped state optimistically (local state applied in render) until the committed value matches, then release it (`Canvas.tsx` `optimisticPos`).
- **Testing the UI Designer in the Creator Hub app:** CH loads the inspector iframe from `packages/inspector/public` at _runtime_ (`creator-hub/main/src/modules/inspector.ts`), so rebuilding the inspector's `public/` (e.g. `npm run start` watch in `packages/inspector`) is enough — no CH rebuild. The UI Designer panel is hidden by default (`inspector/src/redux/ui/index.ts` → `hiddenPanels: { [PanelName.UI_DESIGNER]: true }`) and CH ships no toggle, so exercising it requires temporarily flipping that default (revert before commit). A UI authored via code-as-source is plain `@dcl/react-ecs` — the scene preview renders it natively with no `@dcl/asset-packs` overlay.
- **Code-as-source is the UI Designer's single source of truth.** Every UI root is a real `@dcl/react-ecs` component file under the scene's `src/ui/` (file-per-root, with a generated `src/ui/index.tsx` aggregator that calls `ReactEcsRenderer.setUiRenderer` directly, no `asset-packs` involvement), and the canvas is a live view that splices that source in place (byte-span edits via `emit-adapter.ts`, never a full AST regeneration). The earlier ECS-composite pipeline (`asset-packs::UI`/`UIBindings`/`UIDesign` schemas, the derive/split/materialize runtime, and the engine-entity `*-ui-*` operations) has been fully removed. See `docs/solutions/feature-implementation/ui-designer-code-as-source.md` for the full parse/splice architecture.
- **Binding surface = typed `export const state: State` object (primary), with hand-authored `@ui-bind`/`@ui-action` JSDoc markers as the fallback.** A field bound to the typed convention reads as `value={state.score}` in source; a marker-bound field reads as `value={score}`. Adding a variable through the editor always seeds/writes into the typed `state` object (`code/state-convention.ts`) — markers only ever originate from hand-authored or foreign code, never from the editor itself.
- **UI root lifecycle ops live in `code/store.ts`** (`createRoot`/`renameRoot`/`removeRoot`). Rename is write-new-file + delete-old-file, not a true rename — the scene-storage bridge only exposes read/write/delete, no `rename`.
- **Adding a representable react-ecs element or prop to the code-as-source parser means touching three files together:** `code/parse-adapter.ts` (read — recognize it, otherwise it silently falls back to an opaque/read-only node), `code/emit-adapter.ts` (write — a new span-splice `Edit` builder), and `code/ecs-shape.ts` (PB ⇄ ergonomic value transform, when the prop needs one). Mirror the existing thin-slice pattern rather than growing a general-purpose codegen.

### Asset Packs

- Runtime built with `@dcl/sdk-commands` (SDK7 scene).
- TypeScript library (`dist/`) + catalog.json + binary assets (`bin/`).
- Scripts for validating, uploading to S3, and downloading assets.
- Public API is exported via `src/definitions.ts` (built to `dist/definitions.js`, the package `main`). Cross-package VALUE imports from `@dcl/asset-packs` in the inspector only resolve after rebuilding asset-packs (`make build-asset-packs`). This also affects the inspector's **vitest unit tests**, which import the built `@dcl/asset-packs` — a source edit in asset-packs won't be seen (in imports, typecheck, or tests) until rebuilt. `npm run build:lib` (in `packages/asset-packs`) is the minimal/fast rebuild to refresh `dist/`.
- **`@dcl/asset-packs` is the shared home for generic helpers the inspector consumes** (e.g. `parseHexColor` / `validateAssetPath` in `src/validation.ts`). When deleting an asset-packs feature module, relocate its generically useful exports there (and keep the `definitions.ts` re-export) instead of inlining them into inspector consumers.

## Code Style

- **ESLint**: `@typescript-eslint/consistent-type-imports` is enforced (use `import type` for type-only imports).
- **Lint scope**: `make lint` / `npm run lint` runs `eslint . --ext js,cjs,ts` — it does **not** lint `.tsx` files. Don't rely on the lint gate to catch `.tsx` issues; a standalone `eslint <file>.tsx` may surface a pre-existing `consistent-type-imports` false-positive on the `@dcl/react-ecs` JSX-pragma default import (e.g. `ui-renderer.tsx`).
- **Prettier**: single quotes, semicolons, trailing commas, 100 char print width, `arrowParens: "avoid"`.
- **Import order**: ESLint enforced. React first, then `@dcl/*`, then `decentraland-*`, then MUI/internal, then relative.
- **Component-directory barrels**: inspector component directories use a per-directory `index.ts` barrel (`export { X } from './X'`) — ~30/31 dirs follow this. Add one when creating a component; don't strip these barrels for file-count reduction — it breaks the established convention.
- **Unused vars**: prefix with `_` (e.g., `_unused`).
- **Comments**: code must be self-explanatory (clear names, small functions). Do NOT write comments that only restate what the next line does — delete them. Keep only comments that add value the code can't convey: the non-obvious *why* (rationale, trade-off, gotcha, bug/constraint reference), invariants, or warnings.
- **Module type**: ESM (`"type": "module"` in all package.json files).
- **Node version**: 22.x or higher required.

## Styled Components Conventions

Files matching `*.styled.ts` / `*.styled.tsx` must follow these rules:

- Import `styled`, `keyframes`, and MUI components from `decentraland-ui2` (not `@emotion/styled` or `@mui/material`).
- Use object syntax only (no template literals): `styled(Box)(({ theme }) => ({ ... }))`.
- Use `styled('tag')` form for HTML elements (not `styled.tag`).
- Use theme tokens for all colors, spacing, typography, breakpoints — no hardcoded values.
- Define styled components as `const`, group all `export { ... }` at the end of the file alphabetically.
- No comments, no `!important`, no inline styles in styled component files.
- Keep styled components in separate `Component.styled.ts` files alongside `Component.tsx`.

## Testing Conventions

- Test framework: **Vitest** (not Jest, though patterns are similar). Tests use `describe`/`it`/`beforeEach`.
- Structure tests with `describe("when ...", () => { ... })` for context, `it("should ...", () => { ... })` for behavior.
- Scope mocks and test data to the specific `describe` block that needs them (not globally).
- Variables and mocks go in `beforeEach`, cleanup in `afterEach`.
- React: use `@testing-library/react` with accessible queries (`getByRole`, `getByLabelText`).
- E2E: Playwright for both Electron app and web inspector.
- **asset-packs unit specs**: a `*.spec.ts` may live in `packages/asset-packs/src/`, but it MUST stay excluded in BOTH `tsconfig.lib.json` and the base `tsconfig.json` (both `include: ["src"]` with `types: ["@dcl/js-runtime"]`, and are typechecked by `npm run build:lib` and `sdk-commands build` respectively). Otherwise the spec's `import … from 'vitest'` drags vitest→vite→rollup→`@types/node` global types into the library build and breaks it with `console`/`Response`/`Worker` conflicts.

### Redux state freeze + in-place mutating helpers

Redux Toolkit auto-freezes state via Immer (the `createSlice` default). Helpers that mutate objects in place (e.g. asset-packs' `deepReplaceAssetPath` / `substituteAssetPathInComposite`) throw `TypeError: Cannot assign to read only property` — or fail silently — when passed payloads read from Redux. Deep-clone (`structuredClone(x)`) at the boundary before passing Redux-sourced data to any mutating helper. Symptoms when missed: writes silently no-op, original placeholder tokens (e.g. `{assetPath}/...`) survive into the engine.

### Asset-packs circular imports & vitest

`packages/asset-packs/src/definitions.ts` re-exports every internal module via `export * from './...'`. Production bundlers hoist these bindings, but the Vitest loader resolves the re-export _before_ the leaf module finishes evaluating — so importing constants like `COMPONENTS_WITH_ID` or `getNextId` through `definitions.ts` will see them as `undefined` at call time inside the same source tree. In `asset-packs` source files and tests, import these constants from the leaf module directly (`from './id'`, `from './types'`, etc.) rather than via the `definitions.ts` barrel.

### Asset-pack composite placeholders must resolve before the engine serializes

Asset-pack `composite.json` files encode references as portable placeholders: paths as `{assetPath}/...`, ids as `{self}` / `{self:Component}` / `{N:Component}`, and `SyncComponents.componentIds` as component-**name** strings (e.g. `"asset-packs::States"`). Each must be resolved to a concrete value before the runtime engine serializes the component. The runtime `core-schema::Sync-Components` `componentIds` schema is `Array(Int64)`, so an unresolved name reaching it makes the CRDT serializer throw `SyntaxError: Cannot convert <name> to a BigInt` every tick. Resolution lives in two places: the Inspector resolves names→ids on ingest (`add-asset`'s `parseSyncComponents`); the SPAWN_ENTITY runtime path resolves post-`Composite.instance` in `add-child.ts` (`remapSyncComponentIds`, beside the `{self}` id/trigger remap). When adding a placeholder-bearing field — or debugging a `Cannot convert … to a BigInt` serialize crash — ensure both paths resolve it.

## Skills

Skills live in `.ai/skills/*/SKILL.md`. Read the relevant `SKILL.md` when a task matches a skill's domain.

## Standards

Read the relevant standards doc when the task touches its domain:

- [`docs/coding-standards.md`](docs/coding-standards.md) — React patterns and antipatterns (controlled-input prop-sync, memoized components built in render). Read when touching `TextField`, the tree `<Input>`, or building any component with a buffered value.
- [`docs/testing-standards.md`](docs/testing-standards.md) — E2E patterns (real keyboard input vs `fill()`, locators vs `ElementHandle`s, focus-actually-on-element gates, outcome waits vs fixed sleeps). Read when writing or debugging Playwright tests.
- [`docs/DESIGN.md`](docs/DESIGN.md) — the inspector design system: `theme/vars.css` palette by role, the light→dark `--base-*` ramp gotcha + correct dark-surface pairing, spacing/fonts, and focus/contrast/motion/ARIA conventions. Read when writing or reviewing inspector CSS/`.tsx` styling (colors, focus states, accessibility). Note: `brand-guidelines` (Anthropic) does NOT apply here.
