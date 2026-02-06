import type { ISchema } from '@dcl/ecs';
import { BaseComponentNames } from '../constants';

export type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};
import { COUNTER_VERSIONS } from './definitions/counter';
import { TRIGGERS_VERSIONS } from './definitions/triggers';
import { ACTION_TYPES_VERSIONS } from './definitions/action-types';
import { ACTIONS_VERSIONS } from './definitions/actions';
import { STATES_VERSIONS } from './definitions/states';
import { COUNTER_BAR_VERSIONS } from './definitions/counter-bar';
import { ADMIN_TOOLS_VERSIONS } from './definitions/admin-tools';
import { VIDEO_SCREEN_VERSIONS } from './definitions/video-screen';
import { REWARDS_VERSIONS } from './definitions/rewards';
import { TEXT_ANNOUNCEMENTS_VERSIONS } from './definitions/text-announcements';
import { VIDEO_CONTROL_STATE_VERSIONS } from './definitions/video-control-state';
import { SCRIPT_VERSIONS } from './definitions/script';

export { BaseComponentNames };

export {
  defineCounterComponent,
  defineTriggersComponent,
  defineActionTypesComponent,
  defineActionsComponent,
  defineStatesComponent,
  defineCounterBarComponent,
  defineAdminToolsComponent,
  defineVideoScreenComponent,
  defineRewardsComponent,
  defineTextAnnouncementsComponent,
  defineVideoControlStateComponent,
  defineScriptComponent,
} from './definitions';

function createVersionedComponents<T extends readonly any[]>(
  baseName: string,
  schemas: T,
): VersionedComponent[] {
  return schemas.map((schema, index) => ({
    versionName: index === 0 ? baseName : `${baseName}-v${index}`,
    component: schema,
  }));
}

const VERSIONS_REGISTRY_RAW = {
  [BaseComponentNames.COUNTER]: COUNTER_VERSIONS,
  [BaseComponentNames.TRIGGERS]: TRIGGERS_VERSIONS,
  [BaseComponentNames.ACTION_TYPES]: ACTION_TYPES_VERSIONS,
  [BaseComponentNames.ACTIONS]: ACTIONS_VERSIONS,
  [BaseComponentNames.STATES]: STATES_VERSIONS,
  [BaseComponentNames.COUNTER_BAR]: COUNTER_BAR_VERSIONS,
  [BaseComponentNames.ADMIN_TOOLS]: ADMIN_TOOLS_VERSIONS,
  [BaseComponentNames.VIDEO_SCREEN]: VIDEO_SCREEN_VERSIONS,
  [BaseComponentNames.REWARDS]: REWARDS_VERSIONS,
  [BaseComponentNames.TEXT_ANNOUNCEMENTS]: TEXT_ANNOUNCEMENTS_VERSIONS,
  [BaseComponentNames.VIDEO_CONTROL_STATE]: VIDEO_CONTROL_STATE_VERSIONS,
  [BaseComponentNames.SCRIPT]: SCRIPT_VERSIONS,
} as const;

export const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = Object.fromEntries(
  Object.entries(VERSIONS_REGISTRY_RAW).map(([baseName, schemas]) => [
    baseName,
    createVersionedComponents(baseName, schemas),
  ]),
);
