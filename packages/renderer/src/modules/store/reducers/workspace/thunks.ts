import { workspace } from '#preload';
import { createAsyncThunk } from '@reduxjs/toolkit';

export const getWorkspace = createAsyncThunk('workspace/getWorkspace', workspace.getWorkspace);
export const createProject = createAsyncThunk('workspace/createProject', workspace.createProject);
