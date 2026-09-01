import type { EventChannel } from 'redux-saga';
import { END, eventChannel } from 'redux-saga';
import { call, put, take } from 'redux-saga/effects';
import type { IEngine } from '@dcl/ecs';
import * as codegen from '@dcl/rpc/dist/codegen';
import type { RpcClient, RpcClientPort, Transport } from '@dcl/rpc';
import { createRpcClient } from '@dcl/rpc';
import { WebSocketTransport } from '@dcl/rpc/dist/transports/WebSocket';

import type { IDataLayer } from '../';
import { connected, reconnect } from '../';
import { createLocalDataLayerRpcClient } from '../../../lib/data-layer/client/local-data-layer';
import { DataServiceDefinition } from '../../../lib/data-layer/proto/gen/data-layer.gen';
import type { DataLayerRpcClient } from '../../../lib/data-layer/types';
import { createIframeDataLayerRpcClient } from '../../../lib/data-layer/client/iframe-data-layer';
import { wireParentBridges } from '../../../lib/data-layer/client/parent-bridges';
import { withCustomAssetsFromParent } from '../../../lib/data-layer/client/custom-assets-proxy';
import type { DataLayerHost } from '../../../lib/data-layer/host';
import { createDataLayerHost } from '../../../lib/data-layer/host';
import type { FileSystemInterface } from '../../../lib/data-layer/types';
import { createFileSystemInterface } from '../../../lib/logic/file-system-interface';
import type { Storage } from '../../../lib/logic/storage/types';
import type { InspectorConfig } from '../../../lib/logic/config';
import { getConfig } from '../../../lib/logic/config';

export function createWebSocketConnection(url: string): WebSocket {
  return new WebSocket(url);
}

export function createSocketChannel(socket: WebSocket): EventChannel<WsActions> {
  return eventChannel(emit => {
    socket.addEventListener('close', () => {
      emit(END);
    });
    socket.addEventListener('error', error => {
      emit({ type: 'WS_ERROR', error });
    });
    socket.addEventListener('open', () => {
      emit({ type: 'WS_OPENED' });
    });
    return () => {};
  });
}

export type WsActions =
  | {
      type: 'WS_OPENED';
    }
  | {
      type: 'WS_ERROR';
      error: unknown;
    };

export function* connectSaga() {
  const config: InspectorConfig = yield call(getConfig);

  if (!config.dataLayerRpcWsUrl) {
    if (!config.dataLayerRpcParentUrl) {
      const dataLayer: IDataLayer = yield call(createLocalDataLayerRpcClient);
      yield put(connected({ dataLayer }));
      return;
    }
    const dataLayer: IDataLayer = yield call(
      createIframeDataLayerRpcClient,
      config.dataLayerRpcParentUrl,
    );
    yield put(connected({ dataLayer }));
    return;
  }
  // Under a WS realm (Bevy) we still keep a parent-backed data-layer host alongside
  // it, purely to serve the custom-asset library: those files live in a shared
  // per-user dir the parent redirects to, which the realm data-layer can't see
  // (#1554). Everything else flows through the WS data-layer below.
  let parentDataLayer: DataLayerRpcClient | undefined;
  if (config.dataLayerRpcParentUrl) {
    const storage: Storage = yield call(wireParentBridges, config.dataLayerRpcParentUrl);
    const fs: FileSystemInterface = yield call(createFileSystemInterface, storage);
    const parentHost: DataLayerHost = yield call(createDataLayerHost, fs);
    parentDataLayer = parentHost.rpcMethods as unknown as DataLayerRpcClient;
  }
  const ws: WebSocket = yield call(createWebSocketConnection, config.dataLayerRpcWsUrl);
  const socketChannel: EventChannel<WsActions> = yield call(createSocketChannel, ws);
  try {
    while (true) {
      const wsEvent: WsActions = yield take(socketChannel);

      if (wsEvent.type === 'WS_OPENED') {
        const clientTransport: Transport = yield call(WebSocketTransport, ws);
        const client: RpcClient = yield call(createRpcClient, clientTransport);
        const clientPort: RpcClientPort = yield call(client.createPort, 'scene-ctx');
        const wsDataLayer: DataLayerRpcClient = codegen.loadService<
          { engine: IEngine },
          DataServiceDefinition
        >(clientPort, DataServiceDefinition);
        const dataLayer = parentDataLayer
          ? withCustomAssetsFromParent(wsDataLayer, parentDataLayer)
          : wsDataLayer;
        yield put(connected({ dataLayer }));
      } else if (wsEvent.type === 'WS_ERROR') {
        console.error(wsEvent.error);
      }
    }
  } catch (error) {
    console.log('[WS] Error', error);
  } finally {
    yield put(reconnect());
  }
}
