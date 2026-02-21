import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames, AdminPermissions } from '../../constants';

const ADMIN_TOOLS_BASE_NAME = BaseComponentNames.ADMIN_TOOLS;

const AdminToolsV0 = {
  adminPermissions: Schemas.EnumString<AdminPermissions>(AdminPermissions, AdminPermissions.PUBLIC),
  authorizedAdminUsers: Schemas.Map({
    me: Schemas.Boolean,
    sceneOwners: Schemas.Boolean,
    allowList: Schemas.Boolean,
    adminAllowList: Schemas.Array(Schemas.String),
  }),
  moderationControl: Schemas.Map({
    isEnabled: Schemas.Boolean,
    kickCoordinates: Schemas.Map({
      x: Schemas.Number,
      y: Schemas.Number,
      z: Schemas.Number,
    }),
    allowNonOwnersManageAdminAllowList: Schemas.Boolean,
  }),
  textAnnouncementControl: Schemas.Map({
    isEnabled: Schemas.Boolean,
    playSoundOnEachAnnouncement: Schemas.Boolean,
    showAuthorOnEachAnnouncement: Schemas.Boolean,
  }),
  videoControl: Schemas.Map({
    isEnabled: Schemas.Boolean,
    disableVideoPlayersSound: Schemas.Boolean,
    showAuthorOnVideoPlayers: Schemas.Boolean,
    linkAllVideoPlayers: Schemas.Boolean,
    videoPlayers: Schemas.Optional(
      Schemas.Array(
        Schemas.Map({
          entity: Schemas.Int,
          customName: Schemas.String,
        }),
      ),
    ),
  }),
  smartItemsControl: Schemas.Map({
    isEnabled: Schemas.Boolean,
    linkAllSmartItems: Schemas.Boolean,
    smartItems: Schemas.Optional(
      Schemas.Array(
        Schemas.Map({
          entity: Schemas.Int,
          customName: Schemas.String,
          defaultAction: Schemas.String,
        }),
      ),
    ),
  }),
  rewardsControl: Schemas.Map({
    isEnabled: Schemas.Boolean,
    rewardItems: Schemas.Optional(
      Schemas.Array(
        Schemas.Map({
          entity: Schemas.Int,
          customName: Schemas.String,
        }),
      ),
    ),
  }),
};

export const ADMIN_TOOLS_VERSIONS = [AdminToolsV0];

export function defineAdminToolsComponent(engine: IEngine) {
  return engine.defineComponent(ADMIN_TOOLS_BASE_NAME, AdminToolsV0);
}
