import { RPC, type Transport } from '@dcl/mini-rpc';
import type { EntityData } from '/shared/types/ipc';

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

export interface BlenderObjectData {
  name: string;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  gltfSrc?: string;
  entityId?: number;
  isDeleted?: boolean;
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
  EXPORT_SCENE_TRIGGER = 'export_scene_trigger',
  GET_SCENE_ENTITIES = 'get_scene_entities',
  CREATE_ENTITIES_FROM_BLENDER = 'create_entities_from_blender',
  CLEAN_BLENDER_ENTITIES = 'clean_blender_entities',
  REFRESH_ASSET_CATALOG = 'refresh_asset_catalog',
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
  [Method.EXPORT_SCENE_TRIGGER]: Record<string, never>;
  [Method.GET_SCENE_ENTITIES]: Record<string, never>;
  [Method.CREATE_ENTITIES_FROM_BLENDER]: { objects: BlenderObjectData[] };
  [Method.CLEAN_BLENDER_ENTITIES]: Record<string, never>;
  [Method.REFRESH_ASSET_CATALOG]: Record<string, never>;
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
  [Method.EXPORT_SCENE_TRIGGER]: void;
  [Method.GET_SCENE_ENTITIES]: { entities: EntityData[] };
  [Method.CREATE_ENTITIES_FROM_BLENDER]: { success: boolean; createdCount: number; updatedCount: number; deletedCount: number; error?: string };
  [Method.CLEAN_BLENDER_ENTITIES]: { success: boolean; deletedCount: number; deletedFiles: string[]; error?: string };
  [Method.REFRESH_ASSET_CATALOG]: void;
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

  exportSceneTrigger = () => {
    return this.request('export_scene_trigger', {});
  };

  getSceneEntities = () => {
    return this.request('get_scene_entities', {});
  };

  createEntitiesFromBlender = (objects: BlenderObjectData[]) => {
    return this.request('create_entities_from_blender', { objects });
  };

  cleanBlenderEntities = () => {
    return this.request('clean_blender_entities', {});
  };

  refreshAssetCatalog = () => {
    return this.request('refresh_asset_catalog', {});
  };
}
