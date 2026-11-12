import type { AiTurnRecord } from '/shared/types/ai-sharing';
import type { MetricsResponse } from '/shared/types/metrics';

import { metrics } from '#preload';
import { config } from '/@/config';

import { buildSignedHeaders } from './metricsApi';

/**
 * The service that stores conversations creators chose to share. Empty until it is deployed:
 * `isConfigured()` is then false and nothing is ever sent.
 */
// Read on use, not at import: the AI chat slice imports this module, and its tests stub the
// preload `env` the config reads.
const apiUrl = (): string => config.get('AI_SHARING_API_URL') ?? '';

export const isConfigured = () => apiUrl() !== '';

/** The service accepts at most this many records per upload… */
export const MAX_RECORDS_PER_UPLOAD = 20;
/** …and a body of at most 1 MiB; uploads stay below it with room to spare. */
export const MAX_UPLOAD_BYTES = 900_000;

/** A consent decision, dated when the creator made it (a re-send keeps the original date). */
export type AiSharingDecision = { granted: boolean; version: number; decidedAt: string };

/** The server's latest decision for the signer; all null when it has none. */
export type AiSharingConsentState = {
  granted: boolean;
  version: number | null;
  decidedAt: string | null;
};

export type AiSharingUploadResult = {
  accepted: number;
  rejected: { recordId: string; reason: string }[];
};

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * The signed metadata the service requires on a write: a fresh `nonce`, which it refuses to
 * see twice (a captured request can't be replayed inside the signature's five-minute window),
 * and the body's `body_sha256`, which binds the body to the signature. Reads carry neither.
 */
export async function signedMetadata(
  method: Method,
  rawBody: string | undefined,
): Promise<Record<string, string>> {
  if (method === 'GET') return {};
  const metadata: Record<string, string> = { nonce: crypto.randomUUID() };
  if (rawBody !== undefined) metadata.body_sha256 = await sha256Hex(rawBody);
  return metadata;
}

/** Every call is ADR-44 signed, and requested through main (see `metrics.request`). */
async function send<T>(method: Method, path: string, body?: unknown): Promise<MetricsResponse<T>> {
  if (!isConfigured()) return { ok: false, status: 0, error: 'Sharing service not configured' };
  const rawBody = body === undefined ? undefined : JSON.stringify(body);
  let headers: Record<string, string>;
  try {
    headers = buildSignedHeaders(
      apiUrl(),
      path,
      method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
      await signedMetadata(method, rawBody),
    );
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
  return metrics.request<T>({ baseUrl: apiUrl(), path, method, headers, rawBody });
}

export const getConsent = () => send<AiSharingConsentState>('GET', '/consent');

export const putConsent = (decision: AiSharingDecision) =>
  send<AiSharingConsentState>('PUT', '/consent', decision);

export const uploadTurns = (records: AiTurnRecord[]) =>
  send<AiSharingUploadResult>('POST', '/turns', { records });

export const deleteAllTurns = () => send<{ deleted: number }>('DELETE', '/turns');
