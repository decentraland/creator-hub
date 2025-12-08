import type { Result } from '../fetch-utils';
import { getDomain, wrapSignedFetch } from '../fetch-utils';

const URLS = () => ({
  STREAM_KEY: `https://comms-gatekeeper.decentraland.${getDomain()}/scene-stream-access`,
});

type StreamKeyResponse = {
  streamingUrl: string;
  streamingKey: string;
  createdAt: number;
  endsAt: number;
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
