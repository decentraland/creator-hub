import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { InspectorPreferences } from '../../lib/logic/preferences/types';
import type {
  AssetCatalogResponse,
  GetFilesResponse,
} from '../../lib/data-layer/remote-data-layer';
import type { CustomAsset } from '../../lib/logic/catalog';

export interface AppState {
  canSave: boolean;
  preferences: InspectorPreferences | undefined;
  assetsCatalog: AssetCatalogResponse | undefined;
  thumbnails: GetFilesResponse['files'];
  customAssets: CustomAsset[];
}

export const initialState: AppState = {
  // dirty engine
  canSave: false,
  preferences: undefined,
  assetsCatalog: undefined,
  thumbnails: [],
  customAssets: [],
};

export const appState = createSlice({
  name: 'app-state',
  initialState,
  reducers: {
    updateCanSave: (state, { payload }: PayloadAction<{ dirty: boolean }>) => {
      // TODO: this should check for autoSaveEnabled: !sdk?.preferences.data.autosaveEnabled
      const isDirty = !state.preferences?.autosaveEnabled && payload.dirty;
      state.canSave = isDirty;
    },
    updatePreferences: (
      state,
      { payload }: PayloadAction<{ preferences: InspectorPreferences }>,
    ) => {
      state.preferences = payload.preferences;
    },
    updateAssetCatalog: (
      state,
      { payload }: PayloadAction<{ assets: AssetCatalogResponse; customAssets: CustomAsset[] }>,
    ) => {
      state.assetsCatalog = payload.assets;
      state.customAssets = payload.customAssets;
    },
    updateThumbnails: (state, { payload }: PayloadAction<GetFilesResponse>) => {
      state.thumbnails = payload.files;
    },
  },
});

// Actions
export const { updateCanSave, updatePreferences, updateAssetCatalog, updateThumbnails } =
  appState.actions;

// Selectors
export const selectCanSave = (state: RootState): boolean => state.app.canSave;
export const selectInspectorPreferences = (state: RootState): InspectorPreferences | undefined => {
  return state.app.preferences;
};
export const selectAssetCatalog = (state: RootState) => state.app.assetsCatalog;
export const selectThumbnails = (state: RootState) => state.app.thumbnails;
export const selectCustomAssets = (state: RootState) => state.app.customAssets;

// Reducer
export default appState.reducer;
