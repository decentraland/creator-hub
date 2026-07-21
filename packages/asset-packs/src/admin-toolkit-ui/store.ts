import { type Entity } from '@dcl/ecs';
import { type State, TabType, type SelectedSmartItem } from './types';

// Single source of truth for Admin Toolkit view state.
//
// Lives in a leaf module (imports only ./types) so services like the boot-time
// presentation detector can read/write UI state without pulling in the component
// graph through index.tsx — which previously formed a
// detector -> VideoControl/utils -> index -> detector import cycle (the
// barrel/circular-import hazard called out in CLAUDE.md). All writes to this
// object go through ./actions.
export const state: State = {
  adminToolkitUiEntity: 0 as Entity,
  panelOpen: false,
  activeTab: TabType.NONE,
  videoControl: {
    selectedVideoPlayer: undefined,
    selectedStream: undefined,
    selectedTab: undefined,
    dclCast: undefined,
    presentationState: undefined,
    participants: [],
    showcase: {
      show: false,
      activeTrackSid: undefined,
      onSelectTrack: undefined,
      onSetDefault: undefined,
      onClose: undefined,
    },
    sharePresentation: {
      show: false,
      onClose: undefined,
    },
  },
  smartItemsControl: {
    selectedSmartItem: undefined,
    smartItems: new Map<Entity, SelectedSmartItem>(),
  },
  textAnnouncementControl: {
    entity: undefined,
    text: undefined,
    messageRateTracker: new Map<string, number>(),
    announcements: [],
    maxAnnouncements: 4,
  },
  moderationControl: {
    showModalAdminList: false,
    adminToRemove: undefined,
    showModalBanList: false,
    unbanMessage: undefined,
  },
};
