import { ScreenshotTools, Vector3 } from '@babylonjs/core';
import type { Entity, IEngine } from '@dcl/ecs';
import { EntityState, Name as NameEngine } from '@dcl/ecs';
import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { type Store } from '../../../redux/store';
import { type createOperations } from '../../sdk/operations';
import { type initRenderer } from '../../babylon/setup/init';
import type { AssetsTab, PanelName, SceneInspectorTab } from '../../../redux/ui/types';
import { setHasCustomCode } from '../../../redux/scene-metrics';
import { type SceneMetrics } from '../../../redux/scene-metrics/types';
import { setDebugConsoleEnabled, setMobileDebugSessionEnabled } from '../../../redux/ui';
import * as debugLogStore from '../../logic/debug-log-store';
import * as mobileDebugStore from '../../logic/mobile-debug-store';
import { setFeatureFlags } from '../../../redux/feature-flags';
import { type EnumEntity } from '../../sdk/enum-entity';
import { EditorComponentNames, type EditorComponents } from '../../sdk/components';
import { resolveActiveSceneComponent } from '../../sdk/components/scene-metadata-version';
import { fetchLatestCatalog, getAssetById } from '../../logic/catalog';
import { getDataLayerInterface, refreshUndoRedoState } from '../../../redux/data-layer';
import { getConfig } from '../../logic/config';
import { withAssetDir } from '../../data-layer/host/fs-utils';

enum Method {
  TOGGLE_COMPONENT = 'toggle_component',
  TOGGLE_PANEL = 'toggle_panel',
  TOGGLE_GIZMOS = 'toggle_gizmos',
  SELECT_ASSETS_TAB = 'select_assets_tab',
  SELECT_SCENE_INSPECTOR_TAB = 'select_scene_inspector_tab',
  TOGGLE_SCENE_INSPECTOR_TAB = 'toggle_scene_inspector_tab',
  TOGGLE_GROUND_GRID = 'toggle_ground_grid',
  SET_CAMERA_POSITION = 'set_camera_position',
  SET_CAMERA_TARGET = 'set_camera_target',
  TAKE_SCREENSHOT = 'take_screenshot',
  SET_SCENE_CUSTOM_CODE = 'set_scene_custom_code',
  SET_DEBUG_CONSOLE_ENABLED = 'set_debug_console_enabled',
  PUSH_DEBUG_LOGS = 'push_debug_logs',
  CLEAR_DEBUG_LOGS = 'clear_debug_logs',
  SET_FEATURE_FLAGS = 'set_feature_flags',
  PUSH_MOBILE_DEBUG_ENTRIES = 'push_mobile_debug_entries',
  SET_MOBILE_DEBUG_SESSION_ENABLED = 'set_mobile_debug_session_enabled',
  // Scene-graph mutations for the AI assistant. Registered only when `operations` is
  // provided (always, when embedded). They run the inspector's real operations layer on
  // the live engine, so the viewport updates and undo/redo + autosave come for free.
  CREATE_ENTITY = 'create_entity',
  REMOVE_ENTITY = 'remove_entity',
  SET_PARENT = 'set_parent',
  SET_COMPONENT = 'set_component',
  REMOVE_COMPONENT = 'remove_component',
  ATTACH_SCRIPT = 'attach_script',
  SEARCH_CATALOG = 'search_catalog',
  PLACE_SMART_ITEM = 'place_smart_item',
  UNDO = 'undo',
  GET_SCENE_METRICS = 'get_scene_metrics',
  GET_SELECTION = 'get_selection',
  CLEAR_SELECTION = 'clear_selection',
  GET_SCENE_SETTINGS = 'get_scene_settings',
  SET_SCENE_SETTINGS = 'set_scene_settings',
}

// A row in the Smart Items catalog, as returned by search_catalog.
type CatalogHit = { id: string; name: string; category: string; tags: string[] };

