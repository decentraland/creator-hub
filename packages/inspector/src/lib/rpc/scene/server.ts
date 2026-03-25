import { ScreenshotTools, Vector3 } from '@babylonjs/core';
import type { IEngine } from '@dcl/ecs';
import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import { type Store } from '../../../redux/store';
import { type initRenderer } from '../../babylon/setup/init';
import type { AssetsTab, PanelName, SceneInspectorTab } from '../../../redux/ui/types';
import { setHasCustomCode, toggleMetricsVisible } from '../../../redux/scene-metrics';
import { setDebugConsoleEnabled } from '../../../redux/ui';
import * as debugLogStore from '../../logic/debug-log-store';
import { setFeatureFlags } from '../../../redux/feature-flags';
import { undo, redo } from '../../../redux/data-layer';
import { createOperations } from '../../sdk/operations';
import type { EditorComponents } from '../../sdk/components';

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
  UNDO = 'undo',
  REDO = 'redo',
  EDIT_SCENE = 'edit_scene',
  TOGGLE_SCENE_INFO = 'toggle_scene_info',
  TOGGLE_METRICS = 'toggle_metrics',
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
  [Method.UNDO]: void;
  [Method.REDO]: void;
  [Method.EDIT_SCENE]: void;
  [Method.TOGGLE_SCENE_INFO]: void;
  [Method.TOGGLE_METRICS]: void;
};

export class SceneServer extends RPC<Method, Params, Result> {
  constructor(
    transport: Transport,
    store: Store,
    renderer: ReturnType<typeof initRenderer>,
    engine: IEngine,
    components: Pick<EditorComponents, 'InspectorUIState'>,
  ) {
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

    this.handle('undo', async () => {
      store.dispatch(undo());
    });

    this.handle('redo', async () => {
      store.dispatch(redo());
    });

    const operations = createOperations(engine);

    this.handle('edit_scene', async () => {
      operations.updateSelectedEntity(engine.RootEntity, false);
      await operations.dispatch();
    });

    this.handle('toggle_metrics', async () => {
      store.dispatch(toggleMetricsVisible());
    });

    this.handle('toggle_scene_info', async () => {
      const currentState = components.InspectorUIState.getOrNull(engine.RootEntity) || {};
      components.InspectorUIState.createOrReplace(engine.RootEntity, {
        ...currentState,
        sceneInfoPanelVisible: !currentState.sceneInfoPanelVisible,
      });
      await operations.dispatch();
    });
  }
}
