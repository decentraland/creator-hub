import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import { name, Method, type Params, type Result } from './types';

export class SceneMetricsClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super(name, transport);
  }

  getMetrics = () => {
    return this.request(Method.GET_METRICS, undefined);
  };

  getLimits = () => {
    return this.request(Method.GET_LIMITS, undefined);
  };

  getEntitiesOutOfBoundaries = () => {
    return this.request(Method.GET_ENTITIES_OUT_OF_BOUNDARIES, undefined);
  };
}
