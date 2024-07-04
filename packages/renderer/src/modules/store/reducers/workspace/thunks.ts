import { api } from '#preload';
import { initThunkCreator } from '../utils';

const workspaceApi = api.workspace;
const createWorkspaceThunk = initThunkCreator('workspace');

export const getWorkspace = createWorkspaceThunk(workspaceApi.getWorkspace);
