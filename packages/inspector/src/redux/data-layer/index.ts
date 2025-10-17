import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AssetData } from '@dcl/asset-packs';
import type { Entity } from '@dcl/ecs';
import type { RootState } from '../../redux/store';
import type { DataLayerRpcClient } from '../../lib/data-layer/types';
import type { InspectorPreferences } from '../../lib/logic/preferences/types';
import type {
  Asset,
  ImportAssetRequest,
  SaveFileRequest,
} from '../../lib/data-layer/remote-data-layer';
import type { AssetsTab } from '../ui/types';

export enum ErrorType {
  Disconnected = 'disconnected',
  Reconnecting = 'reconnecting',
  Save = 'save',
  GetPreferences = 'get-preferences',
  SetPreferences = 'set-preferences',
  GetAssetCatalog = 'get-asset-catalog',
  Undo = 'undo',
  Redo = 'redo',
  ImportAsset = 'import-asset',
  RemoveAsset = 'remove-asset',
  SaveThumbnail = 'save-thumbnail',
  GetThumbnails = 'get-thumbnails',
  CreateCustomAsset = 'create-custom-asset',
  DeleteCustomAsset = 'delete-custom-asset',
  RenameCustomAsset = 'rename-custom-asset',
}

let dataLayerInterface: DataLayerRpcClient | undefined;
export type IDataLayer = Readonly<DataLayerRpcClient | undefined>;

// We cant serialize this Client because it has methods
export function getDataLayerInterface(): IDataLayer {
  return dataLayerInterface;
}

export interface DataLayerState {
  reconnectAttempts: number;
  error: ErrorType | undefined;
  removingAsset: Record<string, boolean>;
  reloadAssets: string[];
  assetToRename: { id: string; name: string } | undefined;
  stagedCustomAsset:
    | { entities: Entity[]; previousTab: AssetsTab; initialName: string }
    | undefined;
  undoRedoState: {
    canUndo: boolean;
    canRedo: boolean;
  };
}

export const initialState: DataLayerState = {
  reconnectAttempts: 0,
  error: undefined,
  removingAsset: {},
  reloadAssets: [],
  assetToRename: undefined,
  stagedCustomAsset: undefined,
  undoRedoState: {
    canUndo: false,
    canRedo: false,
  },
};

export const dataLayer = createSlice({
  name: 'data-layer',
  initialState,
  reducers: {
    connect: state => {
      state.reconnectAttempts++;
      console.log('[WS] Connecting');
    },
    reconnect: state => {
      console.log('[WS] Reconnecting');
      state.error = ErrorType.Reconnecting;
      dataLayerInterface = undefined;
    },
    connected: (state, { payload }: PayloadAction<{ dataLayer: IDataLayer }>) => {
      console.log('[WS] Connected');
      dataLayerInterface = payload.dataLayer;
      state.reconnectAttempts = 0;
      state.error = undefined;
    },
    error: (state, { payload }: PayloadAction<{ error: ErrorType }>) => {
      console.log('[WS] Error', payload.error);
      state.error = payload.error;
    },
    save: () => {},
    getInspectorPreferences: () => {},
    setInspectorPreferences: (_state, _payload: PayloadAction<Partial<InspectorPreferences>>) => {},
    getAssetCatalog: () => {},
    undo: () => {},
    redo: () => {},
    refreshUndoRedoState: () => {},
    importAsset: (state, payload: PayloadAction<ImportAssetRequest & { reload?: boolean }>) => {
      const { reload, ...importAssetRequest } = payload.payload;
      state.reloadAssets = reload ? Array.from(importAssetRequest.content.keys()) : [];
    },
    removeAsset: (state, payload: PayloadAction<Asset>) => {
      state.removingAsset[payload.payload.path] = true;
    },
    clearRemoveAsset: (state, payload: PayloadAction<Asset>) => {
      delete state.removingAsset[payload.payload.path];
    },
    saveThumbnail: (_state, _payload: PayloadAction<SaveFileRequest>) => {},
    getThumbnails: () => {},
    createCustomAsset: (
      _state,
      _payload: PayloadAction<{
        name: string;
        composite: AssetData['composite'];
        resources: string[];
        thumbnail?: string;
      }>,
    ) => {},
    deleteCustomAsset: (_state, _payload: PayloadAction<{ assetId: string }>) => {},
    renameCustomAsset: (state, _payload: PayloadAction<{ assetId: string; newName: string }>) => {
      state.assetToRename = undefined;
    },
    setAssetToRename: (state, payload: PayloadAction<{ assetId: string; name: string }>) => {
      state.assetToRename = { id: payload.payload.assetId, name: payload.payload.name };
    },
    clearAssetToRename: state => {
      state.assetToRename = undefined;
    },
    stageCustomAsset: (
      state,
      payload: PayloadAction<{ entities: Entity[]; previousTab: AssetsTab; initialName: string }>,
    ) => {
      state.stagedCustomAsset = payload.payload;
    },
    clearStagedCustomAsset: state => {
      state.stagedCustomAsset = undefined;
    },
    updateUndoRedoState: (
      state,
      payload: PayloadAction<{ canUndo: boolean; canRedo: boolean }>,
    ) => {
      state.undoRedoState = payload.payload;
    },
    openFile: (_state, _payload: PayloadAction<{ path: string }>) => {},
  },
});

// Actions
export const {
  connect,
  connected,
  reconnect,
  error,
  save,
  getInspectorPreferences,
  setInspectorPreferences,
  getAssetCatalog,
  undo,
  redo,
  refreshUndoRedoState,
  importAsset,
  removeAsset,
  clearRemoveAsset,
  saveThumbnail,
  getThumbnails,
  createCustomAsset,
  deleteCustomAsset,
  renameCustomAsset,
  setAssetToRename,
  clearAssetToRename,
  stageCustomAsset,
  clearStagedCustomAsset,
  updateUndoRedoState,
  openFile,
} = dataLayer.actions;

// Selectors
export const selectDataLayerError = (state: RootState) => state.dataLayer.error;
export const selectDataLayerReconnectAttempts = (state: RootState) =>
  state.dataLayer.reconnectAttempts;
export const selectDataLayerRemovingAsset = (state: RootState) => state.dataLayer.removingAsset;
export const getReloadAssets = (state: RootState) => state.dataLayer.reloadAssets;
export const selectAssetToRename = (state: RootState) => state.dataLayer.assetToRename;
export const selectStagedCustomAsset = (state: RootState) => state.dataLayer.stagedCustomAsset;
export const selectCanUndo = (state: RootState) => state.dataLayer.undoRedoState.canUndo;
export const selectCanRedo = (state: RootState) => state.dataLayer.undoRedoState.canRedo;

// Reducer
export default dataLayer.reducer;
