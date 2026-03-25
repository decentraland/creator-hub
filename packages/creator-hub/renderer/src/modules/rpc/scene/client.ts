import { RPC, type Transport } from '@dcl/mini-rpc';

export enum AssetsTab {
  FileSystem = 'FileSystem',
  AssetsPack = 'AssetsPack',
  Import = 'Import',
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
  UNDO = 'undo',
  REDO = 'redo',
  EDIT_SCENE = 'edit_scene',
  TOGGLE_SCENE_INFO = 'toggle_scene_info',
  TOGGLE_METRICS = 'toggle_metrics',
}

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
  [Method.UNDO]: Record<string, never>;
  [Method.REDO]: Record<string, never>;
  [Method.EDIT_SCENE]: Record<string, never>;
  [Method.TOGGLE_SCENE_INFO]: Record<string, never>;
  [Method.TOGGLE_METRICS]: Record<string, never>;
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
  [Method.UNDO]: void;
  [Method.REDO]: void;
  [Method.EDIT_SCENE]: void;
  [Method.TOGGLE_SCENE_INFO]: void;
  [Method.TOGGLE_METRICS]: void;
};

export class SceneRpcClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('SceneRpcInbound', transport);
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

  undo = () => {
    return this.request('undo', {} as Record<string, never>);
  };

  redo = () => {
    return this.request('redo', {} as Record<string, never>);
  };

  editScene = () => {
    return this.request('edit_scene', {} as Record<string, never>);
  };

  toggleSceneInfo = () => {
    return this.request('toggle_scene_info', {} as Record<string, never>);
  };

  toggleMetrics = () => {
    return this.request('toggle_metrics', {} as Record<string, never>);
  };
}
