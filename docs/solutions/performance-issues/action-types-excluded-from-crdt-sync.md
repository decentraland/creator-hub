---
title: 'ActionTypes Component Exceeding LiveKit CRDT Sync Size Limit'
date: 2026-03-16
category: performance-issues
tags:
  - crdt
  - multiplayer-sync
  - livekit
  - ecs-component
  - actiontypes
  - network-bandwidth
  - asset-packs
component: packages/asset-packs
severity: medium
symptom: |
  The ActionTypes ECS component (~14KB) on engine.RootEntity was being synced via CRDT over LiveKit,
  exceeding the 12KB message size limit. This caused silent message drops during multiplayer scene
  sync, potentially breaking initial state sharing when new users joined a scene.
root_cause: |
  ActionTypes was defined as a standard ECS component (LastWriteWinElementSet) and attached to
  engine.RootEntity. The CRDT system syncs all component state on all entities by default.
  Since ActionTypes stored JSON schemas for 60+ action types as serialized strings, its payload
  exceeded LiveKit's 12KB limit. The data was static metadata that never changed during the
  scene lifecycle and was identical across all clients.
---

## Problem

In Decentraland multiplayer scenes, the `ActionTypes` component was being synchronized via CRDT over LiveKit to all connected peers. This component stores JSON schema definitions for every available action type (60+ types like `PLAY_ANIMATION`, `SET_STATE`, `START_TWEEN`, etc.), totaling ~14KB when serialized.

LiveKit enforces a 12KB message size limit (`LIVEKIT_MAX_SIZE` in `@dcl/ecs/src/systems/crdt/index.ts`). Messages exceeding this limit are silently dropped with a console error:

```typescript
if (messageSize / 1024 > LIVEKIT_MAX_SIZE) {
  console.error(
    `Message too large (${messageSize} bytes), skipping message for entity ${message.entityId}`,
  );
  continue;
}
```

This meant ActionTypes data was being serialized, processed, and then silently discarded — wasting resources and potentially corrupting sync state for new users joining the scene.

## Root Cause

ActionTypes was implemented as a standard ECS component attached to `engine.RootEntity`:

```typescript
// packages/asset-packs/src/action-types.ts (BEFORE)
export function addActionType<T extends ISchema>(engine: IEngine, type: string, schema?: T) {
  const ActionTypes = getComponent<ActionTypes>(ComponentName.ACTION_TYPES, engine);
  const actionTypes = ActionTypes.getOrCreateMutable(engine.RootEntity); // ← Marks as dirty in CRDT
  actionTypes.value = [...actionTypes.value.filter($ => $.type !== actionType.type), actionType];
}
```

The CRDT system (`@dcl/ecs/src/systems/crdt/index.ts`) iterates **all** engine components and sends their dirty updates to all transports, including the network transport:

```typescript
for (const component of engine.componentsIter()) {
  for (const message of component.getCrdtUpdates()) {
    // Sent to LiveKit network transport
  }
}
```

Since `getOrCreateMutable()` marks the entity as dirty, every call to `addActionType()` during `initComponents()` triggered CRDT sync for the entire ActionTypes payload.

The fundamental issue: **ActionTypes is static configuration metadata, not runtime scene state**. It's populated deterministically from the `ActionSchemas` constant at startup and is identical across all clients. It doesn't need CRDT synchronization.

## Solution

Replaced ECS component storage with a module-level `Map<string, string>` that stores action type → JSON schema mappings in plain memory, completely bypassing the CRDT system.

### What changed

- **Storage**: ECS component on RootEntity → module-level `Map<string, string>`
- **Sync**: CRDT-synced to all peers → local-only, no network traffic
- **API**: Function signatures unchanged (`engine` param kept with `_` prefix for backward compat)
- **Data flow**: `initComponents()` still calls `addActionType()` for each `ActionType` — now writes to the Map instead of ECS

### Backward compatibility: old scene composites

Old `.composite` files still contain serialized `ActionTypes` data on `RootEntity`. Without cleanup, this stale data would be loaded into the engine, shuttled through inspector transports, and re-persisted on every save — perpetuating the problem for existing scenes.

A **load-time migration** (`remove-action-types-component.ts`) runs during `CompositeProvider.runMigrations()`. It checks if the `ActionTypes` ECS component has data on any entity and calls `deleteFrom()` to clean it up. Old scenes self-heal on first open.

### What stayed the same

- **Component registry**: `'asset-packs::ActionTypes'` remains in `COMPONENT_REGISTRY` (`packages/asset-packs/src/versioning/registry.ts`) so old composites can still be deserialized without errors (the definition must exist for `instanceComposite` to load the data before the migration strips it)
- **Inspector types**: `EditorComponents['ActionTypes']` and `EditorComponentNames.ActionTypes` preserved as stubs
- **Sync exclusion**: `ComponentName.ACTION_TYPES` kept in `DISABLED_COMPONENTS` list (`SyncComponentsInspector/utils.ts`) as a UI-level safety net
- **Exported types**: `ActionTypesComponent` and `ActionTypes` types still derived from the component definition

### Files modified

| File | Change |
| --- | --- |
| `packages/asset-packs/src/action-types.ts` | Replaced ECS reads/writes with module-level Map |
| `packages/inspector/.../migrations/remove-action-types-component.ts` | New — load-time migration that strips stale `ActionTypes` data from old composites |
| `packages/inspector/.../composite-provider.ts` | Registered the migration in `runMigrations()` |

## Prevention: When to Use ECS Components vs. Local Stores

This issue stems from a broader architectural question: **what data belongs in the ECS (and therefore in CRDT sync)?**

### Use ECS components when

- Data is **per-entity** (each entity has its own value)
- Data **changes during gameplay** (animations, positions, states)
- Data **needs multiplayer conflict resolution** (concurrent edits)
- Data represents **observable scene state**

### Use local stores (Map, object) when

- Data is **global/shared** across all entities (type registries, schemas)
- Data is **static after initialization** (never changes at runtime)
- Data is **identical across all clients** (derived from code, not user input)
- Data is **large** (>2KB) and doesn't need sync
- Data contains **serialized strings** (JSON schemas, templates)

### Warning signs a component should be a local store

1. Component is only attached to `engine.RootEntity` (global singleton)
2. Component contains `JSON.stringify()`'d data
3. Component is populated once at init and never modified
4. Component is in `DISABLED_COMPONENTS` (shouldn't sync → shouldn't be a component)
5. Serialized size approaches LiveKit's 12KB limit

## Related

- `@dcl/ecs/src/systems/crdt/index.ts` — CRDT message routing and LiveKit chunking logic
- `packages/inspector/src/components/EntityInspector/SyncComponentsInspector/utils.ts` — component sync UI filtering
