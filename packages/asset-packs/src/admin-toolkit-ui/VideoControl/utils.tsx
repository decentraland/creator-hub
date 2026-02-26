import { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { getComponents, LIVEKIT_STREAM_SRC, VIDEO_URL_TYPE, AdminTools } from '../../definitions';
import { getExplorerComponents } from '../../components';
import { nextTickFunctions, state } from '../index';
import { DEFAULT_VOLUME } from '.';

// Types
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
      const video = VideoPlayer.getMutable(entity);
      video.playing = true;
      video.position = undefined;
    },
    pause: () => {
      const video = VideoPlayer.getMutable(entity);
      video.playing = false;
      video.position = undefined;
    },
    restart: () => {
      const video = VideoPlayer.getMutable(entity);
      video.playing = false;
      video.position = 0;
      nextTickFunctions.push(() => {
        const video = VideoPlayer.getMutable(entity);
        video.position = undefined;
        video.playing = true;
      });
    },
    setVolume: volumeOrStep => {
      // Don't allow volume changes if sound is disabled
      if (videoControl?.disableVideoPlayersSound) {
        return;
      }
      const video = VideoPlayer.getMutable(entity);
      video.position = undefined;
      if (volumeOrStep === 0) {
        video.volume = 0;
      } else {
        const steps = Math.round((video.volume ?? DEFAULT_VOLUME) * 10);
        const newSteps = Math.max(0, Math.min(10, steps + (volumeOrStep as number) * 10));
        video.volume = newSteps / 10;
      }
    },
    setSource: url => {
      VideoPlayer.getMutable(entity).src = url;
      nextTickFunctions.push(() => {
        VideoPlayer.getMutable(entity).playing = true;
      });
    },
    setLoop(loop) {
      const video = VideoPlayer.getMutable(entity);
      video.loop = loop;
      video.position = undefined;
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
  return url.startsWith(LIVEKIT_STREAM_SRC) && state.videoControl.selectedStream === 'dcl-cast';
}

export function isLiveStream(url: string): boolean {
  return url.startsWith(LIVEKIT_STREAM_SRC) && state.videoControl.selectedStream === 'live';
}

export function isVideoUrl(url: string): boolean {
  return url.startsWith(VIDEO_URL_TYPE);
}
