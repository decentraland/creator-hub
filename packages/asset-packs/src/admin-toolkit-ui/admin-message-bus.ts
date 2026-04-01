import type { Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { MessageBus } from '@dcl/sdk/message-bus';
import { getExplorerComponents } from '../components';
import { getComponents } from '../definitions';
import { isPreview } from './fetch-utils';
import type { SceneAdmin } from './ModerationControl';
import { getVideoPlayers } from './VideoControl/utils';

interface SetVideoMessage {
  entity: number;
  src?: string;
  playing?: boolean;
  volume?: number;
  loop?: boolean;
  position?: number;
}

interface SetAnnouncementMessage {
  text: string;
  author: string;
  id: string;
}

type VideoState = Pick<PBVideoPlayer, 'src' | 'playing' | 'volume' | 'loop'>;
type AnnouncementState = { text: string; author: string; id: string };

const MSG_SET_VIDEO = 'admin:set-video';
const MSG_SET_ANNOUNCEMENT = 'admin:set-announcement';
const MSG_CLEAR_ANNOUNCEMENT = 'admin:clear-announcement';

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
  admins: SceneAdmin[],
  adminToolkitUiEntity: Entity,
): AdminMessageBusInstance {
  let sceneAdmins = admins;
  const bus = new MessageBus();

  const { VideoPlayer } = getExplorerComponents(engine);
  const { TextAnnouncements, VideoScreen } = getComponents(engine);

  const authoritativeVideo = new Map<Entity, VideoState>();
  let authoritativeAnnouncement: AnnouncementState | null = null;

  function isAdminWallet(sender: string): boolean {
    if (isPreview()) return true;
    if (sender === 'self') return true;
    return sceneAdmins.some(admin => admin.address.toLowerCase() === sender.toLowerCase());
  }

  bus.on(MSG_SET_VIDEO, (payload: SetVideoMessage, sender: string) => {
    if (!isAdminWallet(sender)) {
      console.log(`[AdminTools] Rejected video change from non-admin: ${sender}`);
      return;
    }
    const entity = payload.entity as Entity;
    const video = VideoPlayer.getMutableOrNull(entity);
    if (!video) return;

    if (payload.src !== undefined) video.src = payload.src;
    if (payload.playing !== undefined) video.playing = payload.playing;
    if (payload.volume !== undefined) video.volume = payload.volume;
    if (payload.loop !== undefined) video.loop = payload.loop;
    if (payload.position !== undefined) video.position = payload.position;

    authoritativeVideo.set(entity, {
      src: video.src,
      playing: video.playing,
      volume: video.volume,
      loop: video.loop,
    });
  });

  bus.on(MSG_SET_ANNOUNCEMENT, (payload: SetAnnouncementMessage, sender: string) => {
    if (!isAdminWallet(sender)) {
      console.log(`[AdminTools] Rejected announcement from non-admin: ${sender}`);
      return;
    }
    const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
    if (!ta) return;

    ta.text = payload.text;
    ta.author = payload.author;
    ta.id = payload.id;
    authoritativeAnnouncement = { text: payload.text, author: payload.author, id: payload.id };
  });

  bus.on(MSG_CLEAR_ANNOUNCEMENT, (_payload: Record<string, never>, sender: string) => {
    if (!isAdminWallet(sender)) {
      console.log(`[AdminTools] Rejected clear announcement from non-admin: ${sender}`);
      return;
    }
    const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
    if (!ta) return;

    ta.text = '';
    ta.author = '';
    ta.id = '';
    authoritativeAnnouncement = { text: '', author: '', id: '' };
  });

  // ── Seed authoritative state from VideoScreen.defaultURL ───────────────────
  // VideoScreen is a scene-config component set at deploy time — not writable
  // via CRDT by other participants, so it's a trusted source for the initial
  // video URL. Falls back to the current VideoPlayer value if VideoScreen is
  // not present on the entity.

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
    // Force-correct VideoPlayer if it was already poisoned by CRDT state sync
    if (video.src !== src) {
      VideoPlayer.getMutable(entity).src = src;
    }
  }

  // Only runs checks when a component actually changed, using onChange.
  for (const [entity] of authoritativeVideo) {
    VideoPlayer.onChange(entity, video => {
      const authState = authoritativeVideo.get(entity);
      if (!authState || !video) return;
      if (video.src !== authState.src) {
        const mut = VideoPlayer.getMutable(entity);
        mut.src = authState.src;
        mut.playing = authState.playing;
      }
    });
  }

  TextAnnouncements.onChange(adminToolkitUiEntity, ta => {
    if (!authoritativeAnnouncement || !ta) return;
    if (authoritativeAnnouncement.id && ta.id !== authoritativeAnnouncement.id) {
      const mut = TextAnnouncements.getMutable(adminToolkitUiEntity);
      mut.text = authoritativeAnnouncement.text;
      mut.author = authoritativeAnnouncement.author;
      mut.id = authoritativeAnnouncement.id;
    }
  });

  instance = {
    emitSetVideo(entity: Entity, props: Partial<PBVideoPlayer>) {
      bus.emit(MSG_SET_VIDEO, { entity, ...props } as Record<string, unknown>);
    },
    emitSetAnnouncement(text: string, author?: string, id?: string) {
      bus.emit(MSG_SET_ANNOUNCEMENT, {
        text,
        author: author ?? '',
        id: id ?? '',
      } as Record<string, unknown>);
    },
    emitClearAnnouncement() {
      bus.emit(MSG_CLEAR_ANNOUNCEMENT, {});
    },
    updateAdminList(admins: SceneAdmin[]) {
      sceneAdmins = admins;
    },
  };

  return instance;
}
