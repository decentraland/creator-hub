import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const TEXT_ANNOUNCEMENTS_BASE_NAME = BaseComponentNames.TEXT_ANNOUNCEMENTS;

const TextAnnouncementsV0 = {
  text: Schemas.String,
  author: Schemas.Optional(Schemas.String),
  id: Schemas.String,
};

export const TEXT_ANNOUNCEMENTS_VERSIONS = [TextAnnouncementsV0];

export function defineTextAnnouncementsComponent(engine: IEngine) {
  return engine.defineComponent(TEXT_ANNOUNCEMENTS_BASE_NAME, TextAnnouncementsV0);
}
