import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { PanelName } from './types';
import { AssetsTab, SceneInspectorTab } from './types';

export interface UiState {
  hiddenComponents: Record<string, boolean>;
  hiddenPanels: Partial<Record<PanelName, boolean>>;
  disableGizmos: boolean;
  disableGroundGrid: boolean;
  selectedAssetsTab: AssetsTab;
  selectedSceneInspectorTab: SceneInspectorTab;
  hiddenSceneInspectorTabs: Partial<Record<SceneInspectorTab, boolean>>;
  debugConsoleEnabled: boolean;
  debugConsoleLogs: string[];
}

export const initialState: UiState = {
  hiddenComponents: {},
  hiddenPanels: {},
  disableGizmos: false,
  disableGroundGrid: false,
  selectedAssetsTab: AssetsTab.AssetsPack,
  selectedSceneInspectorTab: SceneInspectorTab.DETAILS,
  hiddenSceneInspectorTabs: {},
  debugConsoleEnabled: false,
  debugConsoleLogs: [],
};

export const appState = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleComponent: (
      state,
      { payload }: PayloadAction<{ component: string; enabled: boolean }>,
    ) => {
      const { component, enabled } = payload;
      state.hiddenComponents[component] = !enabled;
    },
    togglePanel: (state, { payload }: PayloadAction<{ panel: PanelName; enabled: boolean }>) => {
      const { panel, enabled } = payload;
      state.hiddenPanels[panel] = !enabled;
    },
    toggleGizmos: (state, { payload }: PayloadAction<{ enabled: boolean }>) => {
      const { enabled } = payload;
      state.disableGizmos = !enabled;
    },
    toggleGroundGrid: (state, { payload }: PayloadAction<{ enabled: boolean }>) => {
      const { enabled } = payload;
      state.disableGroundGrid = !enabled;
    },
    selectAssetsTab: (state, { payload }: PayloadAction<{ tab: AssetsTab }>) => {
      const { tab } = payload;
      state.selectedAssetsTab = tab;
    },
    selectSceneInspectorTab: (state, { payload }: PayloadAction<{ tab: SceneInspectorTab }>) => {
      const { tab } = payload;
      state.selectedSceneInspectorTab = tab;
    },
    toggleSceneInspectorTab: (
      state,
      { payload }: PayloadAction<{ tab: SceneInspectorTab; enabled: boolean }>,
    ) => {
      const { tab, enabled } = payload;
      state.hiddenSceneInspectorTabs[tab] = !enabled;
    },
    setDebugConsoleEnabled: (state, { payload }: PayloadAction<{ enabled: boolean }>) => {
      state.debugConsoleEnabled = payload.enabled;
      if (!payload.enabled) {
        state.debugConsoleLogs = [];
      }
    },
    pushDebugLogs: (state, { payload }: PayloadAction<{ logs: string[] }>) => {
      const combined = state.debugConsoleLogs.concat(payload.logs);
      state.debugConsoleLogs = combined.length > 1000 ? combined.slice(-1000) : combined;
    },
    clearDebugLogs: state => {
      state.debugConsoleLogs = [];
    },
  },
});

// Actions
export const {
  toggleComponent,
  togglePanel,
  toggleGizmos,
  toggleGroundGrid,
  selectAssetsTab,
  selectSceneInspectorTab,
  toggleSceneInspectorTab,
  setDebugConsoleEnabled,
  pushDebugLogs,
  clearDebugLogs,
} = appState.actions;

// Selectors
export const getHiddenComponents = (state: RootState): Record<string, boolean> =>
  state.ui.hiddenComponents;
export const getHiddenPanels = (state: RootState): Partial<Record<PanelName, boolean>> =>
  state.ui.hiddenPanels;
export const getSelectedAssetsTab = (state: RootState) => state.ui.selectedAssetsTab;
export const getSelectedSceneInspectorTab = (state: RootState) =>
  state.ui.selectedSceneInspectorTab;
export const getHiddenSceneInspectorTabs = (state: RootState) => state.ui.hiddenSceneInspectorTabs;
export const areGizmosDisabled = (state: RootState) => state.ui.disableGizmos;
export const isGroundGridDisabled = (state: RootState) => state.ui.disableGroundGrid;
export const getDebugConsoleEnabled = (state: RootState) => state.ui.debugConsoleEnabled;
export const getDebugConsoleLogs = (state: RootState) => state.ui.debugConsoleLogs;

// Reducer
export default appState.reducer;
