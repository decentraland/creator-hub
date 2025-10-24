import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { MessageTransport } from '@dcl/mini-rpc';

import { UiServer } from '../lib/rpc/ui/server';
import { SceneMetricsServer } from '../lib/rpc/scene-metrics/server';
import { getConfig } from '../lib/logic/config';
import appStateReducer from './app';
import dataLayerReducer from './data-layer';
import sdkReducer from './sdk';
import uiReducer from './ui';
import sceneMetricsReducer from './scene-metrics';
import sceneInfoReducer from './scene-info';
import sagas from './root-saga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    dataLayer: dataLayerReducer,
    sdk: sdkReducer,
    app: appStateReducer,
    ui: uiReducer,
    sceneMetrics: sceneMetricsReducer,
    sceneInfo: sceneInfoReducer,
  },
  middleware: getDefaultMiddleware => {
    return getDefaultMiddleware({ thunk: false, serializableCheck: false }).concat(sagaMiddleware);
  },
});

// if there is a parent, initialize rpc servers
const config = getConfig();
if (config.dataLayerRpcParentUrl) {
  const tranport = new MessageTransport(window, window.parent, config.dataLayerRpcParentUrl);
  new UiServer(tranport, store);
  new SceneMetricsServer(tranport, store);
}

sagaMiddleware.run(sagas);

// global store
(window as any).store = store;

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
