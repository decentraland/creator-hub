# AI Agent Context

## Service Purpose

The Decentraland Creator Hub Monorepo is a comprehensive ecosystem for creating, editing, and deploying 3D scenes for the Decentraland metaverse platform. It consists of three interdependent packages that provide a complete toolchain from asset management to scene deployment.

## Key Capabilities

- **Asset Management**: Curated collections of 3D assets (static items) and Smart Items (interactive objects with programmable behaviors) distributed via content-addressed storage
- **Visual Scene Editing**: Web-based 3D scene inspector with real-time editing, component manipulation, and Babylon.js-powered level editor
- **Desktop Application**: Cross-platform Electron app for creating, editing, and deploying Decentraland SDK7 scenes to Genesis City, Worlds, or custom servers
- **Content Distribution**: Automated CI/CD pipeline for multi-platform builds, asset uploads to CDN, and npm package publishing
- **Auto-Update System**: Electron-updater integration for seamless application updates across macOS and Windows platforms

## Communication Pattern

### Inspector ↔ CLI/Host

- **Protocol**: RPC over WebSocket or postMessage (IFrame)
- **Library**: `@dcl/mini-rpc`, `@dcl/rpc`
- **Data Format**: Protocol Buffers (`.proto` files)
- **Transport**: WebSocket for CLI integration, MessageTransport for web embedding

### Creator Hub ↔ Inspector

- **Protocol**: IFrame embedding with postMessage communication
- **Pattern**: Parent-child window communication with RPC handlers for file operations

### Asset Packs Distribution

- **Protocol**: HTTP/HTTPS
- **Pattern**: Content-addressed storage (S3 CDN)
- **Format**: Assets referenced by content hash in `catalog.json`

### Electron IPC

- **Protocol**: Electron IPC (Inter-Process Communication)
- **Pattern**: Main ↔ Preload ↔ Renderer communication for file system access and Node.js APIs

## Technology Stack

### Runtime & Language

- **Runtime**: Node.js 22.x
- **Language**: TypeScript 5.5.3
- **Module System**: ESM (ES Modules)

### Frameworks & Libraries

- **Desktop Framework**: Electron 37.3.1
- **UI Framework**: React 18.3.1
- **State Management**: Redux Toolkit 2.2.6, Redux Saga 1.2.3
- **3D Engine**: Babylon.js 8.7.0 (core, GUI, inspector, loaders, materials)
- **UI Components**: Decentraland UI 2 (0.23.1), VSCode Webview UI Toolkit

### Build & Development Tools

- **Build Tool**: Vite 4.x (main, preload, renderer)
- **Bundler (Inspector)**: esbuild 0.18.17
- **Electron Builder**: electron-builder 26.0.12
- **TypeScript Compiler**: tsc 5.5.3
- **Linting**: ESLint 8.57.0
- **Formatting**: Prettier 3.5.3
- **Testing**: Vitest 1.6.0, Playwright 1.45.0

### Monorepo Management

- **Package Manager**: npm (preferred over yarn)
- **Workspaces**: npm workspaces
- **Dependency Sync**: syncpack 13.0.4

### Decentraland SDK Integration

- **ECS**: @dcl/ecs 7.15.2
- **SDK Commands**: @dcl/sdk-commands 7.15.2
- **React ECS**: @dcl/react-ecs 7.15.2
- **JS Runtime**: @dcl/js-runtime 7.15.2
- **Schemas**: @dcl/schemas 11.10.4

### Communication & Serialization

- **RPC**: @dcl/mini-rpc, @dcl/rpc
- **Protocol Buffers**: @dcl/ts-proto 1.154.0 (protoc 21.12)
- **WebSocket**: Native WebSocket API

### Analytics & Monitoring

- **Analytics**: Segment (@segment/analytics-node 2.1.2)
- **Error Tracking**: Sentry (@sentry/electron 6.1.0, @sentry/react 9.5.0)

### Web3 & Blockchain

- **Wallet Connect**: decentraland-connect 7.1.0
- **Crypto**: ethereum-cryptography 2.1.2
- **Hashing**: @ethersproject/hash 5.7.0, @dcl/hashing 3.0.4

## External Dependencies

### Content Delivery Network (CDN)

