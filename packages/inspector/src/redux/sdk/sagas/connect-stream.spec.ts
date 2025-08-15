/* eslint-disable @typescript-eslint/ban-types */
import { expectSaga } from 'redux-saga-test-plan';
import { combineReducers } from '@reduxjs/toolkit';
import { call } from 'redux-saga/effects';
import { Engine } from '@dcl/ecs';

import dataLayerReducer, {
  initialState as dataLayerState,
  getDataLayerInterface,
} from '../../data-layer';
import sdkReducer, { selectEngines, initialState as sdkState } from '../';
import * as connectStreamEngine from '../../../lib/sdk/connect-stream';
import { connectStream } from './connect-stream';

describe('SDK Engines crdt stream', () => {
  it('Should not connect  crdt stream if there is no ws', async () => {
    const spy = vi.spyOn(connectStreamEngine, 'connectCrdtToEngine');
    await expectSaga(connectStream)
      .withReducer(combineReducers({ dataLayer: dataLayerReducer, sdk: sdkReducer }))
      .withState({ dataLayer: dataLayerState, sdk: sdkState })
      .select(selectEngines)
      .call(getDataLayerInterface)
      .run();
    expect(spy).not.toBeCalled();
  });

  it('Should not connect  crdt stream if there is no ws', async () => {
    const spy = vi.spyOn(connectStreamEngine, 'connectCrdtToEngine').mockImplementation(() => {});
    const state = {
      dataLayer: {
        ...dataLayerState,
        dataLayer: vi.fn(),
      },
      sdk: {
        inspectorEngine: Engine(),
        rendererEngine: Engine(),
      },
    };
    await expectSaga(connectStream)
      .withReducer(combineReducers({ dataLayer: dataLayerReducer, sdk: sdkReducer }))
      .provide([[call(getDataLayerInterface), state.dataLayer.dataLayer]])
      .withState(state)
      .select(selectEngines)
      .call(getDataLayerInterface)
      .run();
    expect(spy).toBeCalledTimes(2);
  });
});
