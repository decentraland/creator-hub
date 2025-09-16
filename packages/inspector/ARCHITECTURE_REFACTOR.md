# Inspector Architecture Refactor: Inverted RPC with Unified Frontend Engine

## Executive Summary

This document outlines a proposed architectural refactor for the Decentraland Inspector, moving from a complex 3-engine synchronization model to a simplified 2-engine architecture with inverted RPC responsibilities. The key insight is to maintain the proven CRDT synchronization mechanism while reducing engine complexity and simplifying the RPC interface by having the frontend define what it needs rather than the backend exposing complex data layer methods.

## Current Architecture Analysis

### Overview

The current system employs three separate `@dcl/ecs` engines with complex RPC communication:

1. **Inspector Engine** (Frontend) - Entity inspection and editing
2. **Renderer Engine** (Frontend) - 3D rendering via Babylon.js
3. **Data Layer Engine** (Backend) - File system access, orchestration, and persistence

### Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Process                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Inspector Engine│    │     Renderer Engine            │ │
│  │   (ui)          │    │   (Babylon.js Rendering)       │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│           │                           │                    │
│           └───────────┬───────────────┘                    │
│                       │ CRDT Streaming                     │
│                       ▼                                    │
├─────────────────────────────────────────────────────────────┤
│                RPC Transport Layer                          │
│    ┌─────────────────────────────────────────────────────┐  │
│    │  Backend Defines Interface:                         │  │
│    │  ├─ crdtStream(AsyncIterable<CrdtStreamMessage>)    │  │
│    │  ├─ getFiles(GetFilesRequest)                       │  │
│    │  ├─ saveFile(SaveFileRequest)                       │  │
│    │  ├─ getAssetCatalog()                               │  │
│    │  ├─ undo() / redo()                                 │  │
│    │  ├─ importAsset(ImportAssetRequest)                 │  │
│    │  └─ ... 20+ methods via protobuf                    │  │
│    └─────────────────────────────────────────────────────┘  │
│           (WebSocket/iframe/local transport modes)          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Process                           │
├─────────────────────────────────────────────────────────────┤
│              Data Layer Engine                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │  File System    │ │   Undo/Redo     │ │ Asset Catalog│  │
│  │    Manager      │ │    Manager      │ │   Manager    │  │
│  │                 │ │                 │ │              │  │
│  │ dumpEngineAnd   │ │ addUndoCrdt()   │ │ getFilesIn   │  │
│  │ GetComposite()  │ │ undo()/redo()   │ │ Directory()  │  │
│  └─────────────────┘ └─────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Code Examples from Current Implementation

**Engine Connection and CRDT Streaming:**
```typescript
// From src/redux/sdk/sagas/connect-stream.ts
export function* connectStream() {
  const engines: ReturnType<typeof selectEngines> = yield select(selectEngines);
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);

  if (!dataLayer || !engines.inspector || !engines.renderer) return;

  // Both frontend engines connect to backend via CRDT streaming
  yield call(connectCrdtToEngine, engines.inspector, dataLayer.crdtStream, 'Inspector');
  yield call(connectCrdtToEngine, engines.renderer, dataLayer.crdtStream, 'Renderer');
}
```

**Complex CRDT Transport Setup:**
```typescript
// From src/lib/sdk/connect-stream.ts
export function connectCrdtToEngine(
  engine: IEngine,
  dataLayerStream: DataLayerRpcClient['crdtStream'],
  engineKey: string,
) {
  // Complex async queue and transport setup
  const outgoingMessagesStream = new AsyncQueue<CrdtStreamMessage>();
  const transport: Transport = {
    filter() { return !outgoingMessagesStream.closed; },
    async send(message: Uint8Array) {
      if (outgoingMessagesStream.closed) return;
      outgoingMessagesStream.enqueue({ data: message });
    },
  };

  engine.addTransport(transport);
  consumeAllMessagesInto(dataLayerStream(outgoingMessagesStream), onMessage);
}
```

**Backend Defines Complex RPC Interface:**
```typescript
// From src/lib/data-layer/proto/gen/data-layer.gen.ts
export const DataServiceDefinition = {
  name: "DataService",
  methods: {
    crdtStream: { /* Complex bidirectional streaming */ },
    undo: { /* Undo operation */ },
    redo: { /* Redo operation */ },
    getFiles: { /* File retrieval */ },
    saveFile: { /* File saving */ },
    getAssetCatalog: { /* Asset management */ },
    importAsset: { /* Asset import */ },
    removeAsset: { /* Asset removal */ },
    // ... 20+ more methods
  },
};
```

