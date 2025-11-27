import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import type { NotificationRequest } from '../../../hooks/useSnackbar';

enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
}

type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
};

type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
};

export class SceneClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('SceneRpcOutbound', transport);
  }

  openFile = (path: string) => {
    return this.request('open_file', { path });
  };

  openDirectory = (path: string) => {
    return this.request('open_directory', { path });
  };

  pushNotification = (notification: NotificationRequest) => {
    return this.request('push_notification', { notification });
  };
}
