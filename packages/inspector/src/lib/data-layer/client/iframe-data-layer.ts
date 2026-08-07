import { createFileSystemInterface } from '../../logic/file-system-interface';
import { createIframeStorage } from '../../logic/storage';
import { createDataLayerHost } from '../host';
import type { DataLayerRpcClient } from '../types';
import { createIframeScene } from '../../rpc/scene';
import { createIframeCodeParser } from '../../logic/code-parser';
import { setStorage } from './storage';

export async function createIframeDataLayerRpcClient(origin: string): Promise<DataLayerRpcClient> {
  const storage = createIframeStorage(origin);
  setStorage(storage);

  createIframeScene(origin);
  // Code-mode parser bridge (native oxc-parser lives in CH main). Standalone
  // dev builds fall back to a wasm parser in the tab instead.
  createIframeCodeParser(origin);

  const fs = createFileSystemInterface(storage);
  const localDataLayerHost = await createDataLayerHost(fs);
  return localDataLayerHost.rpcMethods as DataLayerRpcClient;
}