**Current Backend Engine with Persistence:**
```typescript
// From src/lib/data-layer/host/utils/composite-dirty.ts
async function dumpEngineAndGetComposite(dump: boolean = true): Promise<CompositeDefinition | null> {
  // Backend engine serializes its state to composite
  composite = dumpEngineToComposite(engine, 'json');

  if (!dump) return composite;

  // Multiple file operations for persistence
  const mainCrdt = dumpEngineToCrdtCommands(engine);
  await fs.writeFile('main.crdt', Buffer.from(mainCrdt));
  await compositeProvider.save({ src: compositePath, composite }, 'json');
  await generateEntityNamesType(engine, withAssetDir(DIRECTORY.SCENE + '/entity-names.ts'), 'EntityNames');

  return composite;
}
```

### Current Connection Modes Analysis

The current system supports three deployment modes via `src/redux/data-layer/sagas/connect.ts`:

```typescript
export function* connectSaga() {
  const config: InspectorConfig = yield call(getConfig);

  if (!config.dataLayerRpcWsUrl) {
    if (!config.dataLayerRpcParentUrl) {
      // LOCAL MODE: Backend runs in same process
      const dataLayer: IDataLayer = yield call(createLocalDataLayerRpcClient);
      yield put(connected({ dataLayer }));
    } else {
      // IFRAME MODE: Backend runs in parent window
      const dataLayer: IDataLayer = yield call(
        createIframeDataLayerRpcClient,
        config.dataLayerRpcParentUrl,
      );
      yield put(connected({ dataLayer }));
    }
  } else {
    // WEBSOCKET MODE: Backend runs on remote server
    const ws: WebSocket = yield call(createWebSocketConnection, config.dataLayerRpcWsUrl);
    // ... complex WebSocket RPC setup
    const dataLayer: DataLayerRpcClient = codegen.loadService<
      { engine: IEngine },
      DataServiceDefinition
    >(clientPort, DataServiceDefinition);
    yield put(connected({ dataLayer }));
  }
}
```

### Identified Issues with Current Architecture

#### 1. **Three-Engine Synchronization Complexity**
- Multiple engines maintaining separate but synchronized state
- Complex CRDT message streaming coordination
- Difficult debugging when engines fall out of sync

#### 2. **Backend-Driven Complex RPC Interface**
- Backend defines 20+ complex methods via protobuf
- Frontend must implement complex transport layers
- Tight coupling between frontend and backend contracts

#### 3. **Transport Layer Complexity**
```typescript
// Complex multi-layer transport setup
const clientTransport: Transport = yield call(WebSocketTransport, ws);
const client: RpcClient = yield call(createRpcClient, clientTransport);
const clientPort: RpcClientPort = yield call(client.createPort, 'scene-ctx');
```

#### 4. **Protobuf Code Generation Overhead**
- Requires maintaining `.proto` definitions
- Code generation step in build process
- Type safety issues between protobuf and TypeScript

#### 5. **Error Recovery Complexity**
```typescript
// From src/redux/data-layer/sagas/reconnect.ts
export function* reconnectSaga() {
  const reconnectAttempts: number = yield select(selectDataLayerReconnectAttempts);

  if (reconnectAttempts >= MAX_RETRY_TIMES) {
    yield put(error({ error: ErrorType.Disconnected }));
    return;
  }
  yield delay(RECONNECT_TIMEOUT * reconnectAttempts);
  yield put(connect());
}
```

## Proposed Architecture: Inverted RPC Responsibility

### Core Innovation: Frontend Defines What It Needs

Instead of the backend exposing complex data layer methods, the **frontend defines a simple filesystem interface** that any backend can implement.

### New Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Process                        │
├─────────────────────────────────────────────────────────────┤
│              Single Unified Engine                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  @dcl/ecs Engine (Inspector + Renderer Combined)       │ │
│  │  ├─ Entity Management                                  │ │
│  │  ├─ Component Systems                                  │ │
│  │  ├─ Inspector Integration                              │ │
│  │  └─ Babylon.js Renderer Integration                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                             │                               │
│                             │ CRDT Streaming                │
│                             │ (Proven, Efficient)           │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │     Frontend Defines Simple RPC Interface:             │ │
│  │     ├─ readFile(path: string): Promise<Buffer>         │ │
│  │     ├─ writeFile(path: string, content: Buffer)        │ │
│  │     ├─ exists(path: string): Promise<boolean>          │ │
│  │     ├─ listFiles(path: string): Promise<string[]>      │ │
│  │     └─ deleteFile(path: string): Promise<void>         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         │
          Simple Interface (No Protobuf Needed)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Process                          │
├─────────────────────────────────────────────────────────────┤
│           Backend Engine + RPC Implementation              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  @dcl/ecs Engine (State Persistence)                   │ │
│  │  ├─ Loads initial state from composite                 │ │
│  │  ├─ Syncs with frontend via CRDT                       │ │
│  │  ├─ Handles dumpEngineAndGetComposite()                │ │
│  │  └─ Manages undo/redo state                            │ │
│  └─────────────────────────────────────────────────────────┘ │
│                             │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │     Implements Frontend's Simple Interface:            │ │
│  │     ├─ readFile() → fs.readFile()                      │ │
│  │     ├─ writeFile() → fs.writeFile() + engine sync      │ │
│  │     ├─ exists() → fs.exists()                          │ │
│  │     ├─ listFiles() → fs.readdir()                      │ │
│  │     └─ deleteFile() → fs.unlink()                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                             │                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                File System                              │ │
│  │  ├─ main.composite (Generated by engine)               │ │
│  │  ├─ main.crdt (Generated by engine)                    │ │
│  │  ├─ scene.json (Scene metadata)                        │ │
│  │  └─ assets/ (Asset files)                              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Changes