- **Production CDN**: `https://builder-items.decentraland.org/contents/:hash`
  - Purpose: Serve production asset-packs content (3D models, textures, Smart Items)
  - Backed by: S3 bucket with Cloudflare
  - Upload Trigger: Automatic on merge to `main` branch
- **Development CDN**: `https://builder-items.decentraland.zone/contents/:hash`
  - Purpose: Serve development/staging asset-packs content
  - Upload Trigger: Manual via `/upload-assets` PR comment (org members only)

### npm Registry

- **Registry**: https://registry.npmjs.org
- **Published Packages**:
  - `@dcl/asset-packs` - Asset packs and Smart Items runtime
  - `@dcl/inspector` - Scene inspector web application
- **Publishing**: Automatic on `main` branch merges, manual PR testing via S3

### GitHub

- **Repository**: https://github.com/decentraland/creator-hub
- **Release Distribution**: GitHub Releases for Creator Hub desktop app installers
- **Auto-Update**: electron-updater fetches updates from GitHub Releases

### AWS S3

- **SDK Team Bucket**: Temporary artifact storage for PR builds and branch previews
- **Builder Items Bucket**: Production and development asset storage
- **Regions**: us-east-1

### Protocol Buffers Compiler

- **Version**: 21.12
- **Source**: https://github.com/protocolbuffers/protobuf/releases
- **Installation**: Automated via Makefile (`make install-protoc`)
- **Purpose**: Generate TypeScript definitions from `.proto` files for data layer communication

### Code Signing Services

- **macOS**: Apple notarization service (requires Apple ID, Team ID, App-Specific Password)
- **Windows**: SSL.com eSigner (requires credential ID, TOTP secret)

## Key Concepts

### Monorepo Architecture

- **Package Isolation**: Each package (`asset-packs`, `inspector`, `creator-hub`) can be developed and tested independently
- **Dependency Chain**: asset-packs → inspector → creator-hub (each depends on the previous)
- **Build Order**: Must build in dependency order during CI/CD
- **Version Management**: Each package has independent semantic versioning based on commit messages in its path

### Asset Packs & Smart Items

- **Asset Pack**: A curated collection of themed 3D assets (e.g., cyberpunk, steampunk, genesis_city)
- **Static Item**: A 3D model with textures and materials, no interactive behavior
- **Smart Item**: An interactive item with configurable parameters and programmable behaviors (e.g., door, video player, trigger area)
- **catalog.json**: Central registry containing all asset packs metadata and content hashes
- **bin/index.js**: SDK7 runtime required for Smart Items to execute behaviors in scenes
- **Content Addressing**: Assets are referenced by content hash, ensuring immutability and cache correctness

### Inspector Data Layer

- **RPC Communication**: Inspector communicates with CLI or host application via RPC protocol
- **Protocol Buffers**: Data structures defined in `data-layer.proto`, compiled to TypeScript
- **CRDT State**: Scene state managed using Conflict-free Replicated Data Types for real-time synchronization
- **WebSocket Transport**: For CLI integration (`@dcl/sdk-commands start --data-layer`)
- **MessageTransport**: For IFrame embedding in web applications
- **File Operations**: Host application provides file system access via RPC handlers (`read_file`, `write_file`, etc.)

### Creator Hub Architecture

- **Three-Process Model**:
  - **Main Process**: Node.js process, Electron APIs, process forking for CLI commands
  - **Preload Process**: Sandboxed context with limited Node.js APIs (fs, path, crypto)
  - **Renderer Process**: Chromium browser, React application, no direct Node.js access
- **IPC Communication**: Main ↔ Preload ↔ Renderer via Electron's IPC mechanism
- **Binary Management**: Electron binary acts as Node.js runtime, npm installed unpacked from `.asar`
- **Auto-Expose**: `unplugin-auto-expose` automatically wires preload exports to renderer via `#preload` import

### Semantic Versioning Strategy

- **Version Calculation**: Uses `paulhatch/semantic-version` action
- **Commit Patterns**:
  - Major: `/^(major|breaking).+/`
  - Minor: `/^(minor|feat).+/`
  - Patch: `/^(patch|fix).+/`
- **Tag Prefixes**:
  - Asset Packs: `@dcl/asset-packs@`
  - Inspector: `@dcl/inspector@`
  - Creator Hub: no prefix (just version number)
- **Change Detection**: Only builds if files in package path have changed

