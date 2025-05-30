import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { settings as settingsPreload } from '#preload';
import type { IpcRendererEvent } from 'electron';
import { actions as snackbarActions } from '../snackbar/slice';
import { t } from '../translation/utils';

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
  },
});

export const checkForUpdates = createAsyncThunk(
  'settings/checkForUpdates',
  async ({ autoDownload = false }: { autoDownload?: boolean }, { dispatch }) => {
    try {
      const { updateAvailable, version } = await settingsPreload.checkForUpdates({
        autoDownload,
      });
      const lastDownloadedVersion = await settingsPreload.getDownloadedVersion();
      dispatch(actions.setlastDownloadedVersion(lastDownloadedVersion));
      dispatch(
        actions.setUpdateInfo({
          available: !!updateAvailable,
          version: version ?? null,
          isInstalled: !!lastDownloadedVersion && lastDownloadedVersion === version,
        }),
      );
    } catch (error: any) {
      dispatch(
        snackbarActions.pushSnackbar({
          id: 'check-updates-error',
          message: t('install.errors.checkUpdatesFailed'),
          severity: 'error',
          type: 'generic',
        }),
      );
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
          actions.setDownloadingUpdate({
            isDownloading: true,
            progress: downloadStatus.percent,
            finished: downloadStatus.finished,
          }),
        );
      },
    );
  },
);

export const downloadUpdate = createAsyncThunk(
  'settings/downloadUpdate',
  async (_, { dispatch }) => {
    try {
      await settingsPreload.downloadUpdate();
      dispatch(checkForUpdates({ autoDownload: false }));
    } catch (error) {
      dispatch(
        snackbarActions.pushSnackbar({
          id: 'download-update-error',
          message: t('install.errors.downloadFailed'),
          severity: 'error',
          type: 'generic',
        }),
      );
      throw error;
    }
  },
);

export const installUpdate = createAsyncThunk('settings/installUpdate', async (_, { dispatch }) => {
  try {
    dispatch(actions.setDownloadingUpdate({ isDownloading: false, progress: 0, finished: false }));
    settingsPreload.quitAndInstall();
  } catch (error) {
    dispatch(
      snackbarActions.pushSnackbar({
        id: 'install-update-error',
        message: t('install.errors.installFailed'),
        severity: 'error',
        type: 'generic',
      }),
    );
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
