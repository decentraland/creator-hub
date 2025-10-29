import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import type { AssetsTab, PanelName, SceneInspectorTab } from '../../../redux/ui/types';
import { name, type Method, type Params, type Result } from './types';

export class UiClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super(name, transport);
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
