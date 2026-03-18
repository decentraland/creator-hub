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

export type DclCastTracksResponse = {
  participants: {
    identity: string;
    tracks: {
      sid: string;
      type: 'AUDIO' | 'VIDEO';
      source: 'MICROPHONE' | 'CAMERA' | 'SCREEN_SHARE';
    }[];
    name: string;
  }[];
};

const USE_MOCK = false;

// TODO: Remove mock before merging — used for local testing without a live DCL Cast room
const MOCK_DCL_CAST_RESPONSE: DclCastResponse = {
  streamLink: 'https://cast.decentraland.org/room/mock-room-id?token=speaker',
  watcherLink: 'https://cast.decentraland.org/room/mock-room-id?token=watcher',
  streamingKey: 'mock-streaming-key',
  placeId: 'mock-place-id',
  placeName: 'Mock Place',
  expiresAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
  expiresInDays: 4,
};

export async function getDclCastInfo(): Promise<Result<DclCastResponse, string>> {
  if (USE_MOCK) {
    return [null, MOCK_DCL_CAST_RESPONSE];
  }
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

// TODO: Remove mock before merging — used for local testing without a live DCL Cast room
const MOCK_STREAMS = {
  streams: [
    {
      identity: 'stream:f357950a:1',
      trackSid: 'livekit-video://stream:f357950a/TR_VCDh3g4vjSTgNm',
      sourceType: 1,
      name: 'Yemel',
    },
    {
      identity: 'stream:f357950a:1',
      trackSid: 'livekit-video://stream:f357950a/TR_VSMiFKuE2pV6YK',
      sourceType: 2,
      name: 'Yemel',
    },
    {
      identity: 'stream:a1b2c3d4:2',
      trackSid: 'livekit-video://stream:a1b2c3d4/TR_ABC123',
      sourceType: 1,
      name: 'Laia',
    },
    {
      identity: 'stream:b2c3d4e5:3',
      trackSid: 'livekit-video://stream:b2c3d4e5/TR_DEF456',
      sourceType: 1,
      name: 'Aida',
    },
    {
      identity: 'stream:c3d4e5f6:4',
      trackSid: 'livekit-video://stream:c3d4e5f6/TR_GHI789',
      sourceType: 1,
      name: 'Aitor',
    },
    {
      identity: 'stream:d4e5f6g7:5',
      trackSid: 'livekit-video://stream:d4e5f6g7/TR_JKL012',
      sourceType: 1,
      name: 'Alain',
    },
    {
      identity: 'stream:e5f6g7h8:6',
      trackSid: 'livekit-video://stream:e5f6g7h8/TR_MNO345',
      sourceType: 1,
      name: 'Jair',
    },
    {
      identity: 'stream:f6g7h8i9:7',
      trackSid: 'livekit-video://stream:f6g7h8i9/TR_PQR678',
      sourceType: 1,
      name: 'Isaiah',
    },
    {
      identity: 'stream:g7h8i9j0:8',
      trackSid: 'livekit-video://stream:g7h8i9j0/TR_STU901',
      sourceType: 1,
      name: 'Maite',
    },
    {
      identity: 'stream:h8i9j0k1:9',
      trackSid: 'livekit-video://stream:h8i9j0k1/TR_VWX234',
      sourceType: 1,
      name: 'Said',
    },
    {
      identity: 'stream:i9j0k1l2:10',
      trackSid: 'livekit-video://stream:i9j0k1l2/TR_YZA567',
      sourceType: 1,
      name: 'Nora',
    },
    {
      identity: 'stream:j0k1l2m3:11',
      trackSid: 'livekit-video://stream:j0k1l2m3/TR_BCD890',
      sourceType: 2,
      name: 'Nora',
    },
    {
      identity: 'stream:k1l2m3n4:12',
      trackSid: 'livekit-video://stream:k1l2m3n4/TR_EFG123',
      sourceType: 1,
      name: 'Iker',
    },
  ],
};

export async function getActiveStreams(): Promise<FlattenedTrack[] | undefined> {
  const runtimeStreams = USE_MOCK ? MOCK_STREAMS : await getActiveVideoStreams({});
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

// TODO: Remove mock before merging — used for local testing without a live presentation
const MOCK_PRESENTATION = {
  currentSlide: 3,
  totalSlides: 15,
};

export async function getPresentationInfo(): Promise<
  { currentSlide: number; totalSlides: number } | undefined
> {
  if (USE_MOCK) {
    return MOCK_PRESENTATION;
  }
  // TODO: Wire to real API when available
  return undefined;
}

export async function nextSlide(): Promise<void> {
  // TODO: Wire to real presentation API
}

export async function prevSlide(): Promise<void> {
  // TODO: Wire to real presentation API
}

export async function playVideo(): Promise<void> {
  // TODO: Wire to real presentation API
}

export async function stopVideo(): Promise<void> {
  // TODO: Wire to real presentation API
}
