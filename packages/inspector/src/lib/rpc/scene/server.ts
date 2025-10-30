import { ScreenshotTools, Vector3 } from '@babylonjs/core';
import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { type Store } from '../../../redux/store';
import { type initRenderer } from '../../babylon/setup/init';
import type { AssetsTab, PanelName, SceneInspectorTab } from '../../../redux/ui/types';

enum Method {
  TOGGLE_COMPONENT = 'toggle_component',
  TOGGLE_PANEL = 'toggle_panel',
  TOGGLE_GIZMOS = 'toggle_gizmos',
  SELECT_ASSETS_TAB = 'select_assets_tab',
  SELECT_SCENE_INSPECTOR_TAB = 'select_scene_inspector_tab',
  TOGGLE_SCENE_INSPECTOR_TAB = 'toggle_scene_inspector_tab',
  TOGGLE_GROUND_GRID = 'toggle_ground_grid',
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  SET_POSITION = 'set_position',
  SET_TARGET = 'set_target',
  TAKE_SCREENSHOT = 'take_screenshot',
}

type Params = {
  [Method.TOGGLE_COMPONENT]: { component: string; enabled: boolean };
  [Method.TOGGLE_PANEL]: { panel: `${PanelName}`; enabled: boolean };
  [Method.TOGGLE_GIZMOS]: { enabled: boolean };
  [Method.SELECT_ASSETS_TAB]: { tab: `${AssetsTab}` };
  [Method.SELECT_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}` };
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: { tab: `${SceneInspectorTab}`; enabled: boolean };
  [Method.TOGGLE_GROUND_GRID]: { enabled: boolean };
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string };
  [Method.SET_POSITION]: { x: number; y: number; z: number };
  [Method.SET_TARGET]: { x: number; y: number; z: number };
  [Method.TAKE_SCREENSHOT]: { width: number; height: number; precision?: number };
};

type Result = {
  [Method.TOGGLE_COMPONENT]: void;
  [Method.TOGGLE_PANEL]: void;
  [Method.TOGGLE_GIZMOS]: void;
  [Method.SELECT_ASSETS_TAB]: void;
  [Method.SELECT_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_SCENE_INSPECTOR_TAB]: void;
  [Method.TOGGLE_GROUND_GRID]: void;
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.SET_POSITION]: void;
  [Method.SET_TARGET]: void;
  [Method.TAKE_SCREENSHOT]: string;
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

    this.handle('set_position', async ({ x, y, z }) => {
      camera.position.set(x, y, z);
    });

    this.handle('set_target', async ({ x, y, z }) => {
      camera.setTarget(new Vector3(x, y, z));
    });

    this.handle('take_screenshot', async ({ width, height, precision }) => {
      return ScreenshotTools.CreateScreenshotAsync(renderer.engine, camera, {
        width,
        height,
        precision,
      });
    });
  }
}
