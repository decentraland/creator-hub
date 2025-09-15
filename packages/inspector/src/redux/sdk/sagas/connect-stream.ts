import { call, select } from 'redux-saga/effects';

import { selectEngines } from '..';
import { connectCrdtToEngine } from '../../../lib/sdk/connect-stream';
import type { IDataLayer } from '../../data-layer';
import { getDataLayerInterface } from '../../data-layer';

export function* connectStream(): Generator<any, void, any> {
  const engines: ReturnType<typeof selectEngines> = yield select(selectEngines);
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);

  if (!dataLayer || !engines.inspector || !engines.renderer) return;

  const response: any = yield call(dataLayer.getCustomComponentsDefinitions, {});
  const tags = response.customComponents.map((bytes: Uint8Array) => {
    const componentData = JSON.parse(new TextDecoder().decode(bytes));
    return componentData;
  });

  const encoder = new TextEncoder();
  const schemaBytes = encoder.encode(JSON.stringify({}));

  for (const tag of tags) {
    engines.inspector?.defineComponent(tag.componentName, tag.schema);
    engines.renderer?.defineComponent(tag.componentName, tag.schema);
    yield call(dataLayer.addCustomComponent, { name: tag.componentName, schema: schemaBytes });

    engines.inspector?.update(1);
    engines.renderer?.update(1);
  }

  yield call(connectCrdtToEngine, engines.inspector, dataLayer.crdtStream, 'Inspector');
  yield call(connectCrdtToEngine, engines.renderer, dataLayer.crdtStream, 'Renderer');
}

//TODO rename to defineCustomComponent
export function* addCustomComponent(action: {
  type: string;
  payload: { name: string };
}): Generator<any, void, any> {
  const { name } = action.payload;
  console.log('[sagas] addCustomComponent', { name });

  const engines: ReturnType<typeof selectEngines> = yield select(selectEngines);
  const dataLayer: IDataLayer = yield call(getDataLayerInterface);
  const { inspector, renderer } = engines;

  if (inspector && renderer && dataLayer) {
    const schema = {};
    inspector.defineComponent(name, schema);
    renderer.defineComponent(name, schema);

    const encoder = new TextEncoder();
    const schemaBytes = encoder.encode(JSON.stringify(schema));
    yield call(dataLayer.addCustomComponent, { name, schema: schemaBytes });
  }
}
