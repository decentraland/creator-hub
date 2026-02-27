# @dcl/inspector

[![npm version](https://img.shields.io/npm/v/@dcl/inspector.svg)](https://www.npmjs.com/package/@dcl/inspector)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI Status](https://github.com/decentraland/creator-hub/workflows/Inspector/badge.svg)](https://github.com/decentraland/creator-hub/actions/workflows/inspector.yml)

A React-based scene editor interface for Decentraland, providing a modular architecture for scene editing and manipulation.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Local Development with Asset Packs](#local-development-with-asset-packs)
- [Integration](#integration)
  - [WebSocket Integration](#websocket-integration)
  - [IFrame Integration](#iframe-integration)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
- [Development Tips](#development-tips)
- [Dependencies](#dependencies)
- [Related Architecture Decisions](#related-architecture-decisions)
- [License](#license)

## Features

- **Entity Hierarchy**: Tree-based scene management with component operations
- **Component Inspector**: Specialized editors for all component types
- **Level Editor**: 3D scene visualization with Babylon.js
- **Asset Management**: Local assets, custom items, and asset packs support (via `@dcl/asset-packs`)

## Quick Start

### Prerequisites

- **Node.js** 22.x or higher
- **A Decentraland SDK7 scene** (or create one with `npx @dcl/sdk-commands init`)
- **Basic understanding** of WebSockets or IFrame communication

### Getting Started

1. Start the CLI server:

```bash
npx @dcl/sdk-commands start --data-layer --port 8001
```

2. Serve the inspector (choose one method):

```bash
# Method 1: Development server (from monorepo)
git clone https://github.com/decentraland/creator-hub.git
cd creator-hub
make init
cd packages/inspector
npm start

# Method 2: From node_modules
npm install @dcl/inspector
npx http-server node_modules/@dcl/inspector/public
```

3. Access the Inspector:

```
http://localhost:8000/?dataLayerRpcWsUrl=ws://127.0.0.1:8001/data-layer
```

Where `http://localhost:8000` is the URL of the Inspector and `ws://127.0.0.1:8001/data-layer` is the WebSocket URL of the CLI server.

## Local Development with Asset Packs

To develop the Inspector with local asset-packs integration:

1. **Start the asset-packs dev environment:**
   ```bash
   cd packages/asset-packs
   npm run start  # Starts SDK7 server on port 8001
   ```

2. **In another terminal, start the docker content server:**
   ```bash
   cd packages/asset-packs
   docker-compose up  # Starts content server on port 9000
   ```

3. **In another terminal, upload assets to local content server:**
   ```bash
   cd packages/asset-packs
   npm run upload  # Uploads to http://localhost:9000
   ```

4. **Start the Inspector dev server:**
   ```bash
   cd packages/inspector
   npm start  # Starts on port 8000
   ```

5. **Configure the Inspector to use local asset-packs:**

   Access the Inspector with these parameters:
   ```
   http://localhost:8000/?contentUrl=http://localhost:9000/asset-packs&binIndexJsUrl=http://localhost:8001/bin/index.js
   ```

   - `contentUrl`: Points to local content server for asset loading
   - `binIndexJsUrl`: Points to local SDK7 dev server for Smart Items runtime

See the [main README](../../README.md) for complete local development setup instructions.

### Testing New Assets Locally

The inspector fetches the asset catalog at runtime from S3. If `latest/catalog.json` is unreachable (e.g. on a pre-merge PR branch, in CI, or offline), it automatically falls back to the `catalog.json` bundled in the `@dcl/asset-packs` npm package — so the inspector always loads.

When you add a **new** asset locally it won't appear in the Asset Packs tab automatically because neither the CDN nor the bundled catalog knows about it yet. Two options are available:

#### Option 1 — Docker (full local stack, recommended)

Follow the asset-packs [Local Development](../asset-packs/README.md#local-development) setup (docker-compose + `npm run upload`). The upload script also publishes `catalog.json` as `asset-packs/latest/catalog.json` to MinIO, mirroring CI. Then open the inspector with:

```
http://localhost:8000/?contentUrl=http://localhost:9000/asset-packs
```

Both the catalog and all asset files are served locally — no remote CDN needed.

#### Option 2 — Upload to dev CDN via PR

Push your branch and comment `/upload-assets` on the pull request (org members only). The CI uploads all asset files to the development CDN (`https://builder-items.decentraland.zone`) and posts a confirmation comment.

To test against the dev CDN:

```
http://localhost:8000/?contentUrl=https://builder-items.decentraland.zone
```

This gives a complete end-to-end test with real asset files. Note that `latest/catalog.json` on the dev CDN is only updated on merge to `main`, so use the Docker option to see catalog changes before merging.

## Integration

The Inspector supports two integration approaches:

### WebSocket Integration

For development environments using the CLI:

```typescript
// Connect to CLI's WebSocket server
const inspectorUrl = `http://localhost:3000/?dataLayerRpcWsUrl=ws://127.0.0.1:8001/data-layer`
```

### IFrame Integration

For web applications embedding the Inspector:

```typescript
function initRpc(iframe: HTMLIFrameElement) {
  const transport = new MessageTransport(window, iframe.contentWindow!)
  const storage = new StorageRPC(transport)

  // Handle file operations
  storage.handle('read_file', async ({ path }) => {
    return fs.readFile(path)
  })

  storage.handle('write_file', async ({ path, content }) => {
    await fs.writeFile(path, content)
  })

  // ... other handlers

  return {
    storage,
    dispose: () => storage.dispose()
  }
}

function InspectorComponent() {
  const iframeRef = useRef()

  const handleIframeRef = useCallback((iframe) => {
    if (iframe) {
      iframeRef.current = initRpc(iframe)
    }
  }, [])

  useEffect(() => {
    return () => iframeRef.current?.dispose()
  }, [])

  const params = new URLSearchParams({
    dataLayerRpcParentUrl: window.location.origin
  })
  const inspectorUrl = `http://localhost:3000/`
  const url = `${inspectorUrl}?${params}`

  return <iframe onLoad={handleIframeRef} src={url} />
}
```

## Configuration

Configure the Inspector through URL parameters or a global object. All configuration options can be set using either method:

```typescript
type InspectorConfig = {
  // Data Layer Configuration
  dataLayerRpcWsUrl: string | null // ?dataLayerRpcWsUrl=ws://...
  dataLayerRpcParentUrl: string | null // ?dataLayerRpcParentUrl=https://...

  // Smart Items Configuration
  binIndexJsUrl: string | null // ?binIndexJsUrl=https://...
  disableSmartItems: boolean // ?disableSmartItems=true

  // Content Configuration
  contentUrl: string // ?contentUrl=https://...

  // Analytics Configuration
  segmentKey: string | null // ?segmentKey=...
  segmentAppId: string | null // ?segmentAppId=...
  segmentUserId: string | null // ?segmentUserId=...
  projectId: string | null // ?projectId=...
}

// Method 1: Global configuration
globalThis.InspectorConfig = {
  dataLayerRpcWsUrl: 'ws://127.0.0.1:8001/data-layer',
  contentUrl: 'https://builder-items.decentraland.org'
}

// Method 2: URL parameters
// http://localhost:3000/?dataLayerRpcWsUrl=ws://127.0.0.1:8001/data-layer&contentUrl=https://builder-items.decentraland.org&disableSmartItems=true
```

Configuration options are resolved in the following order:

1. URL parameters (highest priority)
2. Global object
3. Default values (lowest priority)

## Testing

Run all inspector tests:

```bash
make test-inspector
```

Run specific test files in watch mode:

```bash
make test-inspector FILES="--watch packages/@dcl/inspector/src/path/to/some-test.spec.ts"
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection**

   - Verify CLI server is running with `--data-layer` flag
   - Check WebSocket URL matches CLI server port
   - Ensure no firewall blocking connection

2. **File System Access**

   - Check file permissions
   - Verify CLI has necessary access rights
   - Ensure paths are correctly formatted

3. **Asset Loading**
   - Verify `contentUrl` is correctly configured
   - Check network access to content server
   - Ensure asset paths are valid

## Development Tips

1. **Debugging**

   - Use Chrome DevTools for WebSocket inspection
   - Enable React DevTools
   - Monitor browser console for RPC messages

2. **Testing**
   - Use in-memory implementation for unit tests
   - Mock RPC calls for integration testing
   - Test both WebSocket and IFrame transport

## Dependencies

The Inspector is part of the [Creator Hub monorepo](../..) and depends on:

- **`@dcl/asset-packs`** - Asset packs and Smart Items runtime (located at `packages/asset-packs`)

For local development with asset-packs integration, see the [main README](../../README.md) for setup instructions.

## Related Architecture Decisions

For a deeper understanding of the architecture and design decisions:

- [ADR-281: Items in Decentraland tooling](https://adr.decentraland.org/adr/ADR-281) - Explains the Items abstraction and how it's used in the Inspector
- [ADR-282: Decentraland Inspector](https://adr.decentraland.org/adr/ADR-282) - Details the Inspector's architecture, integration approaches, and technical decisions

## License

Apache 2.0
