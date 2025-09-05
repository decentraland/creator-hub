import type { IEngine, OnChangeFunction } from '@dcl/ecs';
import type { DataLayerRpcServer, FileSystemInterface } from '../types';
import { initRpcMethods } from './rpc-methods';
import { createEngineContext } from './utils/engine';

export * from './utils/engine';
export * from './utils/engine-to-composite';

export type DataLayerHost = {
  rpcMethods: DataLayerRpcServer;
  engine: IEngine;
};

/**
 * This RpcClient creates internally the server, implementing its own file system interface and engine.
 * @param fs
 * @returns
 */

export async function createDataLayerHost(fs: FileSystemInterface): Promise<DataLayerHost> {
  const callbackFunctions: OnChangeFunction[] = [];
  function addEngineListener(func: OnChangeFunction) {
    callbackFunctions.push(func);
  }
  const { engine } = createEngineContext({
    onChangeFunction: (entity, operation, component, componentValue) => {
      callbackFunctions.forEach(func => func(entity, operation, component, componentValue));
    },
  });
  Object.assign(globalThis, { dataLayerEngine: engine });

  const rpcMethods = await initRpcMethods(fs, engine, addEngineListener);

  return {
    rpcMethods,
    engine,
  };
}
