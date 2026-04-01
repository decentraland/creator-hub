import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import type { NotificationRequest } from '../../../hooks/useSnackbar';

enum Method {
  OPEN_FILE = 'open_file',
  OPEN_DIRECTORY = 'open_directory',
  PUSH_NOTIFICATION = 'push_notification',
  COPY_TO_CLIPBOARD = 'copy_to_clipboard',
}

type Params = {
  [Method.OPEN_FILE]: { path: string };
  [Method.OPEN_DIRECTORY]: { path: string; createIfNotExists?: boolean };
  [Method.PUSH_NOTIFICATION]: { notification: NotificationRequest };
  [Method.COPY_TO_CLIPBOARD]: { text: string };
};

type Result = {
  [Method.OPEN_FILE]: void;
  [Method.OPEN_DIRECTORY]: void;
  [Method.PUSH_NOTIFICATION]: void;
  [Method.COPY_TO_CLIPBOARD]: void;
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

  copyToClipboard = (text: string) => {
    return this.request('copy_to_clipboard', { text });
  };
}
