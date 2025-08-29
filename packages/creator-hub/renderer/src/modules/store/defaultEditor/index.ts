import { createSlice } from '@reduxjs/toolkit';
import { t } from '../translation/utils';
import { createAsyncThunk } from '../thunk';
import { actions as snackbarActions } from '../snackbar/slice';
import type { EditorConfig } from '/shared/types/config';
import { settings as settingsApi } from '#preload';

export type DefaultEditorState = {
  editors: EditorConfig[];
  loading: boolean;
  error: string | null;
};

const initialState: DefaultEditorState = {
  editors: [],
  loading: false,
  error: null,
};

export const loadEditors = createAsyncThunk('defaultEditor/load', async (_, { dispatch }) => {
  try {
    return await settingsApi.getEditors();
  } catch (error) {
    dispatch(
      snackbarActions.pushSnackbar({
        id: 'load-editors-error',
        type: 'generic',
        severity: 'error',
        message: t('modal.app_settings.fields.code_editor.errors.set'),
      }),
    );
    throw error;
  }
});

export const setDefaultEditor = createAsyncThunk(
  'defaultEditor/setDefault',
  async (editorPath: string, { dispatch }) => {
    try {
      return await settingsApi.setDefaultEditor(editorPath);
    } catch (error: any) {
      let errorKey = 'unknown';
      if (error.message.includes('invalid_app_extension')) {
        errorKey = 'invalid_app_extension';
      } else if (error.message.includes('invalid_app_bundle')) {
        errorKey = 'invalid_app_bundle';
      } else if (error.message.includes('invalid_exe_file')) {
        errorKey = 'invalid_exe_file';
      }
      dispatch(
        snackbarActions.pushSnackbar({
          id: 'set-default-editor-error',
          type: 'generic',
          severity: 'error',
          message: t(('modal.app_settings.fields.code_editor.errors.' + errorKey) as any),
        }),
      );
      throw error;
    }
  },
);

const slice = createSlice({
  name: 'defaultEditor',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(loadEditors.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadEditors.fulfilled, (state, action) => {
        state.editors = action.payload;
        state.loading = false;
      })
      .addCase(loadEditors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load editors';
      })
      .addCase(setDefaultEditor.fulfilled, (state, action) => {
        state.editors = action.payload;
      })
      .addCase(setDefaultEditor.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to set default editor';
      });
  },
});

export const actions = {
  ...slice.actions,
  loadEditors,
  setDefaultEditor,
};

export const reducer = slice.reducer;