#### 1. **Unified Frontend Engine**
Merge the inspector and renderer engines into a single engine:

```typescript
// Before: Two separate engines
const inspectorEngine = createInspectorEngine()
const rendererEngine = createRendererEngine()

// After: Single unified engine
const unifiedEngine = createEngine()
unifiedEngine.addSystem(inspectorSystem)    // Entity management
unifiedEngine.addSystem(rendererSystem)     // Babylon.js integration
unifiedEngine.addSystem(gizmoSystem)        // Editor tools
```

#### 2. **Inverted RPC Responsibility**
Frontend defines what it needs, backend implements:

```typescript
// Frontend defines interface (no protobuf needed)
interface FilesystemRpc {
  readFile(path: string): Promise<Buffer>
  writeFile(path: string, content: Buffer): Promise<void>
  exists(path: string): Promise<boolean>
  listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]>
  deleteFile(path: string): Promise<void>
}

// Backend implements what frontend needs
class LocalFilesystemRpc implements FilesystemRpc {
  async readFile(path: string): Promise<Buffer> {
    return await fs.readFile(path)
  }

  async writeFile(path: string, content: Buffer): Promise<void> {
    await fs.writeFile(path, content)
    // If composite file changed, sync with backend engine
    if (path.includes('composite') || path.includes('crdt')) {
      await this.syncEngineFromFile(path)
    }
  }
}
```

#### 3. **Maintain CRDT Synchronization**
Keep the proven CRDT mechanism for engine synchronization:

```typescript
// Frontend engine setup
class UnifiedEngine {
  constructor(private filesystem: FilesystemRpc) {
    this.engine = createEngine()
    this.setupCrdtConnection()
  }

  private async setupCrdtConnection() {
    // Load initial state from backend
    const initialComposite = await this.filesystem.readFile('main.composite')
    this.loadCompositeIntoEngine(initialComposite)

    // Setup bidirectional CRDT streaming (existing mechanism)
    this.connectCrdtToBackend()
  }

  private connectCrdtToBackend() {
    // Use existing CRDT transport, but simplified
    const transport = this.createSimpleTransport()
    this.engine.addTransport(transport)
  }
}
```

#### 4. **Simplified Backend State Management**
Backend engine focuses on persistence and state synchronization:

```typescript
class BackendEngine {
  constructor(private fs: FilesystemInterface) {
    this.engine = createEngine()
    this.loadExistingState()
    this.setupAutoPersistence()
  }

  private async loadExistingState() {
    if (await this.fs.existFile('main.composite')) {
      const composite = await this.fs.readFile('main.composite')
      this.loadCompositeIntoEngine(composite)
    }
  }

  private setupAutoPersistence() {
    // Reuse existing auto-save logic from composite-dirty.ts
    this.engine.addSystem(() => {
      if (this.isDirty) {
        this.dumpEngineAndGetComposite(true) // Existing method
        this.isDirty = false
      }
    })
  }
}
```

## Implementation Details

### Frontend Engine Implementation

```typescript
// Unified frontend engine combining inspector and renderer
export class UnifiedInspectorEngine {
  private engine: IEngine
  private sceneContext: SceneContext
  private filesystem: FilesystemRpc

  constructor(filesystem: FilesystemRpc, canvas: HTMLCanvasElement) {
    this.filesystem = filesystem
    this.engine = createEngine()
    this.sceneContext = this.initializeRenderer(canvas)
    this.setupInspectorSystems()
    this.setupCrdtSync()
  }

  private initializeRenderer(canvas: HTMLCanvasElement): SceneContext {
    const renderer = initRenderer(canvas, preferences)
    return new SceneContext(renderer.engine, renderer.scene, loadableScene)
  }

  private setupInspectorSystems() {
    // Add all inspector functionality to single engine
    this.engine.addSystem(entitySelectionSystem)
    this.engine.addSystem(componentEditorSystem)
    this.engine.addSystem(gizmoSystem)
    this.engine.addSystem(hierarchySystem)
  }

  private async setupCrdtSync() {
    // Load initial state from backend
    try {
      const compositeBuffer = await this.filesystem.readFile('main.composite')
      const composite = JSON.parse(compositeBuffer.toString())
      this.loadCompositeIntoEngine(composite)
    } catch (error) {
      console.log('No existing composite found, starting with empty scene')
    }

    // Setup CRDT transport (simplified)
    const transport = this.createCrdtTransport()
    this.engine.addTransport(transport)
  }

  private createCrdtTransport(): Transport {
    const outgoingMessages = new AsyncQueue<Uint8Array>()

    return {
      filter: () => !outgoingMessages.closed,
      send: async (message: Uint8Array) => {
        if (outgoingMessages.closed) return
        outgoingMessages.enqueue(message)
      },
      // Connect to backend via existing CRDT mechanism
      onmessage: (message: Uint8Array) => {
        this.engine.crdtMessageHandler(message)
      }
    }
  }
}
```

