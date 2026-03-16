# Architecture

This document describes how the three packages in Creator Hub connect and communicate at runtime. For per-package details, see each package's own README. For setup instructions, see the [root README](../README.md).

## Bird's eye view

Creator Hub is a desktop application for building 3D scenes in [Decentraland](https://decentraland.org/). The codebase is a monorepo with three packages that form a linear dependency chain:

```
asset-packs ──▶ inspector ──▶ creator-hub
```

Each package is independently publishable to npm. `creator-hub` consumes the others as dependencies, but `inspector` and `asset-packs` can also run standalone.

```
┌──────────────────────────────────────────────────────────┐
│                   Creator Hub (Electron)                 │
│                                                          │
│  ┌──────────────┐  IPC   ┌───────────┐  contextBridge   │
│  │     Main     │◄──────►│  Preload  │◄────────────────┐│
│  │  (Node.js)   │        │  (Bridge) │                 ││
│  └──────┬───────┘        └───────────┘                 ││
│         │                                              ││
│         │ HTTP (localhost)                              ││
│         ▼                                              ││
│  ┌──────────────────────────────────────────────────┐  ││
│  │              Inspector (iframe)                   │  ││
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │  ││
│  │  │Babylon.js│  │  Redux   │  │   Data Layer   │──┼──┘│
│  │  │  Engine  │  │  + Saga  │  │ (Proto / RPC)  │  │   │
│  │  └──────────┘  └──────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────┐  ┌─────────────┐                      │
│  │  Renderer    │  │ Asset Packs │ (runtime logic        │
│  │ (React SPA)  │  │ (SDK7 lib)  │  loaded into scenes)  │
│  └──────────────┘  └─────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

## Architecture invariants

These are non-obvious design constraints that hold across the codebase. Violating them will break things in ways that aren't immediately apparent.

1. **Renderer never imports `electron` or Node.js modules directly.** All system access goes through the preload bridge (`preload/src/services/`). This boundary is enforced by Electron's context isolation and the Vite build configuration.

2. **The Inspector is transport-agnostic at the data layer.** It communicates exclusively through the `DataService` protocol (`data-layer.proto`), regardless of whether the backing storage is local files, an iframe bridge, or a remote WebSocket server. This means the Inspector can run in any context that implements the `DataService` RPC contract.

3. **Asset packs are self-contained.** They define their own component schemas and runtime systems using only the `@dcl/ecs` API. They must work with any Inspector version that supports the same SDK version.

## Communication patterns

A running Creator Hub instance uses five distinct communication channels:

```
┌────────────────────────────────────────────────────────────┐
│                    Creator Hub Process                     │
│                                                            │
│  ┌─────────┐  Electron IPC   ┌──────────┐                 │
│  │  Main   │◄───────────────►│ Preload  │                 │
│  │ Process │                 │          │                 │
│  └────┬────┘                 └─────┬────┘                 │
│       │                            │ contextBridge        │
│       │                            ▼                      │
│       │                      ┌──────────┐                 │
│       │                      │ Renderer │                 │
│       │                      │ (React)  │                 │
│       │                      └────┬─────┘                 │
│       │                           │                       │
│       │ HTTP                      │ postMessage           │
│       │ (localhost:PORT)          │ (MessageTransport)    │
│       │                           ▼                       │
│       │                      ┌──────────────────────┐     │
│       └─────────────────────►│     Inspector        │     │
│         serves static files  │  (iframe, Babylon.js)│     │
│                              └──────────┬───────────┘     │
│                                         │                 │
│  ┌──────────────┐                       │                 │
│  │ CLI subproc  │  Proto / RPC          │                 │
│  │ (sdk-commands│  (DataService)        │                 │
│  │  preview /   │◄──────────────────────┘                 │
│  │  deploy)     │                                         │
│  └──────────────┘                                         │
│                                                            │
│  Asset Packs CDN ◄─── S3 bucket (binary assets)           │
└────────────────────────────────────────────────────────────┘
```

### Electron IPC (creator-hub internal)

The renderer communicates with the main process through Electron's `ipcRenderer.invoke` / `ipcMain.handle` pattern. The preload script wraps every call in a typed function. Channels are namespaced by domain: `electron.*`, `updater.*`, `inspector.*`, `cli.*`, `config.*`, `bin.*`, `code.*`, `analytics.*`, and `npm.*`.

The type-safe IPC contract is defined in `shared/types/ipc.ts`. Both the main process handler registration (`main/src/modules/handle.ts`) and the preload invoke wrapper (`preload/src/services/ipc.ts`) use this shared type to ensure channel names and parameter types stay in sync at compile time.

### IFrame / postMessage (creator-hub to inspector)

The Creator Hub's `EditorPage` component renders the Inspector in an `<iframe>`. On load, it calls `initRpc()` to establish a bidirectional RPC channel using `@dcl/mini-rpc`'s `MessageTransport` over `postMessage`. This channel carries:

- **StorageRPC** — File read/write operations bridged to the local filesystem via the preload layer
- **SceneRpcClient** — UI control messages (scene metadata, entity operations)

The Inspector receives its configuration through URL query parameters: `dataLayerRpcParentUrl`, `binIndexJsUrl`, `contentUrl`, and analytics identifiers.

### Inspector transport modes

The Inspector's `connect` saga (`src/redux/data-layer/sagas/connect.ts`) selects between three transport modes based on URL query parameters:

```
┌─────────────────────────────────────────────────────┐
│                  Inspector App                      │
│                                                     │
│  connect saga checks URL params:                    │
│                                                     │
│  dataLayerRpcParentUrl? ──▶ IFrame transport        │
│    (postMessage to Creator Hub parent window)       │
│                                                     │
│  dataLayerRpcWsUrl? ──────▶ WebSocket transport     │
│    (connects to remote RPC server)                  │
│                                                     │
│  neither? ────────────────▶ Local transport         │
│    (in-memory engine + filesystem)                  │
└─────────────────────────────────────────────────────┘
```

1. **IFrame mode** (Creator Hub embedding): Uses `postMessage` to communicate with the parent window. File I/O flows through Creator Hub's preload bridge to the local filesystem.
2. **WebSocket mode** (remote/CLI): Connects to an `@dcl/rpc` server via WebSocket. Used by CLI tooling and external integrations.
3. **Local mode** (standalone): Creates an in-memory engine and local filesystem host. Useful for development without an Electron shell.

### CLI subprocess (main process to sdk-commands)

Scene preview and deployment run as child processes spawned by the main process. The `cli` module (`main/src/modules/cli.ts`) invokes `@dcl/sdk-commands` for scene initialization, preview, and deployment.

### HTTP / CDN (asset distribution)

Binary assets are distributed through two channels:

- **Local development:** The asset-packs dev server (`sdk-commands start --port 8001`) serves assets from the local `bin/` directory
- **Production:** Assets are uploaded to an S3 bucket and served through a CDN

## Build order

The build order mirrors the dependency graph. Each package must complete before the next starts:

```
make build
  └── build-asset-packs  (tsc + sdk-commands build + catalog generation)
  └── build-inspector    (esbuild browser bundle + Node.js tooling bundle)
  └── build-creator-hub  (Vite for main + preload + renderer)
```

## Development orchestration

The Creator Hub's `scripts/watch.js` starts multiple processes in sequence:

1. **Renderer dev server** — Vite on a dynamic port. Other watchers depend on its URL.
2. **TypeScript type checking** — Parallel `tsc --watch` for main, preload, and renderer.
3. **Preload watcher** — Triggers full page reload in Electron on preload changes.
4. **Main process watcher** — Kills and respawns Electron on main process changes.

The Inspector and asset packs each have their own watch modes (see their package READMEs).
