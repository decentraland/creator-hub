import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { signedHeaderFactory } from 'decentraland-crypto-fetch';

import type { MetricsResponse } from '/shared/types/metrics';
import { buildMetricsUrl } from '/shared/urls';

import { metrics } from '#preload';
import { config } from '/@/config';

import { AuthServerProvider } from './auth';

const METRICS_API_URL = config.get('METRICS_API_URL');

/** Re-exported so callers don't have to reach into the shared transport types. */
export type MetricsResponseOf<T> = MetricsResponse<T>;

const signedHeaders = signedHeaderFactory();

/** What the service knows about the signed-in wallet, including its worlds. */
export type MetricsMe = {
  address: string;
  worlds: Array<{ world: string; [key: string]: unknown }>;
  admin?: boolean;
};

/** One row of the metrics bag: a value for a metric, optionally per series and period. */
export type MetricRow = {
  /** `null` for metrics that have a single series. */
  series: string | null;
  /** ISO date (`2026-07-27`) of the day or week bucket; `null` for whole-window metrics. */
  period: string | null;
  value: number;
};

export type WorldMetrics = {
  world: string;
  /** When the daily artifact behind these numbers was exported. */
  exported_at: string;
  source?: string;
  metrics: Record<string, MetricRow[]>;
};

/**
 * ADR-44 signed-fetch headers for a request the main process will make.
 *
 * The signature covers the pathname, so it is built with the same helper main
 * uses to resolve the URL. Signing happens here because the identity lives in
 * the renderer's storage; only the headers cross to main.
 */
function buildSignedHeaders(path: string): Record<string, string> {
  const address = AuthServerProvider.getAccount();
  if (!address) throw new Error('No connected account found');

  const identity = localStorageGetIdentity(address);
  if (!identity) throw new Error('No identity found');

  const { pathname } = buildMetricsUrl(METRICS_API_URL, path);
  const headers = signedHeaders(identity, 'get', pathname, {});
  return Object.fromEntries(headers.entries());
}

/**
 * A service on localhost is the fixture server (`npm run demo` in
 * creators-data): no login, and `demo=1` answers the whole roster. That lets
 * the app run against realistic data without a wallet on the roster.
 */
const IS_LOCAL_SERVICE = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(METRICS_API_URL);

function get<T>(path: string): Promise<MetricsResponse<T>> {
  if (IS_LOCAL_SERVICE) {
    const separator = path.includes('?') ? '&' : '?';
    return metrics.request<T>({ baseUrl: METRICS_API_URL, path: `${path}${separator}demo=1` });
  }
  return metrics.request<T>({ baseUrl: METRICS_API_URL, path, headers: buildSignedHeaders(path) });
}

/**
 * Client for the creators-data analytics API.
 *
 * Every request runs in the main process: Electron's renderer sends
 * `Origin: null`, which the service's CORS allow-list rejects, so a
 * renderer-side fetch never sees the response.
 */
export class MetricsApi {
  /** The worlds this wallet may see analytics for. */
  public me(): Promise<MetricsResponse<MetricsMe>> {
    return get<MetricsMe>('/me');
  }

  /** Every metric the service holds for one world, as a flat bag of rows. */
  public world(world: string): Promise<MetricsResponse<WorldMetrics>> {
    return get<WorldMetrics>(`/worlds/${encodeURIComponent(world)}/metrics`);
  }
}
