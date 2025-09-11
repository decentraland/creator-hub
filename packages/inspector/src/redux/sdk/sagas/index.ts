import { takeEvery } from 'redux-saga/effects';
import { addCustomComponentAction, addEngines } from '../';
import { connected } from '../../data-layer';
import { connectStream, addCustomComponent } from './connect-stream';

export function* sdkSagas() {
  yield takeEvery(connected.type, connectStream);
  yield takeEvery(addEngines.type, connectStream);
  yield takeEvery(addCustomComponentAction, addCustomComponent);
}

export default sdkSagas;
