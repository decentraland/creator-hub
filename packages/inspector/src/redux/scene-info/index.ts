import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export const SCENE_INFO_FILE = 'SCENE_README.md';

export interface SceneInfoState {
  content: string;
  isLoading: boolean;
  error: string | null;
}

export const initialState: SceneInfoState = {
  content: '',
  isLoading: false,
  error: null,
};

export const sceneInfo = createSlice({
  name: 'scene-info',
  initialState,
  reducers: {
    getSceneInfoContent: () => {},
    saveSceneInfoContent: (_state, { payload: _ }: PayloadAction<string>) => {},
    setSceneInfoContent: (state, { payload }: PayloadAction<string>) => {
      state.content = payload;
      state.error = null;
    },
    setSceneInfoLoading: (state, { payload }: PayloadAction<boolean>) => {
      state.isLoading = payload;
    },
    setSceneInfoError: (state, { payload }: PayloadAction<string | null>) => {
      state.error = payload;
    },
    initializeSceneInfoPanel: () => {},
    toggleInfoPanel: (_state, { payload: _ }: PayloadAction<boolean>) => {},
  },
});

// Actions
export const {
  getSceneInfoContent,
  saveSceneInfoContent,
  setSceneInfoContent,
  setSceneInfoLoading,
  setSceneInfoError,
  initializeSceneInfoPanel,
  toggleInfoPanel,
} = sceneInfo.actions;

// Selectors
export const selectSceneInfo = (state: RootState): SceneInfoState => state.sceneInfo;

// Reducer
export default sceneInfo.reducer;
