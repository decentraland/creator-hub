import { BaseComponentNames } from '../constants';

function generateVersionNames(baseName: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? baseName : `${baseName}-v${index}`,
  );
}

export const VERSION_NAMES: Record<string, string[]> = {
  [BaseComponentNames.COUNTER]: generateVersionNames(BaseComponentNames.COUNTER, 2),
  [BaseComponentNames.TRIGGERS]: generateVersionNames(BaseComponentNames.TRIGGERS, 2),
  [BaseComponentNames.ACTION_TYPES]: generateVersionNames(BaseComponentNames.ACTION_TYPES, 2),
  [BaseComponentNames.ACTIONS]: generateVersionNames(BaseComponentNames.ACTIONS, 2),
  [BaseComponentNames.STATES]: generateVersionNames(BaseComponentNames.STATES, 2),
  [BaseComponentNames.COUNTER_BAR]: generateVersionNames(BaseComponentNames.COUNTER_BAR, 2),
  [BaseComponentNames.ADMIN_TOOLS]: generateVersionNames(BaseComponentNames.ADMIN_TOOLS, 2),
  [BaseComponentNames.VIDEO_SCREEN]: generateVersionNames(BaseComponentNames.VIDEO_SCREEN, 2),
  [BaseComponentNames.REWARDS]: generateVersionNames(BaseComponentNames.REWARDS, 2),
  [BaseComponentNames.TEXT_ANNOUNCEMENTS]: generateVersionNames(
    BaseComponentNames.TEXT_ANNOUNCEMENTS,
    2,
  ),
  [BaseComponentNames.VIDEO_CONTROL_STATE]: generateVersionNames(
    BaseComponentNames.VIDEO_CONTROL_STATE,
    2,
  ),
  [BaseComponentNames.SCRIPT]: generateVersionNames(BaseComponentNames.SCRIPT, 2),
};

export const getLatestVersionName = (baseName: string): string => {
  const versions = VERSION_NAMES[baseName];
  if (!versions || versions.length === 0) {
    throw new Error(`No versions found for component: ${baseName}`);
  }
  return versions[versions.length - 1];
};
