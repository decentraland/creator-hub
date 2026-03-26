import type { SceneMetrics } from '../../../redux/scene-metrics/types';

export const name = 'SceneMetricsRPC';

export enum Method {
  GET_METRICS = 'get_metrics',
  GET_LIMITS = 'get_limits',
  GET_ENTITIES_OUT_OF_BOUNDARIES = 'get_entities_out_of_boundaries',
  GET_HAS_WARNING = 'get_has_warning',
}

export type Params = {
  [Method.GET_METRICS]: undefined;
  [Method.GET_LIMITS]: undefined;
  [Method.GET_ENTITIES_OUT_OF_BOUNDARIES]: undefined;
  [Method.GET_HAS_WARNING]: undefined;
};

export type Result = {
  [Method.GET_METRICS]: SceneMetrics;
  [Method.GET_LIMITS]: SceneMetrics;
  [Method.GET_ENTITIES_OUT_OF_BOUNDARIES]: number[];
  [Method.GET_HAS_WARNING]: boolean;
};