### Backend RPC Implementations

#### Local Mode Implementation
```typescript
class LocalFilesystemRpc implements FilesystemRpc {
  private backendEngine: IEngine
  private compositeManager: CompositeManager

  constructor() {
    this.backendEngine = createEngine()
    this.setupBackendEngine()
  }

  private async setupBackendEngine() {
    // Initialize backend engine with existing composite/dirty logic
    const fs = createFileSystemInterface()
    const { compositeManager } = await compositeAndDirty(
      fs,
      this.backendEngine,
      () => getInspectorPreferences(),
      'main.composite'
    )
    this.compositeManager = compositeManager
  }

  async readFile(path: string): Promise<Buffer> {
    return await nodeFs.readFile(path)
  }

  async writeFile(path: string, content: Buffer): Promise<void> {
    await nodeFs.writeFile(path, content)

    // If it's a composite-related file, sync with backend engine
    if (this.isEngineStateFile(path)) {
      await this.syncEngineState()
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await nodeFs.access(path)
      return true
    } catch {
      return false
    }
  }

  async listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]> {
    const entries = await nodeFs.readdir(path, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }))
  }

  private async syncEngineState() {
    // Use existing dumpEngineAndGetComposite logic
    await this.compositeManager.dumpEngineAndGetComposite()
  }
}
```

#### Iframe Mode Implementation
```typescript
class IframeFilesystemRpc implements FilesystemRpc {
  private transport: MessageTransport

  constructor(parentOrigin: string) {
    this.transport = new MessageTransport(window, window.parent, parentOrigin)
  }

  async readFile(path: string): Promise<Buffer> {
    return await this.transport.request('readFile', { path })
  }

  async writeFile(path: string, content: Buffer): Promise<void> {
    return await this.transport.request('writeFile', { path, content })
  }

  async exists(path: string): Promise<boolean> {
    return await this.transport.request('exists', { path })
  }

  async listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]> {
    return await this.transport.request('listFiles', { path })
  }

  async deleteFile(path: string): Promise<void> {
    return await this.transport.request('deleteFile', { path })
  }
}
```

#### WebSocket Mode Implementation
```typescript
class WebSocketFilesystemRpc implements FilesystemRpc {
  private rpcClient: RpcClient

  constructor(wsUrl: string) {
    const ws = new WebSocket(wsUrl)
    const transport = new WebSocketTransport(ws)
    this.rpcClient = createRpcClient(transport)
  }

  async readFile(path: string): Promise<Buffer> {
    return await this.rpcClient.call('readFile', { path })
  }

  async writeFile(path: string, content: Buffer): Promise<void> {
    return await this.rpcClient.call('writeFile', { path, content })
  }

  async exists(path: string): Promise<boolean> {
    return await this.rpcClient.call('exists', { path })
  }

  async listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]> {
    return await this.rpcClient.call('listFiles', { path })
  }

  async deleteFile(path: string): Promise<void> {
    return await this.rpcClient.call('deleteFile', { path })
  }
}
```

### Unified Connection Logic

```typescript
// Simplified connection saga maintaining all current deployment modes
export function* connectSaga() {
  const config: InspectorConfig = yield call(getConfig);
  let filesystem: FilesystemRpc;

  if (!config.dataLayerRpcWsUrl) {
    if (!config.dataLayerRpcParentUrl) {
      // LOCAL MODE: Direct filesystem access with backend engine
      filesystem = new LocalFilesystemRpc();
    } else {
      // IFRAME MODE: RPC via postMessage to parent window
      filesystem = new IframeFilesystemRpc(config.dataLayerRpcParentUrl);
    }
  } else {
    // WEBSOCKET MODE: RPC via WebSocket to remote server
    filesystem = new WebSocketFilesystemRpc(config.dataLayerRpcWsUrl);
  }

  // Single engine initialization regardless of backend type
  const canvas: HTMLCanvasElement = yield call(getCanvas);
  const unifiedEngine = new UnifiedInspectorEngine(filesystem, canvas);

  yield put(engineConnected({ engine: unifiedEngine }));
}
```

## Benefits Analysis

### Complexity Reduction

