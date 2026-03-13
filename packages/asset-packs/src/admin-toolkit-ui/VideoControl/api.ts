import { getActiveVideoStreams } from '~system/CommsApi';
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

export type FlattenedTrack = {
  sid: string;
  identity: string;
  sourceType: number;
  name: string;
  customName: string;
};

export type Participant = {
  name: string;
  identity: string;
  tracks: FlattenedTrack[];
};

export const SOURCE_TYPE_LABELS: Record<number, string> = {
  1: 'Camera',
  2: 'Screen',
  3: 'Presentation',
};

export const getSourceLabel = (sourceType: number) => SOURCE_TYPE_LABELS[sourceType] ?? 'Unknown';

export function groupTracksByParticipant(tracks: FlattenedTrack[]): Participant[] {
  const map = new Map<string, Participant>();
  for (const track of tracks) {
    const existing = map.get(track.name);
    if (existing) {
      existing.tracks.push(track);
    } else {
      map.set(track.name, { name: track.name, identity: track.identity, tracks: [track] });
    }
  }
  return Array.from(map.values());
}

export async function getActiveStreams(): Promise<FlattenedTrack[] | undefined> {
  const runtimeStreams = await getActiveVideoStreams({});
  if (!runtimeStreams) return;
  return runtimeStreams.streams.map(
    (stream: { trackSid: string; identity: string; sourceType: number; name?: string }) => ({
      sid: stream.trackSid,
      identity: stream.identity,
      sourceType: stream.sourceType,
      name: stream.name ?? stream.identity,
      customName: `${stream.name ?? stream.identity} - ${getSourceLabel(stream.sourceType)}`,
    }),
  );
}
