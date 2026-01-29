import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames, MediaSource } from '../../constants';

const VIDEO_SCREEN_BASE_NAME = BaseComponentNames.VIDEO_SCREEN;

const VideoScreenV0 = {
  thumbnail: Schemas.String,
  defaultMediaSource: Schemas.EnumNumber<MediaSource>(MediaSource, MediaSource.VideoURL),
  defaultURL: Schemas.String,
};

const VideoScreenV1 = {
  ...VideoScreenV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const VIDEO_SCREEN_VERSIONS = [
  { versionName: VIDEO_SCREEN_BASE_NAME, component: VideoScreenV0 },
  { versionName: `${VIDEO_SCREEN_BASE_NAME}-v1`, component: VideoScreenV1 },
];

export function defineVideoScreenComponent(engine: IEngine) {
  engine.defineComponent(VIDEO_SCREEN_BASE_NAME, VideoScreenV0);
  return engine.defineComponent(`${VIDEO_SCREEN_BASE_NAME}-v1`, VideoScreenV1);
}
