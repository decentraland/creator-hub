import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

import appStateReducer from './app';
import cleanAssetsReducer from './clean-assets';
import dataLayerReducer from './data-layer';
import sdkReducer from './sdk';
import uiReducer from './ui';
import sceneMetricsReducer from './scene-metrics';
import sagas from './root-saga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    dataLayer: dataLayerReducer,
    sdk: sdkReducer,
    app: appStateReducer,
    cleanAssets: cleanAssetsReducer,
    ui: uiReducer,
    sceneMetrics: sceneMetricsReducer,
  },
  middleware: getDefaultMiddleware => {
    return getDefaultMiddleware({ thunk: false, serializableCheck: false }).concat(sagaMiddleware);
  },
});

sagaMiddleware.run(sagas);

// global store
(window as any).store = store;

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type Store = typeof store;
