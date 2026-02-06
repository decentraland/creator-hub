export const BaseComponentNames = {
  ACTION_TYPES: 'asset-packs::ActionTypes',
  ACTIONS: 'asset-packs::Actions',
  COUNTER: 'asset-packs::Counter',
  TRIGGERS: 'asset-packs::Triggers',
  STATES: 'asset-packs::States',
  COUNTER_BAR: 'asset-packs::CounterBar',
  ADMIN_TOOLS: 'asset-packs::AdminTools',
  VIDEO_SCREEN: 'asset-packs::VideoScreen',
  REWARDS: 'asset-packs::Rewards',
  TEXT_ANNOUNCEMENTS: 'asset-packs::TextAnnouncements',
  VIDEO_CONTROL_STATE: 'asset-packs::VideoControlState',
  SCRIPT: 'asset-packs::Script',
} as const;

export enum AdminPermissions {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum MediaSource {
  VideoURL,
  LiveStream,
}
