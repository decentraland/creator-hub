import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export const SCENE_DESCRIPTION_FILE = 'scene_description.md';

export interface SceneInfoState {
  content: string;
  isLoading: boolean;
  error: string | null;
  openedInPreviousSession: boolean | null;
}

export const initialState: SceneInfoState = {
  content: '',
  isLoading: false,
  error: null,
  openedInPreviousSession: null,
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
    setSceneInfoOpenedInPreviousSession: (state, { payload }: PayloadAction<boolean | null>) => {
      state.openedInPreviousSession = payload;
    },
    initializeSceneInfoPanel: () => {},
    toggleInfoPanel: (state, { payload }: PayloadAction<boolean>) => {
      state.openedInPreviousSession = payload;
    },
  },
});

// Actions
export const {
  getSceneInfoContent,
  saveSceneInfoContent,
  setSceneInfoContent,
  setSceneInfoLoading,
  setSceneInfoError,
  setSceneInfoOpenedInPreviousSession,
  initializeSceneInfoPanel,
  toggleInfoPanel,
} = sceneInfo.actions;

// Selectors
export const selectSceneInfo = (state: RootState): SceneInfoState => state.sceneInfo;

// Reducer
export default sceneInfo.reducer;
