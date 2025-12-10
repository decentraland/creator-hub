import { getDomain, wrapSignedFetch } from '../fetch-utils';
import type { Result } from '../fetch-utils';

const URLS = () => ({
  STREAM_KEY: `https://comms-gatekeeper.decentraland.${getDomain()}/scene-stream-access`,
  GET_DCL_CAST_INFO: `https://comms-gatekeeper.decentraland.${getDomain()}/cast/generate-stream-link`,
});

type StreamKeyResponse = {
  streamingUrl: string;
  streamingKey: string;
  createdAt: number;
  endsAt: number;
};

export type DclCastResponse = {
  streamLink: string;
  watcherLink: string;
  streamingKey: string;
  placeId: string;
  placeName: string;
  expiresAt: number;
  expiresInDays: number;
};

export async function getStreamKey(): Promise<Result<StreamKeyResponse, string>> {
  return wrapSignedFetch<StreamKeyResponse>({ url: URLS().STREAM_KEY }, { toCamelCase: true });
}

export async function generateStreamKey(): Promise<Result<StreamKeyResponse, string>> {
  return wrapSignedFetch<StreamKeyResponse>(
    { url: URLS().STREAM_KEY, init: { method: 'POST', headers: {} } },
    { toCamelCase: true },
  );
}

export async function revokeStreamKey(): Promise<Result<StreamKeyResponse, string>> {
  return wrapSignedFetch<StreamKeyResponse>({
    url: URLS().STREAM_KEY,
    init: { method: 'DELETE', headers: {} },
  });
}

export async function resetStreamKey(): Promise<Result<StreamKeyResponse, string>> {
  return wrapSignedFetch<StreamKeyResponse>(
    { url: URLS().STREAM_KEY, init: { method: 'PUT', headers: {} } },
    { toCamelCase: true },
  );
}

export async function getDclCastInfo(): Promise<Result<DclCastResponse, string>> {
  return wrapSignedFetch<DclCastResponse>({ url: URLS().GET_DCL_CAST_INFO }, { toCamelCase: true });
}
