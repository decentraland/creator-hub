/**
 * Transport types for the analytics (creators-data) API.
 *
 * The request is made from the main process on purpose. Electron's renderer
 * sends `Origin: null`, which no CORS allow-list will match, so a renderer-side
 * fetch cannot reach the service at all. Node has no CORS, so main can.
 *
 * Signing stays in the renderer: the auth identity lives in its local storage,
 * and only the resulting ADR-44 headers cross the IPC boundary — never the key.
 *
 * The service exposes a single endpoint, `POST /v1/metrics`, so every request
 * made here is a POST.
 */
export type MetricsRequest = {
  /** Absolute base URL of the API, e.g. `https://creators-data.decentraland.org/v1`. */
  baseUrl: string;
  /** Path under the base, e.g. `/metrics`. */
  path: string;
  /** ADR-44 signed-fetch headers built by the renderer. */
  headers?: Record<string, string>;
  /** Serialized as JSON. Outside the signature — the payload covers the pathname only. */
  body?: unknown;
};

export type MetricsResponse<T = unknown> =
  | { ok: true; status: number; data: T }
  /**
   * Failures come back as values rather than thrown errors: an unauthorized or
   * not-yet-deployed endpoint is an expected state the UI renders, not a crash.
   */
  | { ok: false; status: number; error: string };
