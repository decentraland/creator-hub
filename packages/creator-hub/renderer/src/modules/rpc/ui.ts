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
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
}

export type Params = {
  [Method.TOGGLE_COMPONENT]: { component: string; enabled: boolean };
  [Method.TOGGLE_PANEL]: { panel: `${PanelName}`; enabled: boolean };
  [Method.TOGGLE_GIZMOS]: { enabled: boolean };
  [Method.SELECT_ASSETS_TAB]: { tab: `${AssetsTab}` };
  [Method.SELECT_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}` };
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}`; enabled: boolean };
  [Method.TOGGLE_GROUND_GRID]: { enabled: boolean };
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string };
};

export type Result = {
  [Method.TOGGLE_COMPONENT]: void;
  [Method.TOGGLE_PANEL]: void;
  [Method.TOGGLE_GIZMOS]: void;
  [Method.SELECT_ASSETS_TAB]: void;
  [Method.SELECT_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_GROUND_GRID]: void;
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
};

export class UiRPC extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('UiRPC', transport);
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

  openFile = (path: string) => {
    return this.request('open_file', { path });
  };

  openDirectory = (path: string) => {
    return this.request('open_directory', { path });
  };
}
