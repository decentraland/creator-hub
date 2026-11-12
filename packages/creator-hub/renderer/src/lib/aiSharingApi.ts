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

/** The service accepts at most this many records per upload. */
export const MAX_RECORDS_PER_UPLOAD = 20;

export type AiSharingConsentState = { granted: boolean; version: number | null };

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Every call is ADR-44 signed. A body's sha256 goes in the signed metadata (`hashPayload`, as
 * the Creator Fund API does): the signature otherwise covers only the method and path, so
 * captured headers could be replayed with another body.
 */
async function send<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<MetricsResponse<T>> {
  if (!isConfigured()) return { ok: false, status: 0, error: 'Sharing service not configured' };
  const rawBody = body === undefined ? undefined : JSON.stringify(body);
  let headers: Record<string, string>;
  try {
    headers = buildSignedHeaders(
      apiUrl(),
      path,
      method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
      rawBody === undefined ? {} : { hashPayload: await sha256Hex(rawBody) },
    );
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
  return metrics.request<T>({ baseUrl: apiUrl(), path, method, headers, rawBody });
}

export const getConsent = () => send<AiSharingConsentState>('GET', '/consent');

export const putConsent = (granted: boolean, version: number) =>
  send<AiSharingConsentState>('PUT', '/consent', { granted, version });

export const uploadTurns = (records: AiTurnRecord[]) =>
  send<{ accepted: number }>('POST', '/turns', { records });

export const deleteAllTurns = () => send<{ deleted: number }>('DELETE', '/turns');
