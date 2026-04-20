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

    this.handle(Method.GET_HAS_WARNING, async () => {
      const { metrics, limits, entitiesOutOfBoundaries } = store.getState().sceneMetrics;
      if (entitiesOutOfBoundaries.length > 0) return true;
      return (Object.keys(metrics) as (keyof typeof metrics)[]).some(
        key => metrics[key] > limits[key],
      );
    });
  }
}
