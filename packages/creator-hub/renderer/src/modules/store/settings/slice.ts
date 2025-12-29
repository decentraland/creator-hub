import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { settings as settingsPreload } from '#preload';
import type { IpcRendererEvent } from 'electron';
import { actions as snackbarActions } from '../snackbar/slice';
import { t } from '../translation/utils';
import { createAsyncThunk } from '../thunk';
import type { Status } from '/shared/types/async';
import type { ReleaseNotes } from '/shared/types/settings';
import { ErrorBase } from '/shared/types/error';

export type UpdateErrorName = 'CHECK_TIMEOUT' | 'CHECK_FAILED';

export class UpdateError extends ErrorBase<UpdateErrorName> {
  constructor(
    public name: UpdateErrorName,
    public error?: Error,
  ) {
    super(name, error?.message || `Update error: ${name}`);
  }
}

export const isUpdateError = (
  error: unknown,
  type: UpdateErrorName | UpdateErrorName[] | '*',
): error is UpdateError =>
  error instanceof UpdateError &&
  (Array.isArray(type) ? type.includes(error.name) : type === '*' || error.name === type);

export type UpdateStatus = {
  lastDownloadedVersion: string | null;
  openNewUpdateModal: boolean;
  openAppSettingsModal: boolean;
  downloadingUpdate: {
    isDownloading: boolean;
    progress: number;
    finished: boolean;
    version: string | null;
    error: string | null;
  };
  updateInfo: {
    available: boolean;
    version: string | null;
    isDownloaded: boolean;
  };
  checkForUpdates: {
    status: Status;
  };
  releaseNotes: ReleaseNotes | null;
};

const initialState: UpdateStatus = {
  lastDownloadedVersion: null,
  openNewUpdateModal: false,
  openAppSettingsModal: false,
  downloadingUpdate: {
    isDownloading: false,
    progress: 0,
    finished: false,
    version: null,
    error: null,
  },
  updateInfo: {
    available: false,
    version: null,
    isDownloaded: false,
  },
  checkForUpdates: {
    status: 'idle',
  },
  releaseNotes: null,
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
    setOpenNewUpdateModal: (state, action: PayloadAction<boolean>) => {
      state.openNewUpdateModal = action.payload;
    },
    setOpenAppSettingsModal: (state, action: PayloadAction<boolean>) => {
      state.openAppSettingsModal = action.payload;
    },
    setReleaseNotes: (state, action: PayloadAction<ReleaseNotes | null>) => {
      state.releaseNotes = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(checkForUpdates.pending, state => {
        state.checkForUpdates.status = 'loading';
        state.updateInfo = initialState.updateInfo;
        state.releaseNotes = initialState.releaseNotes;
      })
      .addCase(checkForUpdates.fulfilled, (state, _action) => {
        state.checkForUpdates.status = 'succeeded';
      })
      .addCase(checkForUpdates.rejected, state => {
        state.checkForUpdates.status = 'failed';
        state.updateInfo = initialState.updateInfo;
      });
  },
});

export const setupUpdaterEvents = createAsyncThunk('settings/setupUpdaterEvents', async () => {
  settingsPreload.setupUpdaterEvents();
});

export const notifyUpdate = createAsyncThunk(
  'settings/notifyUpdate',
  async (_, { dispatch, getState }) => {
    const newVersion = await settingsPreload.getInstalledVersion();
    const currentVersion = getState().editor.version;
    if (newVersion && currentVersion === newVersion) {
      settingsPreload.deleteVersionFile();
      dispatch(
        snackbarActions.pushSnackbar({
          id: 'version-updated',
          message: `New version ${newVersion} installed`,
          severity: 'success',
          type: 'generic',
        }),
      );
    }
  },
);

export const checkForUpdates = createAsyncThunk(
  'settings/checkForUpdates',
  async ({ autoDownload = false }: { autoDownload?: boolean }, { dispatch, getState }) => {
    try {
      // add timeout to prevent hanging
      const checkPromise = settingsPreload.checkForUpdates({ autoDownload });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new UpdateError('CHECK_TIMEOUT')), 5000); // 5 second timeout
      });

      const result = await Promise.race([checkPromise, timeoutPromise]);

      // if result is null/undefined or version couldn't be determined, treat as failed check
      if (!result || result.version === null) {
        throw new UpdateError('CHECK_FAILED');
      }

      const { updateAvailable, version } = result;
      const lastDownloadedVersion = getState().settings.downloadingUpdate.version;
      dispatch(
        actions.setUpdateInfo({
          available: !!updateAvailable,
          version: version ?? null,
          isDownloaded: !!lastDownloadedVersion && lastDownloadedVersion === version,
        }),
      );

      if (updateAvailable) {
        if (version) {
          const releaseNotes = await settingsPreload.getReleaseNotes(version);
          if (releaseNotes) {
            dispatch(actions.setReleaseNotes(releaseNotes));
          }
        }
      } else {
        dispatch(
          snackbarActions.pushSnackbar({
            id: 'check-updates-success',
            message: t('modal.app_settings.version.up_to_date'),
            severity: 'success',
            type: 'generic',
          }),
        );
      }
    } catch (error: any) {
      const errorMessage = isUpdateError(error, 'CHECK_TIMEOUT')
        ? t('modal.app_settings.update.timeout')
        : t('modal.app_settings.update.error');

      dispatch(
        snackbarActions.pushSnackbar({
          id: 'check-updates-error',
          message: errorMessage,
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
  async (_, { dispatch, getState }) => {
    settingsPreload.downloadingStatus(
      (
        _event: IpcRendererEvent,
        progress: {
          percent: number;
          finished: boolean;
          version: string | null;
          isDownloading: boolean;
          error?: string;
        },
      ) => {
        if (progress.error) {
          return dispatch(
            snackbarActions.pushSnackbar({
              id: 'download-update-error',
              message: t('install.errors.installFailed'),
              severity: 'error',
              type: 'generic',
            }),
          );
        }

        if (progress.finished && progress.percent === 100) {
          !getState().settings.openAppSettingsModal &&
            dispatch(actions.setOpenNewUpdateModal(true));
          dispatch(actions.setlastDownloadedVersion(progress.version));
        }

        dispatch(
          actions.setDownloadingUpdate({
            isDownloading: progress.isDownloading,
            progress: progress.percent,
            finished: progress.finished,
            version: progress.version,
            error: progress.error ?? null,
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

export const installUpdate = createAsyncThunk(
  'settings/installUpdate',
  async (_, { dispatch, getState }) => {
    try {
      settingsPreload.quitAndInstall(getState().settings.downloadingUpdate.version ?? '');
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
  },
);

// exports
export const actions = {
  ...slice.actions,
  checkForUpdates,
  installUpdate,
  subscribeToDownloadingStatus,
  setupUpdaterEvents,
  notifyUpdate,
};

export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