type Params = {
  [Method.TOGGLE_COMPONENT]: { component: string; enabled: boolean };
  [Method.TOGGLE_PANEL]: { panel: `${PanelName}`; enabled: boolean };
  [Method.TOGGLE_GIZMOS]: { enabled: boolean };
  [Method.SELECT_ASSETS_TAB]: { tab: `${AssetsTab}` };
  [Method.SELECT_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}` };
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}`; enabled: boolean };
  [Method.TOGGLE_GROUND_GRID]: { enabled: boolean };
  [Method.SET_CAMERA_POSITION]: { x: number; y: number; z: number };
  [Method.SET_CAMERA_TARGET]: { x: number; y: number; z: number };
  [Method.TAKE_SCREENSHOT]: { width: number; height: number; precision?: number };
  [Method.SET_SCENE_CUSTOM_CODE]: { hasCustomCode: boolean };
  [Method.SET_DEBUG_CONSOLE_ENABLED]: { enabled: boolean };
  [Method.PUSH_DEBUG_LOGS]: { logs: string[] };
  [Method.CLEAR_DEBUG_LOGS]: Record<string, never>;
  [Method.SET_FEATURE_FLAGS]: { flags: Record<string, boolean> };
  [Method.PUSH_MOBILE_DEBUG_ENTRIES]: { entries: unknown[] };
  [Method.SET_MOBILE_DEBUG_SESSION_ENABLED]: {
    enabled: boolean;
    sessions: {
      id: number;
      sessionId: string | null;
      deviceName: string | null;
      status: 'active' | 'ended';
      messageCount: number;
    }[];
  };
  [Method.CREATE_ENTITY]: { name?: string; parent?: number };
  [Method.REMOVE_ENTITY]: { entity: number };
  [Method.SET_PARENT]: { entity: number; parent: number };
  [Method.SET_COMPONENT]: { entity: number; component: string; value: Record<string, unknown> };
  [Method.REMOVE_COMPONENT]: { entity: number; component: string };
  [Method.ATTACH_SCRIPT]: { entity: number; path: string; priority?: number };
  [Method.SEARCH_CATALOG]: { query?: string; limit?: number };
  [Method.PLACE_SMART_ITEM]: {
    assetId: string;
    name?: string;
    position?: { x: number; y: number; z: number };
  };
  [Method.UNDO]: Record<string, never>;
  [Method.GET_SCENE_METRICS]: Record<string, never>;
  [Method.GET_SELECTION]: Record<string, never>;
  [Method.CLEAR_SELECTION]: Record<string, never>;
  [Method.GET_SCENE_SETTINGS]: Record<string, never>;
  // The patch: the SceneMetadata fields to change (each replaces that field wholesale).
  [Method.SET_SCENE_SETTINGS]: Record<string, unknown>;
};

type Result = {
  [Method.TOGGLE_COMPONENT]: void;
  [Method.TOGGLE_PANEL]: void;
  [Method.TOGGLE_GIZMOS]: void;
  [Method.SELECT_ASSETS_TAB]: void;
  [Method.SELECT_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_GROUND_GRID]: void;
  [Method.SET_CAMERA_POSITION]: void;
  [Method.SET_CAMERA_TARGET]: void;
  [Method.TAKE_SCREENSHOT]: string;
  [Method.SET_SCENE_CUSTOM_CODE]: void;
  [Method.SET_DEBUG_CONSOLE_ENABLED]: void;
  [Method.PUSH_DEBUG_LOGS]: void;
  [Method.CLEAR_DEBUG_LOGS]: void;
  [Method.SET_FEATURE_FLAGS]: void;
  [Method.PUSH_MOBILE_DEBUG_ENTRIES]: void;
  [Method.SET_MOBILE_DEBUG_SESSION_ENABLED]: void;
  [Method.CREATE_ENTITY]: { entity: number };
  [Method.REMOVE_ENTITY]: { entity: number };
  [Method.SET_PARENT]: { entity: number; parent: number };
  [Method.SET_COMPONENT]: { entity: number; component: string };
  [Method.REMOVE_COMPONENT]: { entity: number; component: string };
  [Method.ATTACH_SCRIPT]: { entity: number; path: string };
  [Method.SEARCH_CATALOG]: { total: number; results: CatalogHit[] };
  [Method.PLACE_SMART_ITEM]: { entity: number; name: string };
  [Method.UNDO]: { ok: true };
  [Method.GET_SCENE_METRICS]: {
    metrics: SceneMetrics;
    limits: SceneMetrics;
    entitiesOutOfBoundaries: number[];
  };
  [Method.GET_SELECTION]: { selected: { id: number; name: string }[] };
  [Method.CLEAR_SELECTION]: { ok: true };
  [Method.GET_SCENE_SETTINGS]: { settings: Record<string, unknown> };
  [Method.SET_SCENE_SETTINGS]: { settings: Record<string, unknown> };
};

