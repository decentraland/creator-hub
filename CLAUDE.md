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

### Code Quality

```bash
make lint          # ESLint across all packages
make lint-fix      # ESLint autofix + syncpack
make format        # Prettier check
make format-fix    # Prettier write
make typecheck     # TypeScript type checking across all workspaces
```

**Note:** `make lint-fix` runs `make sync-deps` first, which can fail on
branches that pin `@dcl/*` packages to SDK-toolchain tarball URLs (syncpack
reports `UnsupportedMismatch`). When this happens, run `npm run lint:fix`
directly to skip syncpack and still get ESLint autofixes.

**Note:** npm won't repair a missing transitive lockfile node. When `npm ls` /
a build's `ELSPROBLEMS` reports a transitive dep `missing` (e.g. `buffer-crc32`
under the `@dcl/sdk-commands` tarball subtree), a plain `npm install` will NOT
add it — npm trusts the existing lockfile and reports "up to date". Add the
`node_modules/<dep>` package node to `package-lock.json` directly (version +
registry `resolved`/`integrity`), then `npm install`/`npm ci` to reify it. Since
the parent packages declare the dep, the node then sticks.

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
- **Codegen safety (`engine-to-composite.ts`):** when emitting author-controlled strings (e.g. `core-schema::Name`) into generated TS source, escape BOTH positions — *values* via `JSON.stringify(...)` and *identifiers* (enum keys, interface/type/member names) via the `toSafeIdentifier` chokepoint (sanitize + reserved-word guard). Raw `"${name}"` interpolation is an injection / build-break vector.
- **UI Designer entities (`core::UiTransform`-parented):** UI Designer nodes carry only `core::UiTransform` (parent index) — never `core::Transform` — and never appear in the editor `Nodes` tree. Generic Transform-based helpers silently no-op on them: `removeEntity` / `getComponentEntityTree(…, Transform)` yield nothing, so they delete/walk nothing. For any UI-node lifecycle op (delete/duplicate/reparent/reorder), use a dedicated `*-ui-*` operation that walks the UiTransform parent index via `collectDescendants` (`lib/sdk/operations/tree-walk.ts`).
- **UI Designer canvas size is the runtime virtual resolution:** the `asset-packs::UI` marker's `canvasWidth`/`canvasHeight` (default 1920×1080) are both the editor design-canvas size AND the `virtualWidth`/`virtualHeight` passed to `addUiRenderer` (`packages/asset-packs/src/ui-renderer.tsx`); the runtime scales the UI by `min(screenW/vW, screenH/vH)` to fit the player's screen. It is **not** editor-only — persisting it on the marker is what delivers it to runtime (no codegen). The inspector `Canvas.tsx` reads it from the root `UINode` and renders a fixed-size "scaled stage" (`size·scale`, `transform-origin: top left`) so the canvas keeps a strict size and scrolls instead of shrinking with the panel.
- **UI Designer render components are *derived* from `asset-packs::UIDesign` (Tween pattern), not persisted standalone:** on save the inspector folds each UI node's `core::UiTransform`/`UiText`/`UiInput`/`UiDropdown`/`UiBackground` into `UIDesign` (`engine-to-composite.ts`, gated by `UI_RENDER_COMPONENT_NAMES`), splits them back on load (`splitUIDesignToCore` in `ui-design-migration.ts`), and the runtime re-derives them every tick (`ui-runtime.ts` `materialize*`). A render component left OUT of this pipeline is never re-derived and silently drops on hot-reload (this was the `UiBackground` bug). Adding a new UI render component means touching all five: the `UIDesign` schema (`versioning/registry.ts`), `UI_RENDER_COMPONENT_NAMES`, the encode loop, `splitUIDesignToCore`, and a `materialize*`.
- **Don't use `generateUniqueName` for UI node names:** it walks the editor `Nodes` tree (`getNodes`), which excludes UiTransform-only UI nodes, so it can't see existing UI names — and the codegen enum-dedup only makes enum *keys* unique (the `Name` *values* still collide, breaking `engine.getEntityByName` from scene code). Use `generateUniqueUiName` (`lib/sdk/operations/add-child.ts`), which scans the `core-schema::Name` component directly for global uniqueness (`Label`, `Label_1`, …).

### Asset Packs

