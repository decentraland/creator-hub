import { editor } from '#preload';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

// actions
export const startInspector = createAsyncThunk('editor/startInspector', editor.startInspector);
export const runScene = createAsyncThunk('editor/runScene', editor.runScene);
export const publishScene = createAsyncThunk('editor/publishScene', editor.publishScene);
export const openPreview = createAsyncThunk('editor/openPreview', editor.openPreview);

// state
export type EditorState = {
  inspectorPort: number;
  previewPort: number;
  publishPort: number;
  loadingInspector: boolean;
  loadingPreview: boolean;
  loadingPublish: boolean;
  error: string | null;
};

const initialState: EditorState = {
  inspectorPort: 0,
  previewPort: 0,
  publishPort: 0,
  loadingInspector: false,
  loadingPreview: false,
  loadingPublish: false,
  error: null,
};

// selectors

// slice
export const slice = createSlice({
  name: 'editor',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(startInspector.pending, state => {
      state.inspectorPort = 0;
      state.loadingInspector = true;
    });
    builder.addCase(startInspector.fulfilled, (state, action) => {
      state.inspectorPort = action.payload;
      state.loadingInspector = false;
    });
    builder.addCase(startInspector.rejected, (state, action) => {
      state.error = action.error.message || null;
      state.loadingInspector = false;
    });
    builder.addCase(runScene.pending, state => {
      state.previewPort = 0;
      state.loadingPreview = true;
    });
    builder.addCase(runScene.fulfilled, (state, action) => {
      state.previewPort = action.payload;
      state.loadingPreview = false;
    });
    builder.addCase(runScene.rejected, (state, action) => {
      state.error = action.error.message || null;
      state.loadingPreview = false;
    });
    builder.addCase(publishScene.pending, state => {
      state.publishPort = 0;
      state.loadingPublish = true;
    });
    builder.addCase(publishScene.fulfilled, (state, action) => {
      state.publishPort = action.payload;
      state.loadingPublish = false;
    });
    builder.addCase(publishScene.rejected, (state, action) => {
      state.error = action.error.message || null;
      state.loadingPublish = false;
    });
  },
});

// exports
export const actions = {
  ...slice.actions,
  startInspector,
  runScene,
  publishScene,
  openPreview,
};
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
