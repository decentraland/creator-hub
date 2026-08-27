import { RPC, type Transport } from '@dcl/mini-rpc';

export enum AssetsTab {
  FileSystem = 'FileSystem',
  AssetsPack = 'AssetsPack',
  Import = 'Import',
  MobileDebugSession = 'MobileDebugSession',
}

export enum PanelName {
  ENTITIES = 'entities',
  COMPONENTS = 'components',
  ASSETS = 'assets',
  TOOLBAR = 'toolbar',
  SHORTCUTS = 'shortcuts',
  METRICS = 'metrics',
}

export enum SceneInspectorTab {
  DETAILS = 'details',
  LAYOUT = 'layout',
  SETTINGS = 'settings',
}

export enum Method {
  TOGGLE_COMPONENT = 'toggle_component',
  TOGGLE_PANEL = 'toggle_panel',
  TOGGLE_GIZMOS = 'toggle_gizmos',
  SELECT_ASSETS_TAB = 'select_assets_tab',
  SELECT_SCENE_INSPECTOR_TAB = 'select_scene_inspector_tab',
  TOGGLE_SCENE_INSPECTOR_TAB = 'toggle_scene_inspector_tab',
  TOGGLE_GROUND_GRID = 'toggle_ground_grid',
  TAKE_SCREENSHOT = 'take_screenshot',
  SET_CAMERA_TARGET = 'set_camera_target',
  SET_CAMERA_POSITION = 'set_camera_position',
  SET_SCENE_CUSTOM_CODE = 'set_scene_custom_code',
  SET_DEBUG_CONSOLE_ENABLED = 'set_debug_console_enabled',
  PUSH_DEBUG_LOGS = 'push_debug_logs',
  CLEAR_DEBUG_LOGS = 'clear_debug_logs',
  SET_FEATURE_FLAGS = 'set_feature_flags',
  PUSH_MOBILE_DEBUG_ENTRIES = 'push_mobile_debug_entries',
  SET_MOBILE_DEBUG_SESSION_ENABLED = 'set_mobile_debug_session_enabled',
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

type CatalogHit = { id: string; name: string; category: string; tags: string[] };
// The editor's scene budget counters (mirrors the inspector's SceneMetrics).
type SceneMetrics = {
  triangles: number;
  entities: number;
  bodies: number;
  materials: number;
  textures: number;
};

export type Params = {
  [Method.TOGGLE_COMPONENT]: { component: string; enabled: boolean };
  [Method.TOGGLE_PANEL]: { panel: `${PanelName}`; enabled: boolean };
  [Method.TOGGLE_GIZMOS]: { enabled: boolean };
  [Method.SELECT_ASSETS_TAB]: { tab: `${AssetsTab}` };
  [Method.SELECT_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}` };
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}`; enabled: boolean };
  [Method.TOGGLE_GROUND_GRID]: { enabled: boolean };
  [Method.TAKE_SCREENSHOT]: { width: number; height: number; precision?: number };
  [Method.SET_CAMERA_TARGET]: { x: number; y: number; z: number };
  [Method.SET_CAMERA_POSITION]: { x: number; y: number; z: number };
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
  [Method.SET_SCENE_SETTINGS]: Record<string, unknown>;
};

