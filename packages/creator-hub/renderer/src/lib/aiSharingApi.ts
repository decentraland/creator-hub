import type { AiTurnRecord } from '/shared/types/ai-sharing';
import type { MetricsResponse } from '/shared/types/metrics';

import { metrics } from '#preload';
import { config } from '/@/config';

import { AuthServerProvider } from './auth';
import { buildSignedHeaders } from './metricsApi';

/**
 * The service that stores conversations creators chose to share. Empty until it is deployed:
 * `isConfigured()` is then false and nothing is ever sent.
 */
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

/** A shared turn as the service returns it to its own wallet. */
export type AiSharingStoredTurn = Pick<
  AiTurnRecord,
  'recordId' | 'startedAt' | 'agent' | 'prompt' | 'response' | 'outcome'
>;

export type AiSharingTurnPage = { records: AiSharingStoredTurn[]; next: string | null };

export type AiSharingUploadResult = {
  accepted: number;
  rejected: { recordId: string; reason: string }[];
};

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

type Method = 'GET' | 'POST' | 'PUT';

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

/**
 * Every call is ADR-44 signed, and requested through main (see `metrics.request`). A call made
 * for one wallet must not go out signed by another that signed in meanwhile: `wallet` is checked
 * against the signing account right before signing.
 */
async function send<T>(
  wallet: string,
  method: Method,
  path: string,
  body?: unknown,
): Promise<MetricsResponse<T>> {
  if (!isConfigured()) return { ok: false, status: 0, error: 'Sharing service not configured' };
  const rawBody = body === undefined ? undefined : JSON.stringify(body);
  const metadata = await signedMetadata(method, rawBody);
  // Checked after the await, right before signing: buildSignedHeaders signs as whoever is signed
  // in at that moment.
  if (AuthServerProvider.getAccount()?.toLowerCase() !== wallet.toLowerCase()) {
    return { ok: false, status: 0, error: 'The signed-in account changed' };
  }
  let headers: Record<string, string>;
  try {
    headers = buildSignedHeaders(
      apiUrl(),
      path,
      method.toLowerCase() as 'get' | 'post' | 'put',
      metadata,
    );
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
  return metrics.request<T>({ baseUrl: apiUrl(), path, method, headers, rawBody });
}

export const getConsent = (wallet: string) =>
  send<AiSharingConsentState>(wallet, 'GET', '/consent');

export const putConsent = (wallet: string, decision: AiSharingDecision) =>
  send<AiSharingConsentState>(wallet, 'PUT', '/consent', decision);

export const uploadTurns = (wallet: string, records: AiTurnRecord[]) =>
  send<AiSharingUploadResult>(wallet, 'POST', '/turns', { records });

/** The wallet's own shared turns, newest first. */
export const listTurns = (wallet: string, cursor: string | null, limit = 10) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) query.set('cursor', cursor);
  return send<AiSharingTurnPage>(wallet, 'GET', `/turns?${query}`);
};

/** Erases every shared turn of the wallet and records the withdrawal, dated `decidedAt`. */
export const eraseAll = (wallet: string, decidedAt: string) =>
  send<{ deleted: number }>(wallet, 'POST', '/erase', { decidedAt });

/** Erases one shared turn; sharing stays as it is. */
export const eraseTurn = (wallet: string, recordId: string) =>
  send<{ deleted: number }>(wallet, 'POST', '/erase', {
    decidedAt: new Date().toISOString(),
    recordId,
  });