| Current Architecture | Proposed Architecture | Improvement |
|---------------------|----------------------|-------------|
| 3 synchronized engines | 2 engines (1 frontend, 1 backend) | 33% reduction in engines |
| Backend defines 20+ RPC methods | Frontend defines 5 simple methods | 75% reduction in RPC complexity |
| Protobuf code generation | TypeScript interfaces only | Eliminate build complexity |
| Complex CRDT streaming setup | Simplified CRDT (same mechanism) | Maintain proven sync, reduce setup |
| Multi-layer transport abstraction | Direct RPC implementation per mode | Simpler transport logic |

### Maintainability Improvements

#### 1. **Simplified RPC Contract**
```typescript
// Before: Complex protobuf-generated interface
export const DataServiceDefinition = {
  methods: {
    crdtStream: { requestStream: true, responseStream: true, /* complex */ },
    getFiles: { /* complex */ },
    saveFile: { /* complex */ },
    getAssetCatalog: { /* complex */ },
    importAsset: { /* complex */ },
    // ... 20+ more methods
  }
};

// After: Simple TypeScript interface
interface FilesystemRpc {
  readFile(path: string): Promise<Buffer>
  writeFile(path: string, content: Buffer): Promise<void>
  exists(path: string): Promise<boolean>
  listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]>
  deleteFile(path: string): Promise<void>
}
```

#### 2. **Better Error Handling**
```typescript
// Before: Complex RPC error recovery across multiple engines
consumeAllMessagesInto(dataLayerStream(outgoingMessagesStream), onMessage).catch(e => {
  console.error(`${engineKey} consumeAllMessagesInto failed: `, e);
  outgoingMessagesStream.close();
});

// After: Standard async/await error handling
try {
  await filesystem.writeFile('main.composite', compositeData)
} catch (error) {
  console.error('Failed to save composite:', error)
  // Standard retry logic
  await retryWithBackoff(() => filesystem.writeFile('main.composite', compositeData))
}
```

#### 3. **Improved Testing**
```typescript
// Before: Testing requires mocking complex RPC flows and multiple engines
const mockDataLayer = {
  crdtStream: jest.fn().mockReturnValue(mockAsyncIterable),
  getFiles: jest.fn(),
  saveFile: jest.fn(),
  // ... mock all 20+ methods
}

// After: Simple interface mocking
const mockFilesystem: FilesystemRpc = {
  readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  listFiles: jest.fn().mockResolvedValue([]),
  deleteFile: jest.fn().mockResolvedValue(undefined)
}

const engine = new UnifiedInspectorEngine(mockFilesystem, mockCanvas)
```

#### 4. **Clearer Architecture Boundaries**
- **Frontend**: Single engine + simple filesystem needs
- **Backend**: Engine persistence + filesystem operations
- **Interface**: 5 simple methods vs 20+ complex RPC methods

### Performance Benefits

#### 1. **Reduced Engine Overhead**
```typescript
// Before: Three engines consuming memory and CPU
const engines = {
  inspector: createInspectorEngine(),  // ~X MB memory
  renderer: createRendererEngine(),    // ~Y MB memory
  dataLayer: createDataLayerEngine()   // ~Z MB memory (in backend)
}
// Total: ~(X + Y + Z) MB + sync overhead

// After: Two engines with clear purposes
const frontendEngine = createUnifiedEngine()  // ~(X + Y) MB memory
const backendEngine = createBackendEngine()   // ~Z MB memory
// Total: ~(X + Y + Z) MB - sync overhead
```

#### 2. **Simplified CRDT Synchronization**
```typescript
// Before: Complex multi-engine CRDT coordination
connectCrdtToEngine(engines.inspector, dataLayer.crdtStream, 'Inspector')
connectCrdtToEngine(engines.renderer, dataLayer.crdtStream, 'Renderer')

// After: Simple bidirectional sync
frontendEngine.connectTo(backendEngine) // Standard CRDT sync
```

#### 3. **Efficient Network Usage**
- **Same CRDT mechanism**: No change in network efficiency
- **Simpler transport**: Less transport layer overhead
- **Fewer connections**: Single CRDT stream instead of multiple

## Migration Strategy

### Phase 1: Foundation Setup (Weeks 1-2)

#### 1.1 Define Frontend RPC Interface
```typescript
// Create new interface file: src/lib/filesystem/interface.ts
export interface FilesystemRpc {
  readFile(path: string): Promise<Buffer>
  writeFile(path: string, content: Buffer): Promise<void>
  exists(path: string): Promise<boolean>
  listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]>
  deleteFile(path: string): Promise<void>
}
```

#### 1.2 Implement Backend RPC Handlers
```typescript
// Create: src/lib/filesystem/implementations/
// ├─ local.ts        - LocalFilesystemRpc
// ├─ iframe.ts       - IframeFilesystemRpc
// └─ websocket.ts    - WebSocketFilesystemRpc
```

#### 1.3 Create Unified Frontend Engine
```typescript
// Create: src/lib/engine/unified-engine.ts
export class UnifiedInspectorEngine {
  // Combine existing inspector and renderer logic
  // Maintain existing CRDT sync mechanism
  // Use filesystem interface for persistence
}
```

