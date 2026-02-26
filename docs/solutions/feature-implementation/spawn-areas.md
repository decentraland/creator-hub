---
title: Spawn Areas Feature Implementation
category: feature-implementation
tags: [babylon.js, undo-redo, gizmo, inspector, player-entity, spawn-points]
components: [PlayerInspector, SpawnPointManager, GizmoManager, UndoRedoProvider]
branch: feat/spawn-points
date: 2026-02-23
status: completed
---

# Spawn Areas Feature

A visual spawn area editor for Decentraland scenes. Users manage spawn areas in the 3D viewport and the PlayerInspector panel — complete with position gizmos, camera target cubes, bounds validation, and undo/redo.

---

## Key Architectural Decisions

### Spawn settings live in PlayerInspector, not SceneInspector

Spawn data lives on the Scene component attached to `RootEntity`. But the UI for editing it was moved from `SceneInspector` (ROOT entity settings tab) to `PlayerInspector` (shown when the Player entity is selected).

**Why:** Figma designs place spawn areas conceptually under the Player entity in the hierarchy. `PlayerInspector` reads/writes `sdk.engine.RootEntity` directly — the `entity` prop (PLAYER) is not used for data access.

**Impact:** Clicking a spawn area mesh in the viewport now selects `engine.PlayerEntity` (not `engine.RootEntity`). This mounts `PlayerInspector` on demand, which introduced a mount-timing risk.

### Spawn areas appear in the entity tree under Player

`PlayerTree.tsx` renders spawn areas as pseudo-entities under the Player node — each with its own icon, selection state, rename, visibility toggle, and duplicate action. They are "crucial entities" (limited capabilities — can't add components or re-parent).

---

## Technical Challenges Solved

### 1. Gizmo detaches after drag

**Problem:** Dragging the gizmo triggers a position update → Scene component change → `updateFromSceneComponent` → full visual `clear()` → disposes the node the gizmo was attached to → misalignment.

**Fix:** Save `selectedIndex` before `clear()` and restore it after the async rebuild via `selectSpawnPoint(previousIndex)`. This emits `selectionChange`, which triggers gizmo re-attachment to the new node.

**File:** `spawn-point-manager.ts`

### 2. Stale closure in useEffect subscription

**Problem:** `useEffect` subscribes to `onSelectionChange` once (stable deps). The `handleSpawnPointPositionChange` callback captured at that point becomes stale when `spawnPoints` state changes.

**Fix:** Forward to the latest callback via a ref:

```tsx
const positionChangeRef = useRef(handleSpawnPointPositionChange);
positionChangeRef.current = handleSpawnPointPositionChange;
// In useEffect:
gizmoManager.attachToSpawnPoint(node, index, (i, p) => positionChangeRef.current(i, p));
```

**File:** `PlayerInspector.tsx`

### 3. Undo/redo didn't capture spawn area changes

**Problem:** `StateManager` classifies Scene component changes as `SCENE_UPDATE`. `UndoRedoProvider.canHandle()` only accepted `COMPOSITE_UPDATE` — so spawn area edits were never captured. Additionally, `CompositeProvider` didn't save after Scene changes, causing stale `prevValue` on consecutive edits.

**Fix — 4 files:**

| File | Change |
| --- | --- |
| `undo-redo-provider.ts` | Added `SCENE_UPDATE` to `canHandle()` and `processOperation()` |
| `composite-provider.ts` | Added `SCENE_UPDATE` to `canHandle()` so composite dumps after each Scene change |
| `scene-provider.ts` | Added `syncFromEngine(engine)` — reads current Scene from engine, saves to `scene.json` |
| `rpc-methods.ts` | Calls `sceneProvider.syncFromEngine()` after every undo/redo |

**Data flow after fix:**

```
Undo Ctrl+Z
  → undoRedoProvider._undo() restores prevValue
  → CRDT propagates to renderer engine
  → putSceneComponent → spawnPointManager.updateFromSceneComponent() → 3D visuals update
  → useComponentValue detects change → PlayerInspector UI updates
  → compositeProvider.saveComposite()
  → sceneProvider.syncFromEngine() → scene.json updated
```

---

## Data Flow: Gizmo → Component → Visuals

```
Gizmo drag end
  → GizmoManager.dispatchOperations()
  → onSpawnPointPositionChange(index, position)
  → PlayerInspector.handleSpawnPointPositionChange()
  → modifySpawnPoint() (useArrayState)
  → setComponentValue({ ...componentValue, spawnPoints })
  → Scene component onChange
  → putSceneComponent (editorComponents/scene.ts)
  → spawnPointManager.updateFromSceneComponent()
  → clear() + async recreate + selectSpawnPoint(previousIndex)
  → selectionChange event → gizmoManager.attachToSpawnPoint(newNode)
```

---

## Key Files

| File                     | Role                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `spawn-point-visuals.ts` | Factory: avatar GLB, ground plane, camera target cube meshes        |
| `spawn-point-manager.ts` | Lifecycle: create, update, dispose, select spawn visuals            |
| `PlayerTree.tsx`         | Entity tree: spawn areas as pseudo-entities under Player            |
| `PlayerInspector.tsx`    | React UI: spawn area cards, gizmo subscription, position handler    |
| `GizmoManager.ts`        | `attachToSpawnPoint` / `detachFromSpawnPoint` (position-only gizmo) |
| `input.ts`               | 3D picking: detects spawn mesh clicks, selects Player entity        |
| `undo-redo-provider.ts`  | Undo/redo capture for Scene component changes                       |
| `composite-provider.ts`  | Composite dump after Scene changes                                  |
| `scene-provider.ts`      | `syncFromEngine()` — undo/redo → scene.json sync                    |

---

## Known Risks / Watch Points

- **Mount-timing race:** `selectionChange` may fire before `PlayerInspector`'s `useEffect` sets up. React batching likely saves us in practice. Fix if needed: initialize `selectedSpawnPointIndex` from `spawnPointManager.getSelectedIndex()` on mount.
- **Unconditional `syncFromEngine`:** Called after every undo/redo regardless of whether Scene was involved. Adds minor I/O overhead but is safe and idempotent.
