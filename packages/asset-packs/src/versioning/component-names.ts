import { BaseComponentNames } from '../constants';
import {
  COUNTER_VERSIONS,
  TRIGGERS_VERSIONS,
  ACTION_TYPES_VERSIONS,
  ACTIONS_VERSIONS,
  STATES_VERSIONS,
  COUNTER_BAR_VERSIONS,
  ADMIN_TOOLS_VERSIONS,
  VIDEO_SCREEN_VERSIONS,
  REWARDS_VERSIONS,
  TEXT_ANNOUNCEMENTS_VERSIONS,
  VIDEO_CONTROL_STATE_VERSIONS,
  SCRIPT_VERSIONS,
} from './definitions';

const VERSION_ARRAYS: Record<string, readonly any[]> = {
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
};

export function getLatestVersionName(baseName: string): string {
  const versions = VERSION_ARRAYS[baseName];
  if (!versions || versions.length === 0) {
    throw new Error(`No versions found for component: ${baseName}`);
  }

  const count = versions.length;
  return count === 1 ? baseName : `${baseName}-v${count - 1}`;
}

export const COMPONENT_NAMES = {
  ACTION_TYPES: getLatestVersionName(BaseComponentNames.ACTION_TYPES),
  ACTIONS: getLatestVersionName(BaseComponentNames.ACTIONS),
  COUNTER: getLatestVersionName(BaseComponentNames.COUNTER),
  TRIGGERS: getLatestVersionName(BaseComponentNames.TRIGGERS),
  STATES: getLatestVersionName(BaseComponentNames.STATES),
  COUNTER_BAR: getLatestVersionName(BaseComponentNames.COUNTER_BAR),
  ADMIN_TOOLS: getLatestVersionName(BaseComponentNames.ADMIN_TOOLS),
  VIDEO_SCREEN: getLatestVersionName(BaseComponentNames.VIDEO_SCREEN),
  REWARDS: getLatestVersionName(BaseComponentNames.REWARDS),
  TEXT_ANNOUNCEMENTS: getLatestVersionName(BaseComponentNames.TEXT_ANNOUNCEMENTS),
  VIDEO_CONTROL_STATE: getLatestVersionName(BaseComponentNames.VIDEO_CONTROL_STATE),
  SCRIPT: getLatestVersionName(BaseComponentNames.SCRIPT),
} as const;