// Validate an AI-supplied entity id before branding it as an Entity. The id comes from the
// model, so a hallucinated number would otherwise corrupt the CRDT or throw deep in the ECS;
// this turns it into a readable tool error instead. RootEntity (0) is always valid.
function requireEntity(engine: IEngine, id: number): Entity {
  const entity = id as Entity;
  if (entity === engine.RootEntity) return entity;
  if (engine.getEntityState(entity) === EntityState.UsedEntity) return entity;
  throw new Error(`No entity with id ${id} exists in the scene.`);
}

// Resolve a component by its full registered name ("core::Transform"), its short name
// ("Transform", as scene_state reports), or a numeric id string. Returns null if not
// registered — the handler turns that into a readable error for the assistant.
function resolveComponent(engine: IEngine, nameOrId: string) {
  try {
    return engine.getComponent(nameOrId);
  } catch {
    /* not an exact registered name — fall through */
  }
  const asNum = Number(nameOrId);
  if (Number.isFinite(asNum)) {
    try {
      return engine.getComponent(asNum);
    } catch {
      /* not a valid id */
    }
  }
  for (const comp of engine.componentsIter()) {
    if (comp.componentName === nameOrId || comp.componentName.split('::').pop() === nameOrId) {
      return comp;
    }
  }
  return null;
}

