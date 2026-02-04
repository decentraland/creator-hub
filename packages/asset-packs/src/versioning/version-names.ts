import { BaseComponentNames } from '../constants';

export const VERSION_NAMES: Record<string, string[]> = {
  [BaseComponentNames.COUNTER]: ['asset-packs::Counter'],
  [BaseComponentNames.TRIGGERS]: ['asset-packs::Triggers'],
  [BaseComponentNames.ACTION_TYPES]: ['asset-packs::ActionTypes'],
  [BaseComponentNames.ACTIONS]: ['asset-packs::Actions'],
  [BaseComponentNames.STATES]: ['asset-packs::States'],
  [BaseComponentNames.COUNTER_BAR]: ['asset-packs::CounterBar'],
  [BaseComponentNames.ADMIN_TOOLS]: ['asset-packs::AdminTools'],
  [BaseComponentNames.VIDEO_SCREEN]: ['asset-packs::VideoScreen'],
  [BaseComponentNames.REWARDS]: ['asset-packs::Rewards'],
  [BaseComponentNames.TEXT_ANNOUNCEMENTS]: ['asset-packs::TextAnnouncements'],
  [BaseComponentNames.VIDEO_CONTROL_STATE]: ['asset-packs::VideoControlState'],
  [BaseComponentNames.SCRIPT]: ['asset-packs::Script'],
};

export const getLatestVersionName = (baseName: string): string => {
  const versions = VERSION_NAMES[baseName];
  if (!versions || versions.length === 0) {
    throw new Error(`No versions found for component: ${baseName}`);
  }
  return versions[versions.length - 1];
};
