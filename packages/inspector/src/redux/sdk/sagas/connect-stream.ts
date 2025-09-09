import { call, select } from 'redux-saga/effects';
import { IEngine } from '@dcl/ecs';

import { selectEngines } from '..';
import { connectCrdtToEngine } from '../../../lib/sdk/connect-stream';
import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';

export function* connectStream() {
  const engines: ReturnType<typeof selectEngines> = yield select(selectEngines);
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);

  if (!dataLayer || !engines.inspector || !engines.renderer) return;

  yield call(connectCrdtToEngine, engines.inspector, dataLayer.crdtStream, 'Inspector');
  yield call(connectCrdtToEngine, engines.renderer, dataLayer.crdtStream, 'Renderer');
}

function* addCustomComponent(...params: Parameters<IEngine['defineComponent']>) {
  const engines: ReturnType<typeof selectEngines> = yield select(selectEngines);
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);

  if (!dataLayer || !engines.inspector || !engines.renderer) return;

  // define for inspector,renderer and data-layer engines
  engines.inspector.defineComponent(...params);
  engines.renderer.defineComponent(...params);
  dataLayer.addCustomComponent(...params);

  // check if redux state should be updated or not, in case not, delete the next line
  // yield call(dataLayer.addCustomComponent, ...params);
}
