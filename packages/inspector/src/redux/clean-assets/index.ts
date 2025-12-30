import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export type RemovedFile = {
  path: string;
  content: Uint8Array;
};

export interface CleanAssetsState {
  removedFiles: RemovedFile[];
}

const MAX_RECOVERY_SIZE = 50 * 1024 * 1024; // 50MB

export const initialState: CleanAssetsState = {
  removedFiles: [],
};

export const cleanAssetsSlice = createSlice({
  name: 'cleanAssets',
  initialState,
  reducers: {
    setRemovedFiles: (state, { payload }: PayloadAction<RemovedFile[]>) => {
      // Filter files to stay within the size cap
      let totalSize = 0;
      const filtered = payload.filter(file => {
        const fileSize = file.content.byteLength;
        if (totalSize + fileSize <= MAX_RECOVERY_SIZE) {
          totalSize += fileSize;
          return true;
        }
        return false;
      });
      state.removedFiles = filtered;
    },
    clearRemovedFiles: state => {
      state.removedFiles = [];
    },
  },
});

// Actions
export const { setRemovedFiles, clearRemovedFiles } = cleanAssetsSlice.actions;

// Selectors
export const selectRemovedFiles = (state: RootState): RemovedFile[] =>
  state.cleanAssets.removedFiles;
export const selectHasRecoverableFiles = (state: RootState): boolean =>
  state.cleanAssets.removedFiles.length > 0;

// Reducer
export default cleanAssetsSlice.reducer;
