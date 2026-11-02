import type { MetricsRequest, MetricsResponse } from '/shared/types/metrics';

import { invoke } from '../services/ipc';

/**
 * Runs an analytics API request in the main process. The renderer cannot call
 * the service directly: Electron sends `Origin: null`, which fails its CORS
 * allow-list. Sign in the renderer, send the headers, fetch here.
 */
export async function request<T>(req: MetricsRequest): Promise<MetricsResponse<T>> {
  return (await invoke('metrics.request', req)) as MetricsResponse<T>;
}
