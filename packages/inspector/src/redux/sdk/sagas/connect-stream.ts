import { call, select } from 'redux-saga/effects';

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

export function* addCustomComponent(action: { type: string; payload: { name: string } }) {
  const { name } = action.payload;
  console.log('[sagas] addCustomComponent', { name });

  const engines: ReturnType<typeof selectEngines> = yield select(selectEngines);
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  const { inspector, renderer } = engines;

  if (inspector && renderer && dataLayer) {
    const schema = {};
    const newTagComponent = inspector.defineComponent(name, schema);
    console.log('[sagas] newTagComponent', newTagComponent);
    const newTagComponentRenderer = renderer.defineComponent(name, schema);
    console.log('[sagas] newTagComponentRenderer', newTagComponentRenderer);
    inspector.update(1);
    renderer.update(1);

    const encoder = new TextEncoder();
    const schemaBytes = encoder.encode(JSON.stringify(schema));
    yield call(dataLayer.addCustomComponent, { name, schema: schemaBytes });
  }
}