export class SceneServer extends RPC<Method, Params, Result> {
  // `renderer` (the Babylon internals) is OPTIONAL: only the camera + screenshot
  // handlers need it. Every other message is renderer-agnostic store dispatch
  // (feature flags, tab/panel toggles, debug console/logs, custom-code, mobile
  // debug), so the server runs under ANY renderer and the host's flags/debug/tab
  // controls reach the inspector — without those, e.g. the SceneMinimap feature
  // flag never arrives under Bevy and the minimap never shows. The Babylon-only
  // handlers are registered only when `renderer` is present; under Bevy a call to
  // one rejects (unhandled method) rather than silently doing nothing wrong.
  // `takeScreenshot` is an optional renderer-agnostic capture used when Babylon
  // internals (`renderer`) aren't present — e.g. Bevy captures via its engine's
  // `/screenshot` console command. When Babylon IS present its own handler below
  // wins (it can frame an offscreen render); this only fills the gap for other
  // renderers so the thumbnail pipeline works under them too.
  constructor(
    transport: Transport,
    store: Store,
    renderer?: ReturnType<typeof initRenderer>,
    takeScreenshot?: (width: number, height: number, precision?: number) => Promise<string>,
    // The inspector's operations layer + engine, for scene-graph mutations driven by the
    // AI assistant. Optional so the server still runs in test/standalone setups without them.
    operations?: ReturnType<typeof createOperations>,
    engine?: IEngine,
    // Network-id allocator, needed by addAsset for Smart Items with sync components.
    enumEntity?: EnumEntity,
  ) {
    super('SceneRpcInbound', transport);

    this.handle('toggle_component', async ({ component, enabled }) => {
      store.dispatch({ type: 'ui/toggleComponent', payload: { component, enabled } });
    });

    this.handle('toggle_panel', async ({ panel, enabled }) => {
      store.dispatch({ type: 'ui/togglePanel', payload: { panel, enabled } });
    });

    this.handle('toggle_gizmos', async ({ enabled }) => {
      store.dispatch({ type: 'ui/toggleGizmos', payload: { enabled } });
    });

    this.handle('select_assets_tab', async ({ tab }) => {
      store.dispatch({ type: 'ui/selectAssetsTab', payload: { tab } });
    });

    this.handle('select_scene_inspector_tab', async ({ tab }) => {
      store.dispatch({ type: 'ui/selectSceneInspectorTab', payload: { tab } });
    });

    this.handle('toggle_scene_inspector_tab', async ({ tab, enabled }) => {
      store.dispatch({ type: 'ui/toggleSceneInspectorTab', payload: { tab, enabled } });
    });

    this.handle('toggle_ground_grid', async ({ enabled }) => {
      store.dispatch({ type: 'ui/toggleGroundGrid', payload: { enabled } });
    });

    // Scene metrics for the AI assistant: the editor's live budget — triangles, entities,
    // bodies, materials, textures — against the per-scene limits, plus any entities out of
    // bounds. Read-only and renderer-agnostic (pure redux read); the Babylon renderer is what
    // populates these, so under Bevy they read as zeros until that renderer reports metrics.
    this.handle('get_scene_metrics', async () => {
      const sm = store.getState().sceneMetrics;
      return {
        metrics: sm.metrics,
        limits: sm.limits,
        entitiesOutOfBoundaries: sm.entitiesOutOfBoundaries,
      };
    });

    // Camera + screenshot need the Babylon internals; only wired when present.
    if (renderer) {
      const camera = renderer.editorCamera.getCamera();

      this.handle('set_camera_position', async ({ x, y, z }) => {
        camera.position.set(x, y, z);
      });

      this.handle('set_camera_target', async ({ x, y, z }) => {
        camera.setTarget(new Vector3(x, y, z));
      });

      this.handle('take_screenshot', async ({ width, height, precision }) => {
        return ScreenshotTools.CreateScreenshotAsync(renderer.engine, camera, {
          width,
          height,
          precision,
        });
      });
    } else if (takeScreenshot) {
      // Non-Babylon renderer (Bevy): no camera control, but it can still capture
      // a frame for the scene thumbnail via its own screenshot path.
      this.handle('take_screenshot', async ({ width, height, precision }) => {
        return takeScreenshot(width, height, precision);
      });
    }

    this.handle('set_scene_custom_code', async ({ hasCustomCode }) => {
      store.dispatch(setHasCustomCode(hasCustomCode));
    });

    this.handle('set_debug_console_enabled', async ({ enabled }) => {
      store.dispatch(setDebugConsoleEnabled({ enabled }));
    });

    this.handle('push_debug_logs', async ({ logs }) => {
      debugLogStore.push(logs);
    });

    this.handle('clear_debug_logs', async () => {
      debugLogStore.clear();
    });

    this.handle('set_feature_flags', async ({ flags }) => {
      store.dispatch(setFeatureFlags(flags));
    });

    this.handle('push_mobile_debug_entries', async ({ entries }) => {
      mobileDebugStore.pushEntries(entries);
    });

    this.handle('set_mobile_debug_session_enabled', async ({ enabled, sessions }) => {
      store.dispatch(setMobileDebugSessionEnabled({ enabled }));
      mobileDebugStore.updateSessions(sessions);
    });

    // Scene-graph mutations (AI assistant). Only wired when the operations layer + engine
    // are provided (i.e. embedded in a host). Each mutation runs the inspector's real
    // operations and then `operations.dispatch()` — which flushes the CRDT (engine.update)
    // and refreshes undo/redo — so the change lands in the live engine exactly as a manual
    // edit would: viewport updates, autosave persists, and it's on the undo stack.
    if (operations && engine) {
      this.handle('create_entity', async ({ name, parent }) => {
        const parentEntity =
          parent === undefined ? engine.RootEntity : requireEntity(engine, parent);
        const entity = operations.addChild(parentEntity, name ?? 'Entity');
        await operations.dispatch();
        return { entity: entity as number };
      });

      this.handle('remove_entity', async ({ entity }) => {
        operations.removeEntity(requireEntity(engine, entity));
        await operations.dispatch();
        return { entity };
      });

      this.handle('set_parent', async ({ entity, parent }) => {
        operations.setParent(requireEntity(engine, entity), requireEntity(engine, parent));
        await operations.dispatch();
        return { entity, parent };
      });

      this.handle('set_component', async ({ entity, component, value }) => {
        const target = requireEntity(engine, entity);
        const comp = resolveComponent(engine, component);
        if (comp === null) throw new Error(`Unknown component "${component}".`);
        if (comp.has(target)) {
          operations.updateValue(comp as never, target, value);
        } else {
          operations.addComponent(target, comp.componentId, value);
        }
        await operations.dispatch();
        return { entity, component: comp.componentName };
      });

      this.handle('remove_component', async ({ entity, component }) => {
        const target = requireEntity(engine, entity);
        const comp = resolveComponent(engine, component);
        if (comp === null) throw new Error(`Unknown component "${component}".`);
        operations.removeComponent(target, comp as never);
        await operations.dispatch();
        return { entity, component: comp.componentName };
      });

      // Attach a Script component pointing at a source file the assistant already wrote
      // (with its own file tools). Appends to any existing scripts; a duplicate path is a
      // no-op. Does not write the file itself.
      this.handle('attach_script', async ({ entity, path, priority }) => {
        type ScriptEntry = { path: string; priority: number; layout?: string };
        const Script = engine.getComponent(EditorComponentNames.Script) as unknown as {
          getOrNull: (e: Entity) => { value: ScriptEntry[] } | null;
          createOrReplace: (e: Entity, v: { value: ScriptEntry[] }) => void;
        };
        const target = requireEntity(engine, entity);
        const current: ScriptEntry[] = Script.getOrNull(target)?.value ?? [];
        if (!current.some(s => s.path === path)) {
          Script.createOrReplace(target, {
            value: [...current, { path, priority: priority ?? 0, layout: '{"params":{}}' }],
          });
          await operations.dispatch();
        }
        return { entity, path };
      });

      // Read-only search over the Smart Items catalog (asset-packs). Lives in a module,
      // not redux, so we read it directly here.
      this.handle('search_catalog', async ({ query, limit }) => {
        const packs = await fetchLatestCatalog();
        const all: CatalogHit[] = packs.flatMap(p =>
          p.assets.map(a => ({
            id: a.id,
            name: a.name,
            category: a.category,
            tags: a.tags ?? [],
          })),
        );
        const q = (query ?? '').trim().toLowerCase();
        const matched =
          q === ''
            ? all
            : all.filter(
                a =>
                  a.name.toLowerCase().includes(q) ||
                  a.id.toLowerCase().includes(q) ||
                  a.category.toLowerCase().includes(q) ||
                  a.tags.some(t => t.toLowerCase().includes(q)),
              );
        return { total: matched.length, results: matched.slice(0, limit ?? 30) };
      });

      // Place a Smart Item from the catalog: import its model files into the project, then
      // spawn it through the real addAsset (which owns id allocation + {assetPath}/{self}/
      // sync-component/trigger placeholder resolution — see repo CLAUDE.md).
      this.handle('place_smart_item', async ({ assetId, name, position }) => {
        if (enumEntity === undefined) {
          throw new Error('Smart items are unavailable in this session.');
        }
        let found = getAssetById(assetId);
        if (!found) {
          await fetchLatestCatalog(); // catalog may not be warmed yet
          found = getAssetById(assetId);
        }
        if (!found) {
          throw new Error(`No catalog asset with id "${assetId}". Use search_catalog first.`);
        }
        const asset = found;
        const dataLayer = getDataLayerInterface();
        if (dataLayer === undefined) throw new Error('The data layer is not connected.');

        // Fetch the asset's files from the content server and import them under
        // assets/asset-packs/<pkg>/… (the same layout the drag-and-drop path uses).
        const pkg = asset.name.trim().replaceAll(' ', '_').toLowerCase();
        const contentBase = getConfig().contentUrl;
        const content = new Map<string, Uint8Array>();
        for (const [rel, hash] of Object.entries(asset.contents)) {
          const res = await fetch(`${contentBase}/contents/${hash}`);
          if (!res.ok) throw new Error(`Failed to fetch "${rel}" (HTTP ${res.status}).`);
          content.set(rel, new Uint8Array(await res.arrayBuffer()));
        }
        await dataLayer.importAsset({
          content,
          basePath: withAssetDir('asset-packs'),
          assetPackageName: pkg,
        });

        const base = `${withAssetDir('asset-packs')}/${pkg}`;
        const src = Object.keys(asset.contents).find(k => /\.(glb|gltf)$/i.test(k)) ?? '';
        const pos = position ?? { x: 8, y: 0, z: 8 };
        const entity = operations.addAsset(
          engine.RootEntity,
          src,
          name ?? asset.name,
          pos,
          base,
          enumEntity,
          asset.composite,
          asset.id,
          false,
        );
        await operations.dispatch();
        return { entity: entity as number, name: name ?? asset.name };
      });

      // Undo one step on the shared history. Used by the panel's "Undo AI changes"
      // (called N times for the N undo entries a turn produced). Awaits the host so the
      // caller can serialize repeated undos.
      this.handle('undo', async () => {
        await getDataLayerInterface()?.undo({});
        store.dispatch(refreshUndoRedoState());
        return { ok: true as const };
      });

      // The entities the user currently has selected in the editor, so the AI assistant can
      // resolve "this" / "the selected entity". Selection is an editor ECS component; read the
      // live engine (not disk) so it's always current. Names come from the ECS Name component,
      // except the reserved entities (Scene root / Player / Camera) which carry no Name — label
      // them exactly as the entity tree does, or the chip shows a bare "#id" (#1507, #1511).
      // Selecting a spawn point selects the Player entity, so it resolves to "Player" too.
      this.handle('get_selection', async () => {
        const Selection = engine.getComponent(
          EditorComponentNames.Selection,
        ) as EditorComponents['Selection'];
        const Name = engine.getComponent(NameEngine.componentName) as typeof NameEngine;
        const label = (entity: Entity): string => {
          if (entity === engine.RootEntity) return 'Scene';
          if (entity === engine.PlayerEntity) return 'Player';
          if (entity === engine.CameraEntity) return 'Camera';
          return Name.getOrNull(entity)?.value ?? '';
        };
        const selected: { id: number; name: string }[] = [];
        for (const [entity] of engine.getEntitiesWith(Selection)) {
          selected.push({ id: entity as number, name: label(entity) });
        }
        return { selected };
      });

      // Deselect everything — the "Clear" affordance on the AI selection chip. Drops the
      // Selection component from every entity, then ticks so the viewport gizmo clears. Not
      // a scene mutation (selection is editor-only state), so it doesn't mark the scene dirty.
      this.handle('clear_selection', async () => {
        const Selection = engine.getComponent(
          EditorComponentNames.Selection,
        ) as EditorComponents['Selection'];
        for (const [entity] of engine.getEntitiesWith(Selection)) {
          Selection.deleteFrom(entity);
        }
        await operations.dispatch({ dirty: false });
        return { ok: true as const };
      });

      // Scene settings live in the versioned SceneMetadata component on the root — name,
      // description, categories, spawn points, skybox, terrain, layout/parcels, etc. — which
      // the AI otherwise can't see or edit (#1527). resolveActiveSceneComponent picks the
      // version the data-layer actually speaks, so reads/writes round-trip and persist to
      // scene.json on save exactly like the SceneInspector UI.
      this.handle('get_scene_settings', async () => {
        const Scene = resolveActiveSceneComponent(engine);
        return { settings: (Scene.getOrNull(engine.RootEntity) ?? {}) as Record<string, unknown> };
      });

      // Merge a partial patch into the current settings (each field the caller includes
      // replaces that field wholesale) and write it through the real operations layer, so it
      // updates the live editor, is undoable, and autosaves. The component schema validates
      // the merged value on write — an invalid patch throws, surfaced to the assistant.
      this.handle('set_scene_settings', async patch => {
        const Scene = resolveActiveSceneComponent(engine);
        const current = (Scene.getOrNull(engine.RootEntity) ?? {}) as Record<string, unknown>;
        operations.updateValue(Scene as never, engine.RootEntity, { ...current, ...patch });
        await operations.dispatch();
        return { settings: (Scene.getOrNull(engine.RootEntity) ?? {}) as Record<string, unknown> };
      });
    }
  }
}
