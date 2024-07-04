import { ipcRenderer } from 'electron';

import type { initWorkspace } from '../handlers/workspace';
import { MessageType, type IpcHandlers} from '../types';

export function initWorkspaceApi() {
  const workspaceApi: IpcHandlers<ReturnType<typeof initWorkspace>> = {
    getWorkspace(...params) {
      return ipcRenderer.invoke(MessageType.GET_WORKSPACE, ...params);
    },
  };

  return workspaceApi;
}