### Phase 2: Engine Consolidation (Weeks 3-4)

#### 2.1 Merge Inspector and Renderer Engines
```typescript
// Before: Multiple engine creation points
const inspectorEngine = createInspectorEngine()
const rendererEngine = createRendererEngine()

// After: Single engine with multiple systems
const unifiedEngine = createEngine()
unifiedEngine.addSystem(inspectorSystem)
unifiedEngine.addSystem(rendererSystem)
unifiedEngine.addSystem(gizmoSystem)
```

#### 2.2 Update Component Integration
```typescript
// Merge components from both engines
const components = {
  ...inspectorComponents,  // Entity selection, hierarchy, etc.
  ...rendererComponents,   // Babylon.js integration
}
```

#### 2.3 Consolidate Event Handling
```typescript
// Single event system for both inspector and renderer events
const eventBus = createEventBus()
eventBus.on('entitySelected', handleEntitySelection)
eventBus.on('componentUpdated', handleComponentUpdate)
eventBus.on('sceneRendered', handleSceneRender)
```

### Phase 3: RPC Replacement (Weeks 5-6)

#### 3.1 Replace Data Layer Connections
```typescript
// Before: Complex data layer setup
const dataLayer: IDataLayer = yield call(getDataLayerInterface);
yield call(connectCrdtToEngine, engines.inspector, dataLayer.crdtStream, 'Inspector');

// After: Simple filesystem setup
const filesystem: FilesystemRpc = createFilesystem(config);
const unifiedEngine = new UnifiedInspectorEngine(filesystem, canvas);
```

#### 3.2 Update Connection Saga
```typescript
// Update: src/redux/data-layer/sagas/connect.ts
export function* connectSaga() {
  const config: InspectorConfig = yield call(getConfig);
  const filesystem: FilesystemRpc = yield call(createFilesystemRpc, config);
  const canvas: HTMLCanvasElement = yield call(getCanvas);

  const engine = new UnifiedInspectorEngine(filesystem, canvas);
  yield put(engineConnected({ engine }));
}

function createFilesystemRpc(config: InspectorConfig): FilesystemRpc {
  if (!config.dataLayerRpcWsUrl) {
    if (!config.dataLayerRpcParentUrl) {
      return new LocalFilesystemRpc();
    } else {
      return new IframeFilesystemRpc(config.dataLayerRpcParentUrl);
    }
  } else {
    return new WebSocketFilesystemRpc(config.dataLayerRpcWsUrl);
  }
}
```

#### 3.3 Remove Protobuf Dependencies
```typescript
// Delete: src/lib/data-layer/proto/
// Update: package.json - remove protobuf dependencies
// Update: build scripts - remove protobuf generation
```

### Phase 4: Backend Simplification (Weeks 7-8)

#### 4.1 Simplify Backend RPC Methods
```typescript
// Before: Complex data layer methods (src/lib/data-layer/host/rpc-methods.ts)
export async function initRpcMethods(fs, engine, onChanges): Promise<DataLayerRpcServer> {
  return {
    async redo() { /* complex */ },
    async undo() { /* complex */ },
    crdtStream(iter) { /* complex streaming */ },
    async getAssetData(req) { /* complex */ },
    async getFiles({ path, ignore = [] }) { /* complex */ },
    // ... 20+ more methods
  };
}

// After: Simple filesystem methods
export class LocalFilesystemRpc implements FilesystemRpc {
  async readFile(path: string): Promise<Buffer> { /* simple */ }
  async writeFile(path: string, content: Buffer): Promise<void> { /* simple */ }
  async exists(path: string): Promise<boolean> { /* simple */ }
  async listFiles(path: string): Promise<{ name: string; isDirectory: boolean }[]> { /* simple */ }
  async deleteFile(path: string): Promise<void> { /* simple */ }
}
```

#### 4.2 Maintain Backend Engine Logic
```typescript
// Keep existing logic: src/lib/data-layer/host/utils/composite-dirty.ts
// Backend engine still handles:
// - dumpEngineAndGetComposite()
// - Auto-persistence on changes
// - Undo/redo state management
// - CRDT synchronization with frontend
```

### Phase 5: Testing and Validation (Weeks 9-10)

#### 5.1 Comprehensive Testing
```typescript
// Test unified engine
describe('UnifiedInspectorEngine', () => {
  it('should merge inspector and renderer functionality', () => {
    const mockFs = createMockFilesystem()
    const engine = new UnifiedInspectorEngine(mockFs, mockCanvas)

    // Test inspector functionality
    engine.selectEntity(entityId)
    expect(engine.getSelectedEntity()).toBe(entityId)

    // Test renderer functionality
    expect(engine.getScene()).toBeDefined()
    expect(engine.getRenderStats()).toBeDefined()
  })
})

// Test filesystem implementations
describe('FilesystemRpc implementations', () => {
  it('should work with local filesystem', async () => {
    const fs = new LocalFilesystemRpc()
    await fs.writeFile('test.txt', Buffer.from('test'))
    const content = await fs.readFile('test.txt')
    expect(content.toString()).toBe('test')
  })

  // Test iframe and websocket modes
})
```

