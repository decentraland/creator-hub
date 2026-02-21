import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const VIDEO_CONTROL_STATE_BASE_NAME = BaseComponentNames.VIDEO_CONTROL_STATE;

const VideoControlStateV0 = {
  endsAt: Schemas.Optional(Schemas.Int64),
  /** @deprecated streamKey is deprecated and will be removed in a future version */
  streamKey: Schemas.Optional(Schemas.String),
};

export const VIDEO_CONTROL_STATE_VERSIONS = [VideoControlStateV0];

export function defineVideoControlStateComponent(engine: IEngine) {
  return engine.defineComponent(VIDEO_CONTROL_STATE_BASE_NAME, VideoControlStateV0);
}