- Runtime built with `@dcl/sdk-commands` (SDK7 scene).
- TypeScript library (`dist/`) + catalog.json + binary assets (`bin/`).
- Scripts for validating, uploading to S3, and downloading assets.
- Public API is exported via `src/definitions.ts` (built to `dist/definitions.js`, the package `main`). Cross-package VALUE imports from `@dcl/asset-packs` in the inspector only resolve after rebuilding asset-packs (`make build-asset-packs`). This also affects the inspector's **vitest unit tests**, which import the built `@dcl/asset-packs` — a source edit in asset-packs won't be seen (in imports, typecheck, or tests) until rebuilt. `npm run build:lib` (in `packages/asset-packs`) is the minimal/fast rebuild to refresh `dist/`.

## Code Style

- **ESLint**: `@typescript-eslint/consistent-type-imports` is enforced (use `import type` for type-only imports).
- **Lint scope**: `make lint` / `npm run lint` runs `eslint . --ext js,cjs,ts` — it does **not** lint `.tsx` files. Don't rely on the lint gate to catch `.tsx` issues; a standalone `eslint <file>.tsx` may surface a pre-existing `consistent-type-imports` false-positive on the `@dcl/react-ecs` JSX-pragma default import (e.g. `ui-renderer.tsx`).
- **Prettier**: single quotes, semicolons, trailing commas, 100 char print width, `arrowParens: "avoid"`.
- **Import order**: ESLint enforced. React first, then `@dcl/*`, then `decentraland-*`, then MUI/internal, then relative.
- **Component-directory barrels**: inspector component directories use a per-directory `index.ts` barrel (`export { X } from './X'`) — ~30/31 dirs follow this. Add one when creating a component; don't strip these barrels for file-count reduction — it breaks the established convention.
- **Unused vars**: prefix with `_` (e.g., `_unused`).
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

Redux Toolkit auto-freezes state via Immer (the `createSlice` default). Helpers
that mutate objects in place (e.g. asset-packs'
`deepReplaceAssetPath` / `substituteAssetPathInComposite`) throw
`TypeError: Cannot assign to read only property` — or fail silently — when
passed payloads read from Redux. Deep-clone (`structuredClone(x)`) at the
boundary before passing Redux-sourced data to any mutating helper. Symptoms
when missed: writes silently no-op, original placeholder tokens (e.g.
`{assetPath}/...`) survive into the engine.

### Asset-packs circular imports & vitest

`packages/asset-packs/src/definitions.ts` re-exports every internal module via
`export * from './...'`. Production bundlers hoist these bindings, but the
Vitest loader resolves the re-export *before* the leaf module finishes
evaluating — so importing constants like `COMPONENTS_WITH_ID` or `getNextId`
through `definitions.ts` will see them as `undefined` at call time inside the
same source tree. In `asset-packs` source files and tests, import these
constants from the leaf module directly (`from './id'`, `from './types'`,
etc.) rather than via the `definitions.ts` barrel.

### Asset-pack composite placeholders must resolve before the engine serializes

Asset-pack `composite.json` files encode references as portable placeholders:
paths as `{assetPath}/...`, ids as `{self}` / `{self:Component}` / `{N:Component}`,
and `SyncComponents.componentIds` as component-**name** strings (e.g.
`"asset-packs::States"`). Each must be resolved to a concrete value before the
runtime engine serializes the component. The runtime `core-schema::Sync-Components`
`componentIds` schema is `Array(Int64)`, so an unresolved name reaching it makes
the CRDT serializer throw `SyntaxError: Cannot convert <name> to a BigInt` every
tick. Resolution lives in two places: the Inspector resolves names→ids on ingest
(`add-asset`'s `parseSyncComponents`); the SPAWN_ENTITY runtime path resolves
post-`Composite.instance` in `add-child.ts` (`remapSyncComponentIds`, beside the
`{self}` id/trigger remap). When adding a placeholder-bearing field — or debugging
a `Cannot convert … to a BigInt` serialize crash — ensure both paths resolve it.

## Skills

Skills live in `.ai/skills/*/SKILL.md`. Read the relevant `SKILL.md` when a task matches a skill's domain.

## Standards

Read the relevant standards doc when the task touches its domain:

- [`docs/coding-standards.md`](docs/coding-standards.md) — React patterns and antipatterns (controlled-input prop-sync, memoized components built in render). Read when touching `TextField`, the tree `<Input>`, or building any component with a buffered value.
- [`docs/testing-standards.md`](docs/testing-standards.md) — E2E patterns (real keyboard input vs `fill()`, locators vs `ElementHandle`s, focus-actually-on-element gates, outcome waits vs fixed sleeps). Read when writing or debugging Playwright tests.
