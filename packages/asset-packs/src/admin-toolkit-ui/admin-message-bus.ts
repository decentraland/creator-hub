import type { Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { getExplorerComponents } from '../components';
import { getComponents } from '../definitions';
import type { IPlayersHelper } from '../types';
import type { SceneAdmin } from './ModerationControl';
import { getVideoPlayers } from './VideoControl/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type VideoState = Pick<PBVideoPlayer, 'src' | 'playing' | 'volume' | 'loop'>;
type AnnouncementState = { text: string; author: string; id: string };

// ── AdminMessageBus ──────────────────────────────────────────────────────────

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
  _playersHelper?: IPlayersHelper,
): AdminMessageBusInstance {
  let _sceneAdmins = admins;

  const { VideoPlayer } = getExplorerComponents(engine);
  const { TextAnnouncements, VideoScreen } = getComponents(engine);

  // Authoritative state: seeded from VideoScreen.defaultURL, updated when the
  // local admin acts. The onChange handler reverts any CRDT write that doesn't
  // match this state.
  const authoritativeVideo = new Map<Entity, VideoState>();
  let authoritativeAnnouncement: AnnouncementState | null = null;

  // ── Seed ───────────────────────────────────────────────────────────────────
  // VideoScreen.defaultURL is set at deploy time and not writable via CRDT by
  // other participants. It provides a safe baseline. If no VideoScreen exists,
  // falls back to the current VideoPlayer value (from main.crdt).

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

  // ── Revert system ──────────────────────────────────────────────────────────
  // Reverts unauthorized CRDT writes by comparing against authoritative state.
  // When the local admin changes the video, authoritative state is updated
  // first, so their change passes through. When an attacker sends a CRDT write,
  // the authoritative state doesn't match and the change is reverted.

  for (const vp of getVideoPlayers(engine)) {
    const entity = vp.entity as Entity;
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

  // ── Public interface ───────────────────────────────────────────────────────
  // Admin actions write directly to CRDT components (for propagation to all
  // participants) and update the local authoritative state (so the onChange
  // handler allows the change instead of reverting it).

  instance = {
    emitSetVideo(entity: Entity, props: Partial<PBVideoPlayer>) {
      const video = VideoPlayer.getMutableOrNull(entity);
      if (!video) return;

      if (props.src !== undefined) video.src = props.src;
      if (props.playing !== undefined) video.playing = props.playing;
      if (props.volume !== undefined) video.volume = props.volume;
      if (props.loop !== undefined) video.loop = props.loop;
      if (props.position !== undefined) video.position = props.position;

      authoritativeVideo.set(entity, {
        src: video.src,
        playing: video.playing,
        volume: video.volume,
        loop: video.loop,
      });
    },
    emitSetAnnouncement(text: string, author?: string, id?: string) {
      const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
      if (!ta) return;
      ta.text = text;
      ta.author = author ?? '';
      ta.id = id ?? '';
      authoritativeAnnouncement = { text, author: author ?? '', id: id ?? '' };
    },
    emitClearAnnouncement() {
      const ta = TextAnnouncements.getMutableOrNull(adminToolkitUiEntity);
      if (!ta) return;
      ta.text = '';
      ta.author = '';
      ta.id = '';
      authoritativeAnnouncement = { text: '', author: '', id: '' };
    },
    updateAdminList(admins: SceneAdmin[]) {
      _sceneAdmins = admins;
    },
  };

  return instance;
}