export type Result = {
  [Method.TOGGLE_COMPONENT]: void;
  [Method.TOGGLE_PANEL]: void;
  [Method.TOGGLE_GIZMOS]: void;
  [Method.SELECT_ASSETS_TAB]: void;
  [Method.SELECT_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_GROUND_GRID]: void;
  [Method.TAKE_SCREENSHOT]: string;
  [Method.SET_CAMERA_TARGET]: void;
  [Method.SET_CAMERA_POSITION]: void;
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

// @dcl/mini-rpc's request() never settles if no server answers (it just parks a
// future keyed by id). The scene RPC server only exists for the Babylon renderer
// (see inspector context.ts); under the Bevy renderer there is no handler, so
// every scene-RPC call from the host would leak a forever-pending promise —
// silently, since callers fire-and-forget most of them. Bound every request so it
// rejects instead of hanging; callers already treat a failed scene-RPC call as
// "not applied" (they .catch/ignore), so this degrades gracefully under Bevy (and
// against any transport stall) rather than leaking.
const REQUEST_TIMEOUT_MS = 5000;

export class SceneRpcClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('SceneRpcInbound', transport);
  }

  override request<T extends Method>(method: `${T}`, params: Params[T]): Promise<Result[T]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Scene RPC "${method}" timed out (no renderer response)`)),
        REQUEST_TIMEOUT_MS,
      );
    });
    return Promise.race([super.request(method, params), timeout]).finally(() =>
      clearTimeout(timer),
    );
  }

  toggleComponent = (component: string, enabled: boolean) => {
    return this.request('toggle_component', { component, enabled });
  };

  togglePanel = (panel: `${PanelName}`, enabled: boolean) => {
    return this.request('toggle_panel', { panel, enabled });
  };

  toggleGizmos = (enabled: boolean) => {
    return this.request('toggle_gizmos', { enabled });
  };

  toggleGroundGrid = (enabled: boolean) => {
    return this.request('toggle_ground_grid', { enabled });
  };

  selectAssetsTab = (tab: `${AssetsTab}`) => {
    return this.request('select_assets_tab', { tab });
  };

  selectSceneInspectorTab = (tab: `${SceneInspectorTab}`) => {
    return this.request('select_scene_inspector_tab', { tab });
  };

  toggleSceneInspectorTab = (tab: `${SceneInspectorTab}`, enabled: boolean) => {
    return this.request('toggle_scene_inspector_tab', { tab, enabled });
  };

  takeScreenshot = (width: number, height: number, precision?: number) => {
    return this.request('take_screenshot', { width, height, precision });
  };

  setTarget = (x: number, y: number, z: number) => {
    return this.request('set_camera_target', { x, y, z });
  };

  setPosition = (x: number, y: number, z: number) => {
    return this.request('set_camera_position', { x, y, z });
  };

  setSceneCustomCode = (hasCustomCode: boolean) => {
    return this.request('set_scene_custom_code', { hasCustomCode });
  };

  setDebugConsoleEnabled = (enabled: boolean) => {
    return this.request('set_debug_console_enabled', { enabled });
  };

  pushDebugLogs = (logs: string[]) => {
    return this.request('push_debug_logs', { logs });
  };

  clearDebugLogs = () => {
    return this.request('clear_debug_logs', {} as Record<string, never>);
  };

  setFeatureFlags = (flags: Record<string, boolean>) => {
    return this.request('set_feature_flags', { flags });
  };

  pushMobileDebugEntries = (entries: unknown[]) => {
    return this.request('push_mobile_debug_entries', { entries });
  };

  setMobileDebugSessionEnabled = (
    enabled: boolean,
    sessions: {
      id: number;
      sessionId: string | null;
      deviceName: string | null;
      status: 'active' | 'ended';
      messageCount: number;
    }[] = [],
  ) => {
    return this.request('set_mobile_debug_session_enabled', { enabled, sessions });
  };

  createEntity = (name?: string, parent?: number) => {
    return this.request('create_entity', { name, parent });
  };

  removeEntity = (entity: number) => {
    return this.request('remove_entity', { entity });
  };

  setParent = (entity: number, parent: number) => {
    return this.request('set_parent', { entity, parent });
  };

  setComponent = (entity: number, component: string, value: Record<string, unknown>) => {
    return this.request('set_component', { entity, component, value });
  };

  removeComponent = (entity: number, component: string) => {
    return this.request('remove_component', { entity, component });
  };

  attachScript = (entity: number, path: string, priority?: number) => {
    return this.request('attach_script', { entity, path, priority });
  };

  searchCatalog = (query?: string, limit?: number) => {
    return this.request('search_catalog', { query, limit });
  };

  placeSmartItem = (
    assetId: string,
    name?: string,
    position?: { x: number; y: number; z: number },
  ) => {
    return this.request('place_smart_item', { assetId, name, position });
  };

  undo = () => {
    return this.request('undo', {} as Record<string, never>);
  };

  getSceneMetrics = () => {
    return this.request('get_scene_metrics', {} as Record<string, never>);
  };

  getSelection = () => {
    return this.request('get_selection', {} as Record<string, never>);
  };

  clearSelection = () => {
    return this.request('clear_selection', {} as Record<string, never>);
  };

  getSceneSettings = () => {
    return this.request('get_scene_settings', {} as Record<string, never>);
  };

  setSceneSettings = (patch: Record<string, unknown>) => {
    return this.request('set_scene_settings', patch);
  };
}
