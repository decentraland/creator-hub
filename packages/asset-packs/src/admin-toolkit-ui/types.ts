import type { Entity } from '@dcl/ecs';
import type { DclCastResponse, FlattenedTrack, Participant } from './VideoControl/api';
import type { SceneAdmin } from './ModerationControl';

// Tab enum for type safety
export enum TabType {
  NONE = 'None',
  VIDEO_CONTROL = 'VideoControl',
  SMART_ITEMS_CONTROL = 'SmartItemsControl',
  TEXT_ANNOUNCEMENT_CONTROL = 'TextAnnouncementControl',
  MODERATION_CONTROL = 'ModerationControl',
}

export type SelectedSmartItem = { visible: boolean; selectedAction: string };

export type PresentationState = {
  id: string;
  fileName: string;
  currentSlide: number;
  slideCount: number;
  fileType: 'pdf' | 'pptx';
  slideVideos: Array<{
    url: string;
    geometry: { x: number; y: number; width: number; height: number };
  }>;
  videoState: 'idle' | 'loading' | 'playing' | 'paused';
};

export type State = {
  adminToolkitUiEntity: Entity;
  panelOpen: boolean;
  activeTab: TabType;
  videoControl: {
    selectedVideoPlayer: number | undefined;
    selectedStream: 'live' | 'dcl-cast' | undefined;
    selectedTab: 'video-url' | 'live' | 'dcl-cast' | undefined;
    dclCast: DclCastResponse | undefined;
    isMinimized: boolean;
    presentationState: PresentationState | undefined;
    participants: Participant[];
    showcase: {
      show: boolean;
      activeTrackSid: string | undefined;
      onSelectTrack: ((track: FlattenedTrack) => void) | undefined;
      onSetDefault: (() => void) | undefined;
      onClose: (() => void) | undefined;
    };
    sharePresentation: {
      show: boolean;
      onClose: (() => void) | undefined;
    };
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
    banner: 'sent' | 'cleared' | undefined;
  };
  moderationControl: {
    showModalAdminList: boolean;
    adminToRemove: SceneAdmin | undefined;
    showModalBanList: boolean;
    unbanMessage: string | null;
  };
};
