import type { Entity } from '@dcl/ecs';
import type { DclCastResponse } from './VideoControl/api';

// Tab enum for type safety
export enum TabType {
  NONE = 'None',
  VIDEO_CONTROL = 'VideoControl',
  SMART_ITEMS_CONTROL = 'SmartItemsControl',
  TEXT_ANNOUNCEMENT_CONTROL = 'TextAnnouncementControl',
  MODERATION_CONTROL = 'ModerationControl',
  REWARDS_CONTROL = 'RewardsControl',
}

export type SelectedSmartItem = { visible: boolean; selectedAction: string };

export type State = {
  adminToolkitUiEntity: Entity;
  panelOpen: boolean;
  activeTab: TabType;
  videoControl: {
    selectedVideoPlayer: number | undefined;
    selectedStream: 'live' | 'dcl-cast' | undefined;
    dclCast: DclCastResponse | undefined;
  };
  smartItemsControl: {
    selectedSmartItem: number | undefined;
    smartItems: Map<Entity, SelectedSmartItem>;
  };
  textAnnouncementControl: {
    entity: Entity | undefined;
    text: string | undefined;
    messageRateTracker: Map<string, number>;
    announcements: {
      entity: Entity;
      timestamp: number;
    }[];
    maxAnnouncements: number;
  };
  rewardsControl: {
    selectedRewardItem: number | undefined;
  };
};
