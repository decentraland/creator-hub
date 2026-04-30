import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import type { AdminTools } from '../../definitions';
import { getComponents, LIVEKIT_STREAM_SRC, VIDEO_URL_TYPE } from '../../definitions';
import { getExplorerComponents } from '../../components';
import { state } from '../index';
import { getAdminMessageBus } from '../admin-message-bus';
import { DEFAULT_VOLUME } from '.';

interface VideoPlayerControls {
  play(): void;
  pause(): void;
  restart(): void;
  setVolume(volume: number): void;
  setSource(url: string): void;
  setLoop(loop: boolean): void;
}

export function getAdminToolkitVideoControl(engine: IEngine) {
  const { AdminTools } = getComponents(engine);
  const adminToolkitEntities = Array.from(engine.getEntitiesWith(AdminTools));
  return adminToolkitEntities.length > 0 ? adminToolkitEntities[0][1].videoControl : null;
}

export function getVideoPlayers(
  engine: IEngine,
): NonNullable<AdminTools['videoControl']['videoPlayers']> {
  const adminToolkitVideoControl = getAdminToolkitVideoControl(engine);

  if (
    !adminToolkitVideoControl ||
    !adminToolkitVideoControl.videoPlayers ||
    adminToolkitVideoControl.videoPlayers.length === 0
  )
    return [];

  return Array.from(adminToolkitVideoControl.videoPlayers);
}

function checkVideoPlayerSound(entity: Entity, engine: IEngine) {
  const videoControl = getAdminToolkitVideoControl(engine);
  const { VideoPlayer } = getExplorerComponents(engine);

  if (videoControl?.disableVideoPlayersSound) {
    const video = VideoPlayer.get(entity);
    if (video.volume) {
      VideoPlayer.getMutable(entity).volume = 0;
    }
  }
}

export function createVideoPlayerControls(entity: Entity, engine: IEngine): VideoPlayerControls {
  const videoControl = getAdminToolkitVideoControl(engine);
  const { VideoPlayer } = getExplorerComponents(engine);

  checkVideoPlayerSound(entity, engine);

  return {
    play: () => {
      getAdminMessageBus().emitSetVideo(entity, { playing: true, position: undefined });
    },
    pause: () => {
      getAdminMessageBus().emitSetVideo(entity, { playing: false, position: undefined });
    },
    restart: () => {
      getAdminMessageBus().emitSetVideo(entity, { playing: true, position: 0 });
    },
    setVolume: volumeOrStep => {
      if (videoControl?.disableVideoPlayersSound) {
        return;
      }
      const video = VideoPlayer.getOrNull(entity);
      if (!video) return;
      let newVolume: number;
      if (volumeOrStep === 0) {
        newVolume = 0;
      } else {
        const steps = Math.round((video.volume ?? DEFAULT_VOLUME) * 10);
        const newSteps = Math.max(0, Math.min(10, steps + (volumeOrStep as number) * 10));
        newVolume = newSteps / 10;
      }
      getAdminMessageBus().emitSetVideo(entity, { volume: newVolume, position: undefined });
    },
    setSource: url => {
      getAdminMessageBus().emitSetVideo(entity, { src: url, playing: true });
    },
    setLoop(loop) {
      getAdminMessageBus().emitSetVideo(entity, { loop, position: undefined });
    },
  };
}

export function useSelectedVideoPlayer(
  engine: IEngine,
): [Entity, DeepReadonlyObject<PBVideoPlayer>] | null {
  const { VideoPlayer } = getExplorerComponents(engine);
  const videoPlayers = getVideoPlayers(engine);

  if (videoPlayers.length === 0) return null;

  const selectedVideoPlayer = videoPlayers[state.videoControl.selectedVideoPlayer ?? 0];
  if (!selectedVideoPlayer) return null;

  const entity = selectedVideoPlayer.entity as Entity;
  const videoPlayer = VideoPlayer.getOrNull(entity);
  return videoPlayer ? [entity, videoPlayer] : null;
}

export function isDclCast(url: string) {
  return url.startsWith('livekit-video://') && state.videoControl.selectedStream === 'dcl-cast';
}

export function isLiveStream(url: string): boolean {
  return url.startsWith(LIVEKIT_STREAM_SRC) && state.videoControl.selectedStream === 'live';
}

export function isVideoUrl(url: string): boolean {
  return url.startsWith(VIDEO_URL_TYPE);
}
