import {contextBridge} from 'electron';

import {initWorkspaceApi} from './workspace';
import type {IpcHandlers, IpcModule} from '../types';

// Q: this function is only to enforce the "IpcHandlers" type on the api constant below,
// but is it necessary to do that?
function createApi<K extends IpcModule, T extends {[key: string]: IpcHandlers<K>}>(api: T) {
  return api;
}

export function initRendererApi() {
  const api = createApi({
    workspace: initWorkspaceApi(),
  });

  contextBridge.exposeInMainWorld('api', api);

  return api;
}
