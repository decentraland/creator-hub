import TextEncodingPolyfill from 'text-encoding';
import {
  getActiveVideoStreams,
  subscribeToTopic,
  publishData,
  consumeMessages,
} from '~system/CommsApi';
import { getDomain, wrapSignedFetch } from '../fetch-utils';
import type { Result } from '../fetch-utils';
import type { PresentationState } from '../types';

const URLS = () => ({
  STREAM_KEY: `https://comms-gatekeeper.${getDomain()}/scene-stream-access`,
  GET_DCL_CAST_INFO: `https://comms-gatekeeper.${getDomain()}/cast/generate-stream-link`,
  PRESENTERS: `https://comms-gatekeeper.${getDomain()}/cast/presenters`,
  PRESENTATION_BOT_TOKEN: `https://comms-gatekeeper.${getDomain()}/cast/presentation-bot-token`,
  PRESENTATION_SERVER: `https://cast-presenter-service.${getDomain()}/presentations`,
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

export async function getDclCastInfo(): Promise<Result<DclCastResponse, string>> {
  return wrapSignedFetch<DclCastResponse>({ url: URLS().GET_DCL_CAST_INFO }, { toCamelCase: true });
}

export async function getPresenters(): Promise<Result<string[], string>> {
  return wrapSignedFetch<string[]>({ url: URLS().PRESENTERS });
}

export async function promotePresenter(address: string): Promise<Result<void, string>> {
  return wrapSignedFetch<void>({
    url: `${URLS().PRESENTERS}/${address}`,
    init: { method: 'PUT', headers: {} },
  });
}

export async function ensurePresenterRole(playerAddress: string): Promise<void> {
  const [error, presenters] = await getPresenters();
  console.log(
    '[DclCast] ensurePresenterRole - error:',
    error,
    'presenters:',
    JSON.stringify(presenters),
    'playerAddress:',
    playerAddress,
  );
  if (error || !presenters) return;

  const addr = playerAddress.toLowerCase();
  const isPresenter = Array.isArray(presenters) ? presenters.includes(addr) : false;
  console.log('[DclCast] isPresenter:', isPresenter, 'addr:', addr);

  if (!isPresenter) {
    const [promoteError] = await promotePresenter(addr);
    console.log('[DclCast] promotePresenter result - error:', promoteError);
  }
}

type PresentationBotTokenResponse = {
  url: string;
  token: string;
  roomId: string;
};

export async function getPresentationBotToken(
  streamingKey: string,
): Promise<Result<PresentationBotTokenResponse, string>> {
  return wrapSignedFetch<PresentationBotTokenResponse>(
    {
      url: URLS().PRESENTATION_BOT_TOKEN,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamingKey }),
      },
    },
    { toCamelCase: true },
  );
}

export async function startPresentation(
  url: string,
  livekitToken: string,
  livekitUrl: string,
): Promise<Result<void, string>> {
  try {
    const response = await fetch(URLS().PRESENTATION_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, livekitToken, livekitUrl }),
    });
    if (!response.ok) {
      const body = await response.text();
      return [body || 'Failed to start presentation', null];
    }
    return [null, undefined as unknown as void];
  } catch (error) {
    return [(error as Error).message ?? 'Failed to start presentation', null];
  }
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

const PRESENTATION_TOPIC = 'presentation';
const PRESENTATION_SOURCE_TYPE = 3;
const PRESENTATION_BOT_PREFIX = 'presentation-bot';

export function isPresentationBot(name: string): boolean {
  return name.startsWith(PRESENTATION_BOT_PREFIX);
}

export function hasPresentationTrack(tracks: FlattenedTrack[]): boolean {
  return tracks.some(
    track => track.sourceType === PRESENTATION_SOURCE_TYPE || isPresentationBot(track.name),
  );
}

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

function getDisplayName(name: string): string {
  if (isPresentationBot(name)) return 'Presentation';
  return name;
}

export async function getActiveStreams(): Promise<FlattenedTrack[] | undefined> {
  const runtimeStreams = await getActiveVideoStreams({});
  if (!runtimeStreams) return;
  return runtimeStreams.streams.map(
    (stream: { trackSid: string; identity: string; sourceType: number; name?: string }) => {
      const rawName = stream.name ?? stream.identity;
      const displayName = getDisplayName(rawName);
      return {
        sid: stream.trackSid,
        identity: stream.identity,
        sourceType: stream.sourceType,
        name: rawName,
        customName: `${displayName} - ${getSourceLabel(stream.sourceType)}`,
      };
    },
  );
}

export function subscribeToPresentationTopic(): void {
  subscribeToTopic({ topic: PRESENTATION_TOPIC })
    .then(() => {
      // Request current state from bot so late joiners get the presentation state
      requestPresentationState();
    })
    .catch(() => {
      console.log('[DclCast] Failed to subscribe to presentation topic');
    });
}

export function requestPresentationState(): void {
  const encoder = new TextEncodingPolyfill.TextEncoder();

  publishData({
    topic: PRESENTATION_TOPIC,
    data: encoder.encode(JSON.stringify({ type: 'presentation:get-state' })),
  });
}

export async function consumePresentationMessages(): Promise<
  PresentationState | 'stopped' | undefined
> {
  try {
    const response = await consumeMessages({ topic: PRESENTATION_TOPIC });

    let latestState: PresentationState | 'stopped' | undefined;
    for (const msg of response) {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed.type === 'presentation:state') {
          latestState = {
            id: parsed.id,
            fileName: parsed.fileName,
            currentSlide: parsed.currentSlide,
            slideCount: parsed.slideCount,
            fileType: parsed.fileType,
            slideVideos: parsed.slideVideos ?? [],
            videoState: parsed.videoState ?? 'idle',
          };
        } else if (parsed.type === 'presentation:stopped') {
          latestState = 'stopped';
        }
      } catch {
        // Skip malformed individual messages
      }
    }
    return latestState;
  } catch (error) {
    // consumeMessages failed or outer JSON parse failed — return undefined
    return undefined;
  }
}

export function nextSlide(): void {
  const encoder = new TextEncodingPolyfill.TextEncoder();

  publishData({
    topic: PRESENTATION_TOPIC,
    data: encoder.encode(JSON.stringify({ type: 'presentation:navigate', action: 'next' })),
  });
}

export function prevSlide(): void {
  const encoder = new TextEncodingPolyfill.TextEncoder();

  publishData({
    topic: PRESENTATION_TOPIC,
    data: encoder.encode(JSON.stringify({ type: 'presentation:navigate', action: 'prev' })),
  });
}

export function playPresentationVideo(videoIndex: number): void {
  const encoder = new TextEncodingPolyfill.TextEncoder();

  publishData({
    topic: PRESENTATION_TOPIC,
    data: encoder.encode(JSON.stringify({ type: 'presentation:video:play', videoIndex })),
  });
}

export function pausePresentationVideo(): void {
  const encoder = new TextEncodingPolyfill.TextEncoder();

  publishData({
    topic: PRESENTATION_TOPIC,
    data: encoder.encode(JSON.stringify({ type: 'presentation:video:pause' })),
  });
}

export function stopPresentation(): void {
  const encoder = new TextEncodingPolyfill.TextEncoder();

  publishData({
    topic: PRESENTATION_TOPIC,
    data: encoder.encode(JSON.stringify({ type: 'presentation:stop' })),
  });
}
