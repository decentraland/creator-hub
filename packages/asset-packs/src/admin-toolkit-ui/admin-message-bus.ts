/**
 * Admin Message Bus
 *
 * Secures admin-controlled components (VideoPlayer, TextAnnouncements) against
 * unauthorized CRDT overwrites by moving admin state changes to a separate
 * communication channel.
 *
 * Architecture:
 *
 *   1. CRDT sync for VideoPlayer is DISABLED on admin-controlled entities by
 *      removing it from SyncComponents. This prevents attacker CRDT writes
 *      from propagating through the normal sync transport.
 *
 *   2. Admin commands flow via the TEXT comms channel (MessageBus), which is a
 *      separate transport from the binary CRDT channel. All participants
 *      receive and apply admin commands through this channel.
 *
 *   3. On load, each client seeds authoritative state from
 *      VideoScreen.defaultURL (deploy-time value, not writable via CRDT).
 *      A per-frame revert system enforces this state against any raw CRDT
 *      writes injected directly via LiveKit.
 *
 *   4. Late joiners request state from existing participants via a
 *      request/response handshake over the MessageBus.
 *
 * Sending uses communicationsController.send() directly rather than the
 * MessageBus class's emit(), because the class's internal flush queue drops
 * subsequent messages. Receiving uses MessageBus.on(), which registers on the
 * global onCommsMessage observable and works reliably.
 */

