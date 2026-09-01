import log from 'electron-log/main';

import type { MetricsRequest, MetricsResponse } from '/shared/types/metrics';
import { buildMetricsUrl } from '/shared/urls';

/** Hosts the analytics API is allowed to live on. */
const ALLOWED_HOSTS = [/\.decentraland\.org$/, /\.decentraland\.zone$/, /\.decentraland\.today$/];
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const REQUEST_TIMEOUT_MS = 15_000;

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
 */
export async function request(req: MetricsRequest): Promise<MetricsResponse> {
  let url: URL;
  try {
    url = resolveUrl(req);
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(req.headers ?? {}),
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.text();
    if (!response.ok) {
      /*
       * The service answers `{ error, message }` where `error` is the generic
       * status ("Bad request") and `message` carries the only useful detail
       * ("locations[0]: \"Not A Name\" is not a valid ENS name"), so `message`
       * wins. A non-JSON body is kept verbatim rather than replaced with a bare
       * status.
       */
      let message = body || `Request failed with status ${response.status}`;
      try {
        const parsed = JSON.parse(body);
        message = parsed.message ?? parsed.error ?? message;
      } catch {
        // Not JSON — the raw body is the message.
      }
      log.warn(`[metrics] ${url.pathname} status=${response.status} error=${message}`);
      return { ok: false, status: response.status, error: message };
    }

    return { ok: true, status: response.status, data: JSON.parse(body) };
  } catch (error: any) {
    const message = error.name === 'TimeoutError' ? 'The analytics API timed out' : error.message;
    log.error(`[metrics] ${url.pathname} error=${message}`);
    return { ok: false, status: 0, error: message };
  }
}
