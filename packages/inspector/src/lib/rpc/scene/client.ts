import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import type { Notification } from '../../../hooks/snackbar';

enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
  REMOVE_NOTIFICATION = 'remove_notification',
}

type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string };
  [Method.PUSH_NOTIFICATION]: { notification: Notification };
  [Method.REMOVE_NOTIFICATION]: { id: string };
};

type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
  [Method.REMOVE_NOTIFICATION]: void;
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

  pushNotification = (notification: Notification) => {
    return this.request('push_notification', { notification });
  };

  removeNotification = (id: string) => {
    return this.request('remove_notification', { id });
  };
}