import type { Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { MessageBus } from '@dcl/sdk/message-bus';
import { getExplorerComponents } from '../components';
import { getComponents } from '../definitions';
import type { IPlayersHelper } from '../types';
import type { SceneAdmin } from './ModerationControl';
import { getVideoPlayers } from './VideoControl/utils';
import { send as commsSend } from '~system/CommunicationsController';

// ── Types ────────────────────────────────────────────────────────────────────

type VideoState = Pick<PBVideoPlayer, 'src' | 'playing' | 'volume' | 'loop'>;

type AnnouncementState = {
  text: string;
  author: string;
  id: string;
};

interface SyncStatePayload {
  video: Array<{ entity: number } & VideoState>;
  announcement: AnnouncementState | null;
}

type MessageHandler = (payload: any, sender: string) => void;

// ── Message identifiers ──────────────────────────────────────────────────────

const MSG = {
  SET_VIDEO: 'admin:set-video',
  SET_ANNOUNCEMENT: 'admin:set-announcement',
  CLEAR_ANNOUNCEMENT: 'admin:clear-announcement',
  REQUEST_STATE: 'admin:request-state',
  SYNC_STATE: 'admin:sync-state',
} as const;

// ── Public interface ─────────────────────────────────────────────────────────

export interface AdminMessageBusInstance {
  emitSetVideo(entity: Entity, props: Partial<PBVideoPlayer>): void;
  emitSetAnnouncement(text: string, author?: string, id?: string): void;
  emitClearAnnouncement(): void;
  updateAdminList(admins: SceneAdmin[]): void;
}

let instance: AdminMessageBusInstance | null = null;

export function getAdminMessageBus(): AdminMessageBusInstance {
  if (!instance) throw new Error('AdminMessageBus not initialized');
  return instance;
}

// ── Initialization ───────────────────────────────────────────────────────────

export function initAdminMessageBus(
  engine: IEngine,
  _admins: SceneAdmin[],
  adminToolkitUiEntity: Entity,
  playersHelper?: IPlayersHelper,
): AdminMessageBusInstance {
  const { VideoPlayer, SyncComponents } = getExplorerComponents(engine);
  const { TextAnnouncements, VideoScreen } = getComponents(engine);

  const authoritativeVideo = new Map<Entity, VideoState>();
  let authoritativeAnnouncement: AnnouncementState | null = null;
  let adminHasActed = false;

  // ── Messaging layer ────────────────────────────────────────────────────────
  //
  // Local delivery: handlers are called synchronously on emit.
  // Remote delivery: communicationsController.send() (bypasses MessageBus flush queue).
  // Remote reception: MessageBus.on() (listens on the global onCommsMessage observable).

  const handlers = new Map<string, MessageHandler>();
  const receiver = new MessageBus();

  function onMessage(type: string, handler: MessageHandler) {
    handlers.set(type, handler);
    receiver.on(type, handler);
  }

  function emitMessage(type: string, payload: Record<string, unknown>) {
    const handler = handlers.get(type);
    if (handler) handler(payload, 'self');

    const raw = JSON.stringify({ message: type, payload });
    commsSend({ message: raw }).catch(() => {});
  }

  // ── 1. Disable CRDT sync for VideoPlayer on admin-controlled entities ──────

  for (const vp of getVideoPlayers(engine)) {
    const entity = vp.entity as Entity;
    const sync = SyncComponents.getOrNull(entity);
    if (sync) {
      const withoutVideoPlayer = sync.componentIds.filter(
        (id: number) => id !== VideoPlayer.componentId,
      );
      SyncComponents.createOrReplace(entity, { componentIds: withoutVideoPlayer });
    }
  }

  // ── 2. Seed authoritative state ─────────────────────────────────────────────
  // VideoPlayer: seeded from VideoScreen.defaultURL (deploy-time, trusted).
  // TextAnnouncements: seeded as empty (no default announcement at deploy time).

  authoritativeAnnouncement = { text: '', author: '', id: '' };

  for (const vp of getVideoPlayers(engine)) {
    const entity = vp.entity as Entity;
    const screen = VideoScreen.getOrNull(entity);
    const video = VideoPlayer.getOrNull(entity);
    if (!video) continue;

    const src = screen?.defaultURL || video.src;
    authoritativeVideo.set(entity, {
      src,
      playing: video.playing,
      volume: video.volume,
      loop: video.loop,
    });

    if (video.src !== src) {
      VideoPlayer.getMutable(entity).src = src;
    }
  }

  // ── 3. Register command handlers ───────────────────────────────────────────

  onMessage(MSG.SET_VIDEO, (payload, _sender) => {
    const entity = payload.entity as Entity;
    const current = VideoPlayer.getOrNull(entity);
    if (!current) return;

    const updated: VideoState = {
      src: payload.src ?? current.src,
      playing: payload.playing ?? current.playing,
      volume: payload.volume ?? current.volume,
      loop: payload.loop ?? current.loop,
    };
    authoritativeVideo.set(entity, updated);

    const video = VideoPlayer.getMutable(entity);
    video.src = updated.src;
    video.playing = updated.playing;
    video.volume = updated.volume;
    video.loop = updated.loop;
    if (payload.position !== undefined) video.position = payload.position;

    adminHasActed = true;
  });

  onMessage(MSG.SET_ANNOUNCEMENT, (payload, _sender) => {
    authoritativeAnnouncement = {
      text: payload.text,
      author: payload.author,
      id: payload.id,
    };
    const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
    if (!ta) return;
    ta.text = payload.text;
    ta.author = payload.author;
    ta.id = payload.id;
    adminHasActed = true;
  });

  onMessage(MSG.CLEAR_ANNOUNCEMENT, (_payload, _sender) => {
    authoritativeAnnouncement = { text: '', author: '', id: '' };
    const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
    if (!ta) return;
    ta.text = '';
    ta.author = '';
    ta.id = '';
    adminHasActed = true;
  });

  // ── 4. State sync for late joiners ─────────────────────────────────────────

  function broadcastCurrentState() {
    const video: SyncStatePayload['video'] = [];
    for (const vp of getVideoPlayers(engine)) {
      const entity = vp.entity as Entity;
      const screen = VideoScreen.getOrNull(entity);
      const current = VideoPlayer.getOrNull(entity);
      if (!current) continue;
      if (current.src !== (screen?.defaultURL || '')) {
        video.push({ entity: entity as number, ...current });
      }
    }

    const ta = TextAnnouncements.getOrNull(adminToolkitUiEntity);
    const announcement = ta?.id ? { text: ta.text, author: ta.author ?? '', id: ta.id } : null;

    if (video.length === 0 && !announcement) return;
    emitMessage(MSG.SYNC_STATE, { video, announcement });
  }

  onMessage(MSG.SYNC_STATE, (payload: SyncStatePayload, _sender) => {
    for (const vs of payload.video) {
      const entity = vs.entity as Entity;
      authoritativeVideo.set(entity, {
        src: vs.src,
        playing: vs.playing,
        volume: vs.volume,
        loop: vs.loop,
      });
      const video = VideoPlayer.getMutableOrNull(entity);
      if (!video) continue;
      video.src = vs.src;
      if (vs.playing !== undefined) video.playing = vs.playing;
      if (vs.volume !== undefined) video.volume = vs.volume;
      if (vs.loop !== undefined) video.loop = vs.loop;
    }

    if (payload.announcement?.id) {
      authoritativeAnnouncement = { ...payload.announcement };
      const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
      if (ta) {
        ta.text = payload.announcement.text;
        ta.author = payload.announcement.author;
        ta.id = payload.announcement.id;
      }
    }

    adminHasActed = true;
  });

  onMessage(MSG.REQUEST_STATE, (_payload, _sender) => {
    if (adminHasActed) broadcastCurrentState();
  });

  playersHelper?.onEnterScene(() => {
    if (adminHasActed) broadcastCurrentState();
  });

  // Request state from any existing participant that has admin state
  emitMessage(MSG.REQUEST_STATE, {});

  // ── 5. Revert system ───────────────────────────────────────────────────────
  //
  // Attacker CRDT writes bypass SyncComponents (injected directly via LiveKit)
  // but are caught here. Admin commands update authoritativeVideo/Announcement
  // before mutating components, so legitimate changes are never reverted.

  engine.addSystem(() => {
    for (const [entity, authState] of authoritativeVideo) {
      const vp = VideoPlayer.getOrNull(entity);
      if (!vp) continue;
      if (vp.src !== authState.src) {
        const mut = VideoPlayer.getMutable(entity);
        mut.src = authState.src;
        mut.playing = authState.playing;
      }
    }

    if (authoritativeAnnouncement) {
      const ta = TextAnnouncements.getOrNull(adminToolkitUiEntity);
      if (ta && authoritativeAnnouncement.id && ta.id !== authoritativeAnnouncement.id) {
        const mut = TextAnnouncements.getMutable(adminToolkitUiEntity);
        mut.text = authoritativeAnnouncement.text;
        mut.author = authoritativeAnnouncement.author;
        mut.id = authoritativeAnnouncement.id;
      }
    }
  });

  // ── Instance ───────────────────────────────────────────────────────────────

  instance = {
    emitSetVideo(entity: Entity, props: Partial<PBVideoPlayer>) {
      emitMessage(MSG.SET_VIDEO, { entity, ...props } as Record<string, unknown>);
    },

    emitSetAnnouncement(text: string, author?: string, id?: string) {
      emitMessage(MSG.SET_ANNOUNCEMENT, {
        text,
        author: author ?? '',
        id: id ?? '',
      });
    },

    emitClearAnnouncement() {
      emitMessage(MSG.CLEAR_ANNOUNCEMENT, {});
    },

    updateAdminList(_admins: SceneAdmin[]) {
      // Reserved for future sender validation when the admin list endpoint
      // is made accessible to all scene participants.
    },
  };

  return instance;
}
