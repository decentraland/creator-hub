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
type AnnouncementState = { text: string; author: string; id: string };

interface SyncStatePayload {
  video: Array<{ entity: number } & VideoState>;
  announcement: AnnouncementState | null;
}

const MSG_SET_VIDEO = 'admin:set-video';
const MSG_SET_ANNOUNCEMENT = 'admin:set-announcement';
const MSG_CLEAR_ANNOUNCEMENT = 'admin:clear-announcement';
const MSG_REQUEST_STATE = 'admin:request-state';
const MSG_SYNC_STATE = 'admin:sync-state';

// ── AdminMessageBus ──────────────────────────────────────────────────────────
//
// Admin commands flow via the text comms channel (MessageBus). CRDT sync for
// VideoPlayer is disabled on admin-controlled entities (SyncComponents removal)
// so attacker CRDT writes don't propagate.
//
// Sending: uses communicationsController.send() directly (bypasses the
// MessageBus class's flush queue which drops subsequent messages).
//
// Receiving: uses a MessageBus instance's on() method (which registers on the
// global onCommsMessage observable — works reliably for all messages).

interface AdminMessageBusInstance {
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

  // Receiver bus — only used for on() handlers (receiving from other participants)
  const receiver = new MessageBus();

  function sendToAll(type: string, payload: Record<string, unknown>) {
    const raw = JSON.stringify({ message: type, payload });
    commsSend({ message: raw }).catch(() => {});
  }

  function emitMessage(type: string, payload: Record<string, unknown>) {
    // Handle locally first (synchronous)
    const handler = messageHandlers.get(type);
    if (handler) handler(payload, 'self');
    // Send to remote participants (direct call, no queue)
    sendToAll(type, payload);
  }

  const messageHandlers = new Map<string, (payload: any, sender: string) => void>();

  function onMessage(type: string, handler: (payload: any, sender: string) => void) {
    messageHandlers.set(type, handler);
    // Register on receiver for remote messages
    receiver.on(type, handler);
  }

  function broadcastState() {
    const video: SyncStatePayload['video'] = [];
    for (const vp of getVideoPlayers(engine)) {
      const entity = vp.entity as Entity;
      const screen = VideoScreen.getOrNull(entity);
      const current = VideoPlayer.getOrNull(entity);
      if (!current) continue;
      const defaultSrc = screen?.defaultURL || '';
      if (current.src !== defaultSrc) {
        video.push({
          entity: entity as number,
          src: current.src,
          playing: current.playing,
          volume: current.volume,
          loop: current.loop,
        });
      }
    }
    const ta = TextAnnouncements.getOrNull(adminToolkitUiEntity);
    const announcement = ta?.id ? { text: ta.text, author: ta.author ?? '', id: ta.id } : null;
    if (video.length === 0 && !announcement) return;
    emitMessage(MSG_SYNC_STATE, { video, announcement });
  }

  // ── Disable CRDT sync for VideoPlayer on admin-controlled entities ─────────

  for (const vp of getVideoPlayers(engine)) {
    const entity = vp.entity as Entity;
    const sync = SyncComponents.getOrNull(entity);
    if (sync) {
      const filtered = sync.componentIds.filter((id: number) => id !== VideoPlayer.componentId);
      SyncComponents.createOrReplace(entity, { componentIds: filtered });
    }
  }

  // ── Seed from VideoScreen.defaultURL ───────────────────────────────────────

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

  // ── Command handlers ───────────────────────────────────────────────────────

  onMessage(MSG_SET_VIDEO, (payload: any, _sender: string) => {
    const entity = payload.entity as Entity;
    const current = VideoPlayer.getOrNull(entity);
    if (!current) return;

    const newState: VideoState = {
      src: payload.src ?? current.src,
      playing: payload.playing ?? current.playing,
      volume: payload.volume ?? current.volume,
      loop: payload.loop ?? current.loop,
    };
    authoritativeVideo.set(entity, newState);

    const video = VideoPlayer.getMutable(entity);
    video.src = newState.src;
    video.playing = newState.playing;
    video.volume = newState.volume;
    video.loop = newState.loop;
    if (payload.position !== undefined) video.position = payload.position;

    adminHasActed = true;
  });

  onMessage(MSG_SET_ANNOUNCEMENT, (payload: any, _sender: string) => {
    authoritativeAnnouncement = { text: payload.text, author: payload.author, id: payload.id };
    const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
    if (!ta) return;
    ta.text = payload.text;
    ta.author = payload.author;
    ta.id = payload.id;
    adminHasActed = true;
  });

  onMessage(MSG_CLEAR_ANNOUNCEMENT, (_payload: any, _sender: string) => {
    authoritativeAnnouncement = { text: '', author: '', id: '' };
    const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
    if (!ta) return;
    ta.text = '';
    ta.author = '';
    ta.id = '';
    adminHasActed = true;
  });

  // ── State sync for late joiners ────────────────────────────────────────────

  onMessage(MSG_SYNC_STATE, (payload: SyncStatePayload, _sender: string) => {
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
    if (payload.announcement && payload.announcement.id) {
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

  onMessage(MSG_REQUEST_STATE, (_payload: any, _sender: string) => {
    if (!adminHasActed) return;
    broadcastState();
  });

  playersHelper?.onEnterScene(() => {
    if (adminHasActed) {
      broadcastState();
    }
  });

  emitMessage(MSG_REQUEST_STATE, {});

  // ── Revert system ──────────────────────────────────────────────────────────
  // Since CRDT sync is disabled for VideoPlayer on admin entities, the only
  // CRDT writes that can change VideoPlayer come from the attacker's raw
  // PUT_COMPONENT injection. This system reverts those.

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

  // ── Public interface ───────────────────────────────────────────────────────

  instance = {
    emitSetVideo(entity: Entity, props: Partial<PBVideoPlayer>) {
      emitMessage(MSG_SET_VIDEO, { entity, ...props } as Record<string, unknown>);
    },
    emitSetAnnouncement(text: string, author?: string, id?: string) {
      emitMessage(MSG_SET_ANNOUNCEMENT, {
        text,
        author: author ?? '',
        id: id ?? '',
      });
    },
    emitClearAnnouncement() {
      emitMessage(MSG_CLEAR_ANNOUNCEMENT, {});
    },
    updateAdminList(_admins: SceneAdmin[]) {
      // Reserved for future use
    },
  };

  return instance;
}
