import { state } from './store';
import { TabType } from './types';
import type { FlattenedTrack, Participant } from './VideoControl/api';
import type { SceneAdmin } from './ModerationControl';

// Named view-state transitions — the only writers of shared panel/view state.
//
// Keep this a leaf: import only ./store and ./types, so any service (e.g. the
// presentation detector) can drive the UI without touching the component graph.
// Render code reads `state` and calls these; it must not assign `state.*` directly.

// --- Panel ---
export function openPanel(): void {
  state.panelOpen = true;
}

export function closePanel(): void {
  state.panelOpen = false;
}

export function togglePanel(): void {
  state.panelOpen = !state.panelOpen;
}

// --- Tabs --- selecting the already-active tab closes it (prior toggle behavior).
export function setActiveTab(tab: TabType): void {
  state.activeTab = state.activeTab === tab ? TabType.NONE : tab;
}

// --- Video Control sub-view ---
export function selectVideoSubTab(tab: 'video-url' | 'live' | 'dcl-cast'): void {
  state.videoControl.selectedTab = tab;
}

// --- DCL Cast compact/full ---
export function minimizeCast(): void {
  state.videoControl.isMinimized = true;
}

export function expandCast(): void {
  state.videoControl.isMinimized = false;
}

// --- Presentation lifecycle ---
// Called on the detector's presentation-started edge. Deterministic regardless of
// the current panel/tab/casting-screen because the sub-view is shared state, not a
// mount-derived local. Pass the casting screen index (findActiveCastScreenIndex) if
// one is live so the panel points at it; never auto-activates a screen.
export function showPresentation(castScreenIndex?: number): void {
  state.panelOpen = true;
  state.activeTab = TabType.VIDEO_CONTROL;
  state.videoControl.selectedTab = 'dcl-cast';
  if (castScreenIndex !== undefined) {
    state.videoControl.selectedVideoPlayer = castScreenIndex;
  }
  state.videoControl.selectedStream = 'dcl-cast';
  state.videoControl.isMinimized = true;
}

// Called on presentation end (bot 'stopped' or track gone). Returns to the full
// DCL Cast panel: clears slide state and un-minimizes; leaves panel/tab as-is.
export function dismissPresentation(): void {
  state.videoControl.presentationState = undefined;
  state.videoControl.isMinimized = false;
}

export function setStream(stream: 'live' | 'dcl-cast' | undefined): void {
  state.videoControl.selectedStream = stream;
}

// --- Speaker Showcase / Share Presentation modals ---
export function setParticipants(participants: Participant[]): void {
  state.videoControl.participants = participants;
}

export function openShowcase(handlers: {
  onSelectTrack: (track: FlattenedTrack) => void;
  onSetDefault: () => void;
  onClose: () => void;
}): void {
  const { showcase } = state.videoControl;
  showcase.onSelectTrack = handlers.onSelectTrack;
  showcase.onSetDefault = handlers.onSetDefault;
  showcase.onClose = handlers.onClose;
  showcase.show = true;
}

export function closeShowcase(): void {
  state.videoControl.showcase.show = false;
}

export function setShowcaseActiveTrack(sid: string | undefined): void {
  state.videoControl.showcase.activeTrackSid = sid;
}

export function openSharePresentation(onClose: () => void): void {
  state.videoControl.sharePresentation.onClose = onClose;
  state.videoControl.sharePresentation.show = true;
}

export function closeSharePresentation(): void {
  state.videoControl.sharePresentation.show = false;
}

// --- Text Announcements ---
export function showAnnouncementBanner(kind: 'sent' | 'cleared'): void {
  state.textAnnouncementControl.banner = kind;
}

export function clearAnnouncementBanner(): void {
  state.textAnnouncementControl.banner = undefined;
}

// --- Moderation modals ---
export function openAdminList(): void {
  state.moderationControl.showModalAdminList = true;
}

export function closeAdminList(): void {
  state.moderationControl.showModalAdminList = false;
}

export function openBanList(): void {
  state.moderationControl.showModalBanList = true;
}

export function closeBanList(): void {
  state.moderationControl.showModalBanList = false;
}

export function confirmRemoveAdmin(admin: SceneAdmin): void {
  state.moderationControl.adminToRemove = admin;
}

export function cancelRemoveAdmin(): void {
  state.moderationControl.adminToRemove = undefined;
}

export function setUnbanMessage(message: string | null): void {
  state.moderationControl.unbanMessage = message;
}
