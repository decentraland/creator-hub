import { ScreenshotTools, Vector3 } from '@babylonjs/core';
import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { type Store } from '../../../redux/store';
import { type initRenderer } from '../../babylon/setup/init';
import type { AssetsTab, PanelName, SceneInspectorTab } from '../../../redux/ui/types';
import { setHasCustomCode } from '../../../redux/scene-metrics';

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
  EXPORT_SCENE_TRIGGER = 'export_scene_trigger',
  GET_SCENE_ENTITIES = 'get_scene_entities',
  CREATE_ENTITIES_FROM_BLENDER = 'create_entities_from_blender',
  CLEAN_BLENDER_ENTITIES = 'clean_blender_entities',
  REFRESH_ASSET_CATALOG = 'refresh_asset_catalog',
}

export interface EntityData {
  entityId: number;
  gltfSrc?: string;
  transform?: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; w: number };
    scale?: { x: number; y: number; z: number };
  };
  name?: string;
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
  [Method.EXPORT_SCENE_TRIGGER]: Record<string, never>;
  [Method.GET_SCENE_ENTITIES]: Record<string, never>;
  [Method.CREATE_ENTITIES_FROM_BLENDER]: { objects: BlenderObjectData[] };
  [Method.CLEAN_BLENDER_ENTITIES]: Record<string, never>;
  [Method.REFRESH_ASSET_CATALOG]: Record<string, never>;
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
  [Method.EXPORT_SCENE_TRIGGER]: void;
  [Method.GET_SCENE_ENTITIES]: { entities: EntityData[] };
  [Method.CREATE_ENTITIES_FROM_BLENDER]: { success: boolean; createdCount: number; updatedCount: number; deletedCount: number; error?: string };
  [Method.CLEAN_BLENDER_ENTITIES]: { success: boolean; deletedCount: number; deletedFiles: string[]; error?: string };
  [Method.REFRESH_ASSET_CATALOG]: void;
};

export class SceneServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, store: Store, renderer: ReturnType<typeof initRenderer>) {
    super('SceneRpcInbound', transport);
    const camera = renderer.editorCamera.getCamera();

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

    this.handle('set_scene_custom_code', async ({ hasCustomCode }) => {
      store.dispatch(setHasCustomCode(hasCustomCode));
    });

    this.handle('export_scene_trigger', async () => {
      // Dispatch a custom event that the ExportGltf component can listen to
      window.dispatchEvent(new CustomEvent('trigger-export-scene'));
    });

    this.handle('get_scene_entities', async () => {
      // Return entity data collected from the scene
      // This will be implemented by listening to an event that collects entity data
      return new Promise((resolve) => {
        const handleEntitiesCollected = (event: CustomEvent) => {
          window.removeEventListener('scene-entities-collected', handleEntitiesCollected as EventListener);
          resolve({ entities: event.detail.entities || [] });
        };

        window.addEventListener('scene-entities-collected', handleEntitiesCollected as EventListener);
        window.dispatchEvent(new CustomEvent('collect-scene-entities'));

        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('scene-entities-collected', handleEntitiesCollected as EventListener);
          resolve({ entities: [] });
        }, 5000);
      });
    });

    this.handle('create_entities_from_blender', async ({ objects }) => {
      // Create entities from Blender objects
      return new Promise((resolve) => {
        const handleEntitiesCreated = (event: CustomEvent) => {
          window.removeEventListener('blender-entities-created', handleEntitiesCreated as EventListener);
          resolve(event.detail);
        };

        window.addEventListener('blender-entities-created', handleEntitiesCreated as EventListener);
        window.dispatchEvent(new CustomEvent('create-blender-entities', { detail: { objects } }));

        // Timeout after 10 seconds
        setTimeout(() => {
          window.removeEventListener('blender-entities-created', handleEntitiesCreated as EventListener);
          resolve({ success: false, createdCount: 0, updatedCount: 0, deletedCount: 0, error: 'Timeout creating entities' });
        }, 10000);
      });
    });

    this.handle('clean_blender_entities', async () => {
      // Clean all Blender entities and assets
      return new Promise((resolve) => {
        const handleCleaned = (event: CustomEvent) => {
          window.removeEventListener('blender-entities-cleaned', handleCleaned as EventListener);
          resolve(event.detail);
        };

        window.addEventListener('blender-entities-cleaned', handleCleaned as EventListener);
        window.dispatchEvent(new CustomEvent('clean-blender-entities'));

        // Timeout after 10 seconds
        setTimeout(() => {
          window.removeEventListener('blender-entities-cleaned', handleCleaned as EventListener);
          resolve({ success: false, deletedCount: 0, deletedFiles: [], error: 'Timeout cleaning entities' });
        }, 10000);
      });
    });

    this.handle('refresh_asset_catalog', async () => {
      // Trigger asset catalog refresh in the Inspector
      console.log('[Scene RPC] Refreshing asset catalog...');
      store.dispatch({ type: 'data-layer/getAssetCatalog' });
    });
  }
}
