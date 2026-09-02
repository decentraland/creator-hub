/* eslint-disable @typescript-eslint/ban-types */
import { expect, it, describe, vi } from 'vitest';
import { expectSaga, testSaga } from 'redux-saga-test-plan';
import { call } from 'redux-saga/effects';
import * as codegen from '@dcl/rpc/dist/codegen';

import { WebSocketTransport } from '@dcl/rpc/dist/transports/WebSocket';
import type { RpcClient, RpcClientPort, Transport } from '@dcl/rpc';
import { createRpcClient } from '@dcl/rpc';
import type { DataLayerRpcClient } from '../../../lib/data-layer/types';
import reducer, { connected, getDataLayerInterface, reconnect } from '..';
import { createLocalDataLayerRpcClient } from '../../../lib/data-layer/client/local-data-layer';
import { wireParentBridges } from '../../../lib/data-layer/client/parent-bridges';
import { createDataLayerHost } from '../../../lib/data-layer/host';
import { createFileSystemInterface } from '../../../lib/logic/file-system-interface';
import { getConfig } from '../../../lib/logic/config';
import { connectSaga, createSocketChannel, createWebSocketConnection } from './connect';

describe('WebSocket Connection Saga', () => {
  it('Should create LOCAL data-layer if no ws url is provided', async () => {
    const dataLayer = { boedo: 'casla' } as any as DataLayerRpcClient;

    await expectSaga(connectSaga)
      .withReducer(reducer)
      .provide([
        [call(getConfig), { dataLayerRpcWsUrl: null }],
        [call(createLocalDataLayerRpcClient), dataLayer],
      ])
      .put(connected({ dataLayer }))
      .hasFinalState({
        error: undefined,
        reconnectAttempts: 0,
        removingAsset: {},
        reloadAssets: [],
        assetToRename: undefined,
        stagedCustomAsset: undefined,
        undoRedoState: { canUndo: false, canRedo: false },
        sceneInfo: { content: '', isLoading: false, error: null },
      })
      .run();
    expect(getDataLayerInterface()).toBe(dataLayer);
  });

  it('Should create remote data-layer with Ws', async () => {
    const url = 'ws://boedo.com';
    const ws = new MockWebSocket();
    const channel = createSocketChannel(ws as any as WebSocket);
    const clientTransport = {} as Transport;
    const client: RpcClient = { createPort: (_port: string) => {} } as RpcClient;
    const clientPort: RpcClientPort = {} as RpcClientPort;
    const dataLayer = { boedo: 'casla' } as any as DataLayerRpcClient;
    vi.spyOn(codegen, 'loadService').mockReturnValue(dataLayer as any);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    testSaga(connectSaga)
      .next()
      .call(getConfig)
      .next({ dataLayerRpcWsUrl: url })
      .call(createWebSocketConnection, url)
      .next(ws)
      .call(createSocketChannel, ws)
      .next(channel)
      .take(channel as any)

      // OPEN event. Connect data layer
      .next({ type: 'WS_OPENED' })
      .call(WebSocketTransport, ws)
      .next(clientTransport)
      .call(createRpcClient, clientTransport)
      .next(client)
      .call(client.createPort, 'scene-ctx')
      .next(clientPort)
      .put(connected({ dataLayer }))
      .next()

      // Error event. console.error (TODO: handle this)
      .next({ type: 'WS_ERROR', error: 'some - error' })

      // Break  the connection. Should reconnect
      .finish()
      .put(reconnect())
      .next()
      .isDone();

    // Error logic
    expect(consoleSpy).toBeCalledWith('some - error');
  });

  // The Bevy renderer takes the WS branch (the realm's data layer) but the host
  // still sets dataLayerRpcParentUrl, because the scene file storage and the code
  // parser ride the parent-window bridge, not the data layer. Without this the UI
  // Designer reads '' and drops every write. We also stand up a parent-backed
  // data-layer host to serve the shared custom-asset library the realm can't see
  // (#1554), before opening the socket.
  describe('when the parent-window bridge is available alongside the ws data layer', () => {
    it('should wire the parent bridge + custom-asset host before opening the socket', () => {
      const url = 'ws://boedo.com';
      const parentUrl = 'http://localhost:3000';
      const storage = { get: () => {} } as any;
      const fs = { existFile: () => {} } as any;
      const parentHost = { rpcMethods: {} } as any;

      testSaga(connectSaga)
        .next()
        .call(getConfig)
        .next({ dataLayerRpcWsUrl: url, dataLayerRpcParentUrl: parentUrl })
        .call(wireParentBridges, parentUrl)
        .next(storage)
        .call(createFileSystemInterface, storage)
        .next(fs)
        .call(createDataLayerHost, fs)
        .next(parentHost)
        .call(createWebSocketConnection, url);
    });
  });
});

// Mock WebSocket

class MockWebSocket {
  listeners: { [key: string]: Function[] } = {};

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  simulateOpen() {
    if (this.listeners['open']) {
      this.listeners['open'].forEach(callback => callback());
    }
  }

  simulateMessage(data: any) {
    if (this.listeners['message']) {
      this.listeners['message'].forEach(callback => callback({ data }));
    }
  }

  simulateClose() {
    if (this.listeners['close']) {
      this.listeners['close'].forEach(callback => callback());
    }
  }

  simulateError() {
    if (this.listeners['error']) {
      this.listeners['error'].forEach(callback => callback());
    }
  }
}
