import { createDataLayerHost } from '../host';
import type { DataLayerRpcClient } from '../types';
import { feededFileSystem } from './feeded-local-fs';
import { setStorage } from './storage';

/**
 * This RpcClient creates internally the DataLayer HOST, implementing its own file system interface and engine.
 * @param fs
 * @returns
 */
export async function createLocalDataLayerRpcClient(): Promise<DataLayerRpcClient> {
  const { fs, storage } = await feededFileSystem();
  setStorage(storage);
  const localDataLayerHost = await createDataLayerHost(fs);
  return localDataLayerHost.rpcMethods as DataLayerRpcClient;
}
