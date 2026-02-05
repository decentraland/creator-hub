import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames, MediaSource } from '../../constants';

const VIDEO_SCREEN_BASE_NAME = BaseComponentNames.VIDEO_SCREEN;

const VideoScreenV0 = {
  thumbnail: Schemas.String,
  defaultMediaSource: Schemas.EnumNumber<MediaSource>(MediaSource, MediaSource.VideoURL),
  defaultURL: Schemas.String,
};

export const VIDEO_SCREEN_VERSIONS = [VideoScreenV0];

export function defineVideoScreenComponent(engine: IEngine) {
  return engine.defineComponent(VIDEO_SCREEN_BASE_NAME, VideoScreenV0);
}
