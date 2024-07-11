import { workspace } from '#preload';
import { createAsyncThunk } from '@reduxjs/toolkit';

export const getWorkspace = createAsyncThunk('workspace/getWorkspace', workspace.getWorkspace);
export const createProject = createAsyncThunk('workspace/createProject', workspace.createProject);
export const deleteProject = createAsyncThunk('workspace/deleteProject', workspace.deleteProject);
export const duplicateProject = createAsyncThunk(
  'workspace/duplicateProject',
  workspace.duplicateProject,
);
