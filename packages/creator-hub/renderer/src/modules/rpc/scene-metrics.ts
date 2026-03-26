import { RPC, type Transport } from '@dcl/mini-rpc';

export type SceneMetrics = {
  triangles: number;
  entities: number;
  bodies: number;
  materials: number;
  textures: number;
};

export type SceneMetricsData = {
  metrics: SceneMetrics;
  limits: SceneMetrics;
  entitiesOutOfBoundaries: number[];
};

enum Method {
  GET_METRICS = 'get_metrics',
  GET_LIMITS = 'get_limits',
  GET_ENTITIES_OUT_OF_BOUNDARIES = 'get_entities_out_of_boundaries',
  GET_HAS_WARNING = 'get_has_warning',
}

type Params = {
  [Method.GET_METRICS]: undefined;
  [Method.GET_LIMITS]: undefined;
  [Method.GET_ENTITIES_OUT_OF_BOUNDARIES]: undefined;
  [Method.GET_HAS_WARNING]: undefined;
};

type Result = {
  [Method.GET_METRICS]: SceneMetrics;
  [Method.GET_LIMITS]: SceneMetrics;
  [Method.GET_ENTITIES_OUT_OF_BOUNDARIES]: number[];
  [Method.GET_HAS_WARNING]: boolean;
};

export class SceneMetricsClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super('SceneMetricsRPC', transport);
  }

  async fetchAll(): Promise<SceneMetricsData> {
    const [metrics, limits, entitiesOutOfBoundaries] = await Promise.all([
      this.request(Method.GET_METRICS, undefined),
      this.request(Method.GET_LIMITS, undefined),
      this.request(Method.GET_ENTITIES_OUT_OF_BOUNDARIES, undefined),
    ]);
    return { metrics, limits, entitiesOutOfBoundaries };
  }

  async hasWarning(): Promise<boolean> {
    return this.request(Method.GET_HAS_WARNING, undefined);
  }
}
