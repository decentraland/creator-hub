import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { settings as settingsPreload } from '#preload';
import type { IpcRendererEvent } from 'electron';

// Types
export type UpdateStatus = {
  lastDownloadedVersion: string | null;
  downloadingUpdate: {
    isDownloading: boolean;
    progress: number;
    finished: boolean;
  };
  updateInfo: {
    available: boolean;
    version: string | null;
    isInstalled: boolean;
  };
};

// Initial State
const initialState: UpdateStatus = {
  lastDownloadedVersion: null,
  downloadingUpdate: {
    isDownloading: false,
    progress: 0,
    finished: false,
  },
  updateInfo: {
    available: false,
    version: null,
    isInstalled: false,
  },
};

// Slice
const slice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setlastDownloadedVersion: (state, action: PayloadAction<string | null>) => {
      state.lastDownloadedVersion = action.payload;
    },
    setDownloadingUpdate: (state, action: PayloadAction<UpdateStatus['downloadingUpdate']>) => {
      state.downloadingUpdate = action.payload;
    },
    setUpdateInfo: (state, action: PayloadAction<UpdateStatus['updateInfo']>) => {
      state.updateInfo = action.payload;
    },
    resetUpdateState: state => {
      state.downloadingUpdate = { isDownloading: false, progress: 0, finished: false };
    },
  },
});

// Actions
export const { setlastDownloadedVersion, setDownloadingUpdate, setUpdateInfo, resetUpdateState } =
  slice.actions;

export const checkForUpdates = createAsyncThunk(
  'settings/checkForUpdates',
  async ({ autoDownload = false }: { autoDownload?: boolean }, { dispatch }) => {
    console.log('dispatching check for updates', autoDownload);
    try {
      const { updateAvailable, version } = await settingsPreload.checkForUpdates({
        autoDownload,
      });
      const lastDownloadedVersion = await settingsPreload.getDownloadedVersion();

      dispatch(setlastDownloadedVersion(lastDownloadedVersion));
      dispatch(
        setUpdateInfo({
          available: !!updateAvailable,
          version: version ?? null,
          isInstalled: !!lastDownloadedVersion && lastDownloadedVersion === version,
        }),
      );
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  },
);

export const subscribeToDownloadingStatus = createAsyncThunk(
  'settings/subscribeToDownloadingStatus',
  async (_, { dispatch }) => {
    settingsPreload.downloadingStatus(
      (_event: IpcRendererEvent, downloadStatus: { percent: number; finished: boolean }) => {
        dispatch(
          setDownloadingUpdate({
            isDownloading: true,
            progress: downloadStatus.percent,
            finished: downloadStatus.finished,
          }),
        );
      },
    );
  },
);

// export const downloadUpdate = createAsyncThunk(
//   'settings/downloadUpdate',
//   async (_, { dispatch }) => {
//     try {
//       await settingsPreload.downloadUpdate();
//       const lastDownloadedVersion = await settingsPreload.getDownloadedVersion();
//       dispatch(setlastDownloadedVersion(lastDownloadedVersion));
//       dispatch(
//         setUpdateInfo({
//           available: true,
//           version: lastDownloadedVersion,
//           isInstalled: true,
//         }),
//       );
//       return lastDownloadedVersion;
//     } catch (error) {
//       console.error('Error downloading update:', error);
//       throw error;
//     }
//   },
// );

export const installUpdate = createAsyncThunk('settings/installUpdate', async (_, { dispatch }) => {
  try {
    dispatch(setDownloadingUpdate({ isDownloading: false, progress: 0, finished: false }));
    await settingsPreload.quitAndInstall();
  } catch (error) {
    console.error('Error installing update:', error);
    throw error;
  }
});

// exports
export const actions = {
  ...slice.actions,
  checkForUpdates,
  installUpdate,
  subscribeToDownloadingStatus,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
