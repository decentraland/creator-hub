import type {IpcMainInvokeEvent} from 'electron';

import {handleInvoke, MessageType} from '../types';
import {getWorkspace} from '../../modules/workspace';

export function initWorkspace() {
  function getWorkspaceHandler(_: IpcMainInvokeEvent) {
    return getWorkspace();
  }

  return {
    getWorkspace: handleInvoke(MessageType.GET_WORKSPACE, getWorkspaceHandler),
  };
}