#### 5.2 Performance Validation
```typescript
// Benchmark memory usage
const memoryBefore = process.memoryUsage()
const engine = new UnifiedInspectorEngine(filesystem, canvas)
const memoryAfter = process.memoryUsage()

// Validate memory reduction vs current 3-engine system
expect(memoryAfter.heapUsed - memoryBefore.heapUsed).toBeLessThan(currentMemoryUsage)

// Benchmark CRDT sync performance
const syncStart = performance.now()
await engine.syncWithBackend()
const syncTime = performance.now() - syncStart
expect(syncTime).toBeLessThan(currentSyncTime)
```

#### 5.3 Integration Testing
```typescript
// Test all deployment modes
describe('Deployment modes', () => {
  it('should work in local mode', async () => {
    const config = { dataLayerRpcWsUrl: null, dataLayerRpcParentUrl: null }
    const engine = await createEngineFromConfig(config)
    expect(engine).toBeDefined()
  })

  it('should work in iframe mode', async () => {
    const config = { dataLayerRpcWsUrl: null, dataLayerRpcParentUrl: 'parent' }
    const engine = await createEngineFromConfig(config)
    expect(engine).toBeDefined()
  })

  it('should work in websocket mode', async () => {
    const config = { dataLayerRpcWsUrl: 'ws://localhost:8080' }
    const engine = await createEngineFromConfig(config)
    expect(engine).toBeDefined()
  })
})
```

### Migration Risks and Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| **State Synchronization Issues** | Medium | High | Extensive testing of CRDT sync, gradual rollout |
| **Performance Regression** | Low | Medium | Continuous benchmarking, rollback plan |
| **Feature Parity Loss** | Medium | High | Detailed feature mapping, comprehensive testing |
| **Deployment Mode Compatibility** | Medium | High | Test all 3 modes (local, iframe, websocket) |
| **Team Productivity Impact** | High | Medium | Incremental migration, parallel development |

### Rollback Strategy

```typescript
// Maintain compatibility during transition
class LegacyEngineAdapter {
  constructor(private unifiedEngine: UnifiedInspectorEngine) {}

  // Provide legacy interface for gradual migration
  get inspectorEngine(): IEngine { return this.unifiedEngine.engine }
  get rendererEngine(): IEngine { return this.unifiedEngine.engine }
}

// Feature flag for gradual rollout
const USE_UNIFIED_ENGINE = process.env.FEATURE_UNIFIED_ENGINE === 'true'

export function createEngines(config: InspectorConfig) {
  if (USE_UNIFIED_ENGINE) {
    const filesystem = createFilesystemRpc(config)
    return new UnifiedInspectorEngine(filesystem, canvas)
  } else {
    // Fallback to current implementation
    return createLegacyEngines(config)
  }
}
```

## Success Metrics

### Technical Metrics

#### Code Complexity
- **Reduce RPC Methods**: From 20+ complex methods to 5 simple methods (75% reduction)
- **Eliminate Protobuf**: Remove code generation step and .proto maintenance
- **Reduce Engine Count**: From 3 engines to 2 engines (33% reduction)
- **Simplify Transport**: Single transport implementation per mode vs complex multi-layer setup

#### Performance Metrics
- **Memory Usage**: Target 20-30% reduction by eliminating redundant engine state
- **Bundle Size**: Reduce by removing protobuf dependencies and RPC complexity
- **Load Time**: Improve by simplifying engine initialization
- **Sync Performance**: Maintain current CRDT efficiency while reducing setup overhead

#### Maintainability Metrics
- **Test Coverage**: Increase to 90%+ with simplified mocking
- **Build Time**: Reduce by eliminating protobuf code generation
- **Developer Onboarding**: Reduce time to understand architecture by 50%

### Business Metrics

#### Development Velocity
- **Feature Development**: 30-40% faster due to simplified architecture
- **Bug Fix Time**: 50% faster due to clearer responsibilities
- **New Developer Ramp-up**: 60% faster due to simpler concepts

#### System Reliability
- **Crash Rate**: Reduce by 40% due to fewer moving parts
- **Sync Issues**: Reduce by 70% due to simplified engine coordination
- **Error Recovery**: Improve by 50% with standard async/await patterns

## Real-World Migration Example

### Before: Complex Entity Update Flow

```typescript
// Current complex flow for updating an entity
export function* updateEntity(entityId: Entity, component: string, value: any) {
  // 1. Update inspector engine
  const inspectorEngine = yield select(getInspectorEngine)
  inspectorEngine.addComponent(entityId, component, value)

  // 2. CRDT message automatically syncs to renderer engine
  // 3. CRDT message automatically syncs to data layer engine
  // 4. Data layer engine persists via dumpEngineAndGetComposite
  // 5. Complex error handling for each engine sync

  try {
    yield call(connectCrdtToEngine, inspectorEngine, dataLayer.crdtStream, 'Inspector')
  } catch (error) {
    // Complex error recovery across multiple engines
  }
}
```