### Release & Distribution Strategy

- **Pre-releases**: All GitHub releases are created as pre-releases initially
- **Creator Hub Updates**: Only "latest" releases are picked up by electron-updater
- **Package Releases**: asset-packs and inspector remain pre-releases to prevent auto-update confusion
- **Manual Promotion**: Edit pre-release and mark as "latest" to trigger auto-update for desktop app

### Protocol Buffers Workflow

- **Definition**: `.proto` files in `packages/inspector/src/lib/data-layer/proto/`
- **Generation**: `make protoc` generates TypeScript in `proto/gen/` directory
- **Plugin**: Uses `@dcl/ts-proto` for code generation
- **Options**: ES module interop, union oneofs, Map type support
- **When to Regenerate**: After any `.proto` file modification

### Dependency Synchronization

- **syncpack Configuration**: `.syncpackrc.json` defines version group policies
- **SDK Dependencies**: `@dcl/ecs`, `@dcl/sdk`, `@dcl/sdk-commands`, etc. must stay in sync across packages
- **Inspector Exception**: `@dcl/inspector` excluded from sync checks (local file dependency)
- **Peer Dependencies**: `@dcl/ecs` intentionally omitted from `@dcl/asset-packs` to prevent version conflicts

### Testing Strategy

- **Unit Tests**: Vitest for packages/creator-hub (main, preload, renderer, shared) and packages/inspector
- **E2E Tests**: Playwright for both Inspector and Creator Hub
- **Test Environments**: happy-dom for JSDOM-like testing without browser
- **Pre-Build Requirement**: E2E tests automatically build applications before running
- **CI Testing**: Runs on Ubuntu (unit), macOS and Windows (E2E)

## Database Notes

This project does not use a traditional database. Instead, it uses:

### File System Storage

- **Scene Files**: Decentraland scenes stored on user's local file system (Creator Hub manages these via Node.js fs module)
- **Project Metadata**: Scene configuration in `scene.json`, entity definitions in TypeScript/JavaScript
- **Asset Cache**: Downloaded assets cached locally to reduce CDN requests

### Content-Addressed Storage (S3)

- **Asset Storage**: All 3D models, textures, and Smart Items stored in S3 buckets
- **Content Hashing**: Files referenced by SHA-256 hash, ensuring immutability
- **Catalog Index**: `catalog.json` maps human-readable names to content hashes
- **Cache Strategy**: Content hashes enable permanent browser/CDN caching

### State Management (In-Memory)

- **Redux Store**: Application state managed in Redux (Creator Hub, Inspector)
- **CRDT**: Scene state synchronized using CRDT protocol between Inspector and CLI
- **Session Storage**: Temporary data stored in browser sessionStorage/localStorage

## Development Workflow Notes

### Initial Setup

- **Command**: `make init`
- **Steps**: Clean → Install dependencies → Install protoc → Generate proto files → Build all packages
- **Duration**: ~5-10 minutes on first run

### Local Development with Full Stack

1. **Asset Packs**: `cd packages/asset-packs && npm start` (SDK7 dev server on port 8001)
2. **Content Server**: `cd packages/asset-packs && docker-compose up` (port 9000)
3. **Upload Assets**: `cd packages/asset-packs && npm run upload` (to local content server)
4. **Inspector**: `cd packages/inspector && npm start` (port 8000)
5. **Creator Hub**: Configure `.env` with local URLs, then `npm start` (port 3000)

### Environment Variables (Creator Hub)

