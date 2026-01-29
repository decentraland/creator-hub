import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const TEXT_ANNOUNCEMENTS_BASE_NAME = BaseComponentNames.TEXT_ANNOUNCEMENTS;

const TextAnnouncementsV0 = {
  text: Schemas.String,
  author: Schemas.Optional(Schemas.String),
  id: Schemas.String,
};

const TextAnnouncementsV1 = {
  ...TextAnnouncementsV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const TEXT_ANNOUNCEMENTS_VERSIONS = [
  { versionName: TEXT_ANNOUNCEMENTS_BASE_NAME, component: TextAnnouncementsV0 },
  { versionName: `${TEXT_ANNOUNCEMENTS_BASE_NAME}-v1`, component: TextAnnouncementsV1 },
];

export function defineTextAnnouncementsComponent(engine: IEngine) {
  engine.defineComponent(TEXT_ANNOUNCEMENTS_BASE_NAME, TextAnnouncementsV0);
  return engine.defineComponent(`${TEXT_ANNOUNCEMENTS_BASE_NAME}-v1`, TextAnnouncementsV1);
}
