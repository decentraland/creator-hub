import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import type { NotificationRequest } from '../../../hooks/useSnackbar';

enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
  BROADCAST_MOBILE_DEBUG_COMMAND = 'broadcast_mobile_debug_command',
}

type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string; createIfNotExists?: boolean };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.BROADCAST_MOBILE_DEBUG_COMMAND]: { cmd: string; args: Record<string, unknown> };
};

type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
  [Method.BROADCAST_MOBILE_DEBUG_COMMAND]: { ok: boolean; data: unknown };
};

export class SceneClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('SceneRpcOutbound', transport);
  }

  openFile = (path: string) => {
    return this.request('open_file', { path });
  };

  openDirectory = (path: string, createIfNotExists = false) => {
    return this.request('open_directory', { path, createIfNotExists });
  };

  pushNotification = (notification: NotificationRequest) => {
    return this.request('push_notification', { notification });
  };

  broadcastMobileDebugCommand = (cmd: string, args: Record<string, unknown> = {}) => {
    return this.request('broadcast_mobile_debug_command', { cmd, args });
  };
}