- `VITE_INSPECTOR_PORT`: Local inspector dev server port (default: 8000)
- `VITE_ASSET_PACKS_CONTENT_URL`: Content server URL (local: http://localhost:9000/asset-packs)
- `VITE_ASSET_PACKS_JS_PORT`: SDK7 dev server port (default: 8001)
- `VITE_ASSET_PACKS_JS_PATH`: Absolute path to `bin/index.js` for Smart Items runtime
- `VITE_SEGMENT_*_API_KEY`: Analytics keys (optional in development)
- `VITE_SENTRY_DSN`: Error tracking DSN (optional in development)

### Code Quality Commands

- **Lint**: `make lint` (check only), `make lint-fix` (auto-fix)
- **Format**: `npm run format` (check), `npm run format:fix` (auto-fix)
- **Typecheck**: `make typecheck` (all packages)
- **Test**: `make test` (unit tests), `make test-e2e` (E2E tests)

### Common Gotchas

- **Protoc Not Found**: Run `make install-protoc` if proto generation fails
- **Asset Pack Dependency**: Inspector build fails if asset-packs not built first
- **ASAR Extraction**: Some binaries (npm) must be unpacked from ASAR for Creator Hub to work
- **Code Signing**: Windows signing requires esigner-codesign repo checkout during CI
- **macOS Notarization**: Requires Apple Team ID, App-Specific Password, and can take 5-15 minutes

### Debugging

- **Browser DevTools**: Available in Creator Hub via View → DevTools
- **Node Logs**: Creator Hub main process logs to:
  - macOS: `~/Library/Logs/creator-hub/main.log`
  - Windows: `%APPDATA%\creator-hub\logs\main.log`
- **WebSocket Inspection**: Chrome DevTools → Network → WS tab
- **RPC Debugging**: Enable console logging for `@dcl/mini-rpc` messages

### CI/CD Workflow

- **Trigger**: Push to `main` or pull request (except markdown/config changes)
- **Steps**: Lint → Typecheck → Tests → Drop Pre-release → Asset Packs → Inspector → Creator Hub
- **Parallelization**: Asset packs builds before inspector, inspector builds before creator-hub
- **Artifacts**: S3 upload for PR testing, GitHub releases for `main` branch
- **Manual Uploads**: Comment `/upload-assets` on PR to trigger dev CDN upload (org members only)

### Asset Pack Development

- **Validation**: `make validate-asset-packs` checks all assets for errors
- **Catalog Generation**: `npm run build:catalog` creates `catalog.json` from pack definitions
- **SDK7 Scene**: `npm run build:js` compiles Smart Items to `bin/index.js`
- **Library Build**: `npm run build:lib` compiles TypeScript definitions for npm package

### Inspector Development

- **Standalone**: Can be developed without Creator Hub using CLI WebSocket integration
- **Hot Reload**: `npm start` watches and rebuilds on file changes
- **Testing**: Component tests with React Testing Library, E2E with Playwright
- **Preview**: Each PR gets a GitHub Pages preview at `https://decentraland.github.io/creator-hub/inspector/:branch`

### Creator Hub Development

- **Watch Mode**: `npm run watch` (starts all three processes with hot reload)
- **Building**: `npm run build` (builds main, preload, renderer separately)
- **Compilation**: `npm run compile` (creates distributable .app/.exe)
- **Testing**: Local testing requires `xattr -c` on macOS to bypass Gatekeeper

### External DevTools Integration (Unity CDP)

**Problem**: The Creator Hub needs to open Chrome DevTools connected to an external CDP (Chrome DevTools Protocol) server exposed by Unity. Electron's built-in `devtools://devtools/bundled/inspector.html?ws=...` URL loads but shows a blank page due to Chromium security restrictions in recent versions that prevent the internal `devtools://` protocol from connecting to external WebSocket endpoints.

**Solution**: Bundle a standalone DevTools frontend from [devtools-remote-debugger](https://github.com/Nice-PLQ/devtools-remote-debugger) as an extraResource, managed as a git submodule.

**Implementation**:

- DevTools frontend is stored in `packages/creator-hub/devtools-frontend/` as a **git submodule**
- Source repository: [decentraland/devtools-frontend](https://github.com/decentraland/devtools-frontend) (private)
- Bundled via `extraResources` in electron-builder (avoids asar path length issues)
- Loaded via `file://` protocol with WebSocket parameter
- Triggered by `--open-devtools-with-port=<port>` command line argument

**Files**:

- `main/src/modules/app-args-handle.ts` - Handles arg parsing and window creation
- `electron-builder.cjs` - extraResources configuration
- `devtools-frontend/README.md` - Detailed problem/solution documentation

**Submodule Management**:

- Initialize submodule: `git submodule update --init --recursive` (or `make init-submodules`)
- Update submodule: `cd packages/creator-hub/devtools-frontend && git pull origin main`
- CI workflows automatically checkout submodules via `submodules: true` in actions/checkout

**Why a git submodule instead of npm package or direct commit?**

- **Keeps main repo lean**: The devtools-frontend folder contains ~25MB of static assets
- **Version control**: Changes to devtools-frontend are tracked in its own repository
- **CI compatibility**: GitHub Actions supports submodules natively with `submodules: true`
- **Building from source is impractical**: The official Chrome DevTools frontend requires the full Chromium toolchain

## Related Architecture Decisions

For deeper understanding of design decisions and technical architecture:

- **ADR-280: Binary Management** - https://adr.decentraland.org/adr/ADR-280

  - Describes approach for managing Node.js binaries and their execution within Creator Hub
  - Covers cross-platform binary execution, process monitoring, and ASAR unpacking strategy

- **ADR-281: Items in Decentraland tooling** - https://adr.decentraland.org/adr/ADR-281

  - Explains the Items abstraction (Static Items, Smart Items, Custom Items)
  - Technical implementation details for asset packs and item behaviors

- **ADR-282: Decentraland Inspector** - https://adr.decentraland.org/adr/ADR-282
  - Details the Inspector's architecture, component structure, and integration approaches
  - WebSocket vs IFrame integration patterns, RPC protocol design

## Repository Structure Quick Reference

```
creator-hub/
├── packages/
│   ├── asset-packs/              # Asset packs and Smart Items
│   │   ├── packs/               # Asset pack definitions (cyberpunk, genesis_city, etc.)
│   │   ├── src/                 # TypeScript library source
│   │   ├── scripts/             # Build and upload scripts
│   │   ├── bin/                 # Built SDK7 runtime (index.js)
│   │   ├── dist/                # Built library output
│   │   └── catalog.json         # Generated asset catalog
│   ├── inspector/                # Web-based 3D scene inspector
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   ├── lib/
│   │   │   │   ├── babylon/    # Babylon.js integration
│   │   │   │   ├── data-layer/ # Protocol Buffers RPC
│   │   │   │   ├── sdk/        # SDK7 integration
│   │   │   │   └── rpc/        # RPC transport layer
│   │   │   └── types/          # TypeScript definitions
│   │   ├── public/              # Built web application
│   │   └── test/e2e/           # Playwright E2E tests
│   └── creator-hub/              # Electron desktop application
│       ├── main/                # Main process (Node.js/Electron)
│       ├── preload/             # Preload scripts (sandboxed Node.js)
│       ├── renderer/            # Renderer process (React web app)
│       ├── shared/              # Shared utilities
│       ├── devtools-frontend/   # Bundled DevTools frontend for Unity CDP debugging
│       ├── e2e/                 # Playwright E2E tests
│       ├── buildResources/      # App icons and installers
│       └── electron-builder.cjs # Build configuration
├── .github/workflows/           # CI/CD workflows
│   ├── ci.yml                  # Main orchestrator
│   ├── asset-packs.yml         # Asset packs build/publish
│   ├── inspector.yml           # Inspector build/publish
│   ├── creator-hub.yml         # Desktop app build/publish
│   ├── tests.yml               # Test runner
│   └── lint.yml                # Linting
├── Makefile                     # Build and development commands
├── package.json                # Root package (workspaces config)
└── .syncpackrc.json            # Dependency sync configuration
```

## Common Tasks Reference

| Task | Command | Notes |
| --- | --- | --- |
| Initial setup | `make init` | Clean, install, protoc, build all |
| Install dependencies | `make install-all` | All packages |
| Build all | `make build` | Builds in correct order |
| Build asset-packs | `make build-asset-packs` | SDK7 + library + catalog |
| Build inspector | `make build-inspector` | Requires asset-packs |
| Build creator-hub | `make build-creator-hub` | Requires inspector |
| Start development | `cd packages/creator-hub && npm start` | Watch mode |
| Run tests | `make test` | Unit tests all packages |
| Run E2E tests | `make test-e2e` | Inspector + Creator Hub |
| Lint code | `make lint` | Check only |
| Fix linting | `make lint-fix` | Auto-fix issues |
| Format code | `npm run format:fix` | Prettier |
| Type check | `make typecheck` | All packages |
| Sync dependencies | `make sync-deps` | syncpack |
| Generate proto files | `make protoc` | After .proto changes |
| Validate assets | `make validate-asset-packs` | Check asset integrity |
| Upload assets | `make upload-asset-packs` | To configured S3 |
| Clean build artifacts | `make clean` | Remove dist folders |
| Deep clean | `make deep-clean` | Remove node_modules too |
