import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const VIDEO_CONTROL_STATE_BASE_NAME = BaseComponentNames.VIDEO_CONTROL_STATE;

const VideoControlStateV0 = {
  endsAt: Schemas.Optional(Schemas.Int64),
  /** @deprecated streamKey is deprecated and will be removed in a future version */
  streamKey: Schemas.Optional(Schemas.String),
};

const VideoControlStateV1 = {
  ...VideoControlStateV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const VIDEO_CONTROL_STATE_VERSIONS = [
  { versionName: VIDEO_CONTROL_STATE_BASE_NAME, component: VideoControlStateV0 },
  { versionName: `${VIDEO_CONTROL_STATE_BASE_NAME}-v1`, component: VideoControlStateV1 },
];

export function defineVideoControlStateComponent(engine: IEngine) {
  engine.defineComponent(VIDEO_CONTROL_STATE_BASE_NAME, VideoControlStateV0);
  return engine.defineComponent(`${VIDEO_CONTROL_STATE_BASE_NAME}-v1`, VideoControlStateV1);
}