### After: Simplified Entity Update Flow

```typescript
// Proposed simple flow for updating an entity
export class UnifiedInspectorEngine {
  async updateEntity(entityId: Entity, component: string, value: any) {
    // 1. Update unified frontend engine
    this.engine.addComponent(entityId, component, value)

    // 2. CRDT automatically syncs to backend engine
    // 3. Backend engine automatically persists (existing logic)
    // 4. Simple error handling with standard async/await

    // That's it! Much simpler flow.
  }
}
```

### Before: Complex Connection Setup

```typescript
// Current complex connection setup (src/redux/data-layer/sagas/connect.ts)
export function* connectSaga() {
  const config: InspectorConfig = yield call(getConfig);

  if (!config.dataLayerRpcWsUrl) {
    if (!config.dataLayerRpcParentUrl) {
      const dataLayer: IDataLayer = yield call(createLocalDataLayerRpcClient);
      yield put(connected({ dataLayer }));
      return;
    }
    const dataLayer: IDataLayer = yield call(
      createIframeDataLayerRpcClient,
      config.dataLayerRpcParentUrl,
    );
    yield put(connected({ dataLayer }));
    return;
  }

  // Complex WebSocket setup
  const ws: WebSocket = yield call(createWebSocketConnection, config.dataLayerRpcWsUrl);
  const socketChannel: EventChannel<WsActions> = yield call(createSocketChannel, ws);

  try {
    while (true) {
      const wsEvent: WsActions = yield take(socketChannel);

      if (wsEvent.type === 'WS_OPENED') {
        const clientTransport: Transport = yield call(WebSocketTransport, ws);
        const client: RpcClient = yield call(createRpcClient, clientTransport);
        const clientPort: RpcClientPort = yield call(client.createPort, 'scene-ctx');
        const dataLayer: DataLayerRpcClient = codegen.loadService<
          { engine: IEngine },
          DataServiceDefinition
        >(clientPort, DataServiceDefinition);
        yield put(connected({ dataLayer }));
      }
    }
  } catch (error) {
    console.log('[WS] Error', error);
  } finally {
    yield put(reconnect());
  }
}
```

### After: Simple Connection Setup

```typescript
// Proposed simple connection setup
export function* connectSaga() {
  const config: InspectorConfig = yield call(getConfig);
  const filesystem: FilesystemRpc = yield call(createFilesystemRpc, config);
  const canvas: HTMLCanvasElement = yield call(getCanvas);

  const engine = new UnifiedInspectorEngine(filesystem, canvas);
  yield put(engineConnected({ engine }));
}

function createFilesystemRpc(config: InspectorConfig): FilesystemRpc {
  if (!config.dataLayerRpcWsUrl) {
    if (!config.dataLayerRpcParentUrl) {
      return new LocalFilesystemRpc();
    } else {
      return new IframeFilesystemRpc(config.dataLayerRpcParentUrl);
    }
  } else {
    return new WebSocketFilesystemRpc(config.dataLayerRpcWsUrl);
  }
}
```

## Conclusion

The proposed architectural refactor with inverted RPC responsibility represents a significant simplification while maintaining all current functionality and deployment flexibility. Key advantages:

### **Architectural Benefits**
1. **Reduced Complexity**: 2 engines instead of 3, simple RPC interface instead of complex protobuf
2. **Maintained Flexibility**: All 3 deployment modes (local, iframe, websocket) preserved
3. **Proven Sync Mechanism**: CRDT synchronization maintained (no risk of sync issues)
4. **Clear Responsibilities**: Frontend defines needs, backend implements filesystem

### **Development Benefits**
1. **Faster Development**: Simpler architecture means faster feature development
2. **Easier Testing**: Mock 5 simple methods instead of 20+ complex RPC methods
3. **Better Debugging**: Standard async/await error handling vs complex CRDT streaming errors
4. **Reduced Maintenance**: No protobuf generation, simpler transport logic

### **Performance Benefits**
1. **Lower Memory Usage**: Single frontend engine vs two synchronized engines
2. **Same Network Efficiency**: CRDT mechanism preserved
3. **Faster Load Times**: Simplified initialization
4. **Better Error Recovery**: Standard retry patterns vs custom RPC recovery

The migration can be executed incrementally over 10 weeks with clear rollback procedures and comprehensive testing. This refactor positions the Inspector for long-term maintainability while solving current complexity issues that impact development velocity.

**The core insight** is maintaining the proven CRDT synchronization while inverting who defines the RPC interface - letting the frontend specify its simple needs rather than the backend exposing complex methods. This architectural inversion creates a much cleaner, more maintainable system.
