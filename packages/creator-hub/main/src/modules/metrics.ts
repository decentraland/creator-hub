import log from 'electron-log/main';

import type { MetricsRequest, MetricsResponse } from '/shared/types/metrics';
import { buildMetricsUrl } from '/shared/urls';

/** Hosts the analytics API is allowed to live on. */
const ALLOWED_HOSTS = [/\.decentraland\.org$/, /\.decentraland\.zone$/, /\.decentraland\.today$/];
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The only headers the renderer gets to set: the full ADR-44 signed-fetch set
 * `signedHeaderFactory` produces. The server rebuilds the signed payload from
 * the timestamp and metadata headers, so dropping either fails verification
 * with "Expired signature: signature timestamp: 0".
 */
const FORWARDED_HEADER = /^x-identity-(auth-chain-\d+|timestamp|metadata)$/i;

/**
 * Main is not a general-purpose fetch proxy for the renderer: it only reaches
 * Decentraland hosts, plus localhost so the service can be run locally.
 */
export function resolveUrl({ baseUrl, path }: MetricsRequest): URL {
  const url = buildMetricsUrl(baseUrl, path);
  const isLocal = LOCAL_HOSTS.includes(url.hostname);

  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
    throw new Error(`Analytics API must be https (got ${url.protocol}//${url.host})`);
  }
  if (!isLocal && !ALLOWED_HOSTS.some(pattern => pattern.test(url.hostname))) {
    throw new Error(`Analytics API host is not allowed: ${url.host}`);
  }
  return url;
}

/**
 * Performs an analytics API request from the main process, where CORS does not
 * apply. Never throws for HTTP or network failures — the caller renders them.
 *
 * A failure's `error` is the body's `message`, else its `error`, else the raw
 * body; a JSON error body is also returned whole as `body`. An empty success
 * body (204) resolves to `data: null`.
 */
export async function request(req: MetricsRequest): Promise<MetricsResponse> {
  let url: URL;
  try {
    url = resolveUrl(req);
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }

  const method = req.method ?? 'POST';
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...Object.fromEntries(
          Object.entries(req.headers ?? {}).filter(([name]) => FORWARDED_HEADER.test(name)),
        ),
        accept: 'application/json',
        ...(method !== 'GET' ? { 'content-type': 'application/json' } : {}),
      },
      body: method !== 'GET' ? (req.rawBody ?? JSON.stringify(req.body)) : undefined,
      // The allowlist only sees the first URL, so a 3xx to an internal address
      // would otherwise be followed unchecked.
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = text || `Request failed with status ${response.status}`;
      let body: unknown;
      try {
        body = JSON.parse(text);
        message = (body as any).message ?? (body as any).error ?? message;
      } catch {
        body = undefined;
      }
      log.warn(`[metrics] ${url.pathname} status=${response.status} error=${message}`);
      return { ok: false, status: response.status, error: message, body };
    }

    return { ok: true, status: response.status, data: text ? JSON.parse(text) : null };
  } catch (error: any) {
    const message = error.name === 'TimeoutError' ? 'The analytics API timed out' : error.message;
    log.error(`[metrics] ${url.pathname} error=${message}`);
    return { ok: false, status: 0, error: message };
  }
}
