import { workspace } from '#preload';
import { initThunkCreator } from '../utils';

const createWorkspaceThunk = initThunkCreator('workspace');

export const getWorkspace = createWorkspaceThunk(workspace.getWorkspace);
