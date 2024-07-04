import {initWorkspace} from './handlers/workspace';

export function initIpc() {
  return {
    workspace: initWorkspace(),
  };
}
