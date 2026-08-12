import { createFileSystemInterface } from '../../logic/file-system-interface';
import { createDataLayerHost } from '../host';
import type { DataLayerRpcClient } from '../types';
import { createIframeScene } from '../../rpc/scene';
import { wireParentBridges } from './parent-bridges';

export async function createIframeDataLayerRpcClient(origin: string): Promise<DataLayerRpcClient> {
  const storage = wireParentBridges(origin);
  createIframeScene(origin);

  const fs = createFileSystemInterface(storage);
  const localDataLayerHost = await createDataLayerHost(fs);
  return localDataLayerHost.rpcMethods as DataLayerRpcClient;
}
