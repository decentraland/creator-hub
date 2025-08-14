import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import type { RootState } from '../../../redux/store';
import { name, Method, type Params, type Result } from './types';

export class SceneMetricsServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, store: { getState: () => RootState }) {
    super(name, transport);

    this.handle(Method.GET_METRICS, async () => {
      return store.getState().sceneMetrics.metrics;
    });

    this.handle(Method.GET_LIMITS, async () => {
      return store.getState().sceneMetrics.limits;
    });

    this.handle(Method.GET_ENTITIES_OUT_OF_BOUNDARIES, async () => {
      return store.getState().sceneMetrics.entitiesOutOfBoundaries;
    });
  }
}
