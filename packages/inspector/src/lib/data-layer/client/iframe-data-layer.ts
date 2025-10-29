import { MessageTransport } from '@dcl/mini-rpc';
import { createFileSystemInterface } from '../../logic/file-system-interface';
import { createIframeStorage } from '../../logic/storage';
import { createDataLayerHost } from '../host';
import type { DataLayerRpcClient } from '../types';
import type { Storage } from '../../logic/storage/types';
import { UiClient } from '../../rpc/ui/client';
import { setUiClient } from '../../rpc/ui';

let storageInstance: Storage | undefined;

export function getStorage(): Storage | undefined {
  return storageInstance;
}

export async function createIframeDataLayerRpcClient(origin: string): Promise<DataLayerRpcClient> {
  const storage = createIframeStorage(origin);
  storageInstance = storage;

  const transport = new MessageTransport(window, window.parent, origin);
  const uiClient = new UiClient(transport);
  setUiClient(uiClient);

  const fs = createFileSystemInterface(storage);
  const localDataLayerHost = await createDataLayerHost(fs);
  return localDataLayerHost.rpcMethods as DataLayerRpcClient;
}
