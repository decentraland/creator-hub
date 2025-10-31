import { createFileSystemInterface } from '../../logic/file-system-interface';
import { createIframeStorage } from '../../logic/storage';
import { createDataLayerHost } from '../host';
import type { DataLayerRpcClient } from '../types';
import type { Storage } from '../../logic/storage/types';
import { createIframeScene } from '../../rpc/scene';

let storageInstance: Storage | undefined;

export function getStorage(): Storage | undefined {
  return storageInstance;
}

export async function createIframeDataLayerRpcClient(origin: string): Promise<DataLayerRpcClient> {
  const storage = createIframeStorage(origin);
  storageInstance = storage;

  createIframeScene(origin);

  const fs = createFileSystemInterface(storage);
  const localDataLayerHost = await createDataLayerHost(fs);
  return localDataLayerHost.rpcMethods as DataLayerRpcClient;
}
