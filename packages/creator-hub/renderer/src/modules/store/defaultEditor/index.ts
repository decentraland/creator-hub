import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { settings as settingsApi } from '#preload';
import type { EditorConfig } from '/shared/types/config';

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

export const loadEditors = createAsyncThunk('defaultEditor/load', async () => {
  return settingsApi.getEditors();
});

export const setDefaultEditor = createAsyncThunk(
  'defaultEditor/setDefault',
  async (editorPath: string) => {
    return settingsApi.setDefaultEditor(editorPath);
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
