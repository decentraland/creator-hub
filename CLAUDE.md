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

### Asset Packs

- Runtime built with `@dcl/sdk-commands` (SDK7 scene).
- TypeScript library (`dist/`) + catalog.json + binary assets (`bin/`).
- Scripts for validating, uploading to S3, and downloading assets.

## Code Style

- **ESLint**: `@typescript-eslint/consistent-type-imports` is enforced (use `import type` for type-only imports).
- **Prettier**: single quotes, semicolons, trailing commas, 100 char print width, `arrowParens: "avoid"`.
- **Import order**: ESLint enforced. React first, then `@dcl/*`, then `decentraland-*`, then MUI/internal, then relative.
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

## Skills

Skills live in `.ai/skills/*/SKILL.md`. Read the relevant `SKILL.md` when a task matches a skill's domain.
