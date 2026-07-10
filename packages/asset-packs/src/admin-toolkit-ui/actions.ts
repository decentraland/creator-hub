import type { Entity } from '@dcl/ecs';
import { state } from './store';
import { TabType, type PresentationState } from './types';
import type { DclCastResponse, FlattenedTrack, Participant } from './VideoControl/api';
import type { SceneAdmin } from './ModerationControl';

// Named view-state transitions — the only writers of shared panel/view state.
//
// Keep this a leaf: import only ./store and ./types, so any service (e.g. the
// presentation detector) can drive the UI without touching the component graph.
// Render code reads `state` and calls these; it must not assign `state.*` directly.

// --- Bootstrap ---
// The entity that holds the AdminTools/VideoControlState components, resolved
// once during UI setup.
export function setAdminToolkitUiEntity(entity: Entity): void {
  state.adminToolkitUiEntity = entity;
}

// --- Panel ---
export function openPanel(): void {
  state.panelOpen = true;
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

export function selectVideoPlayer(index: number): void {
  state.videoControl.selectedVideoPlayer = index;
}

// --- Smart Items ---
export function selectSmartItem(idx: number, entity: Entity, defaultAction: string): void {
  state.smartItemsControl.selectedSmartItem = idx;
  if (!state.smartItemsControl.smartItems.has(entity)) {
    const next = new Map(state.smartItemsControl.smartItems);
    next.set(entity, { visible: true, selectedAction: defaultAction });
    state.smartItemsControl = { ...state.smartItemsControl, smartItems: next };
  }
}

export function setSmartItemAction(entity: Entity, actionName: string): void {
  const current = state.smartItemsControl.smartItems.get(entity);
  if (!current) return;
  const next = new Map(state.smartItemsControl.smartItems);
  next.set(entity, { ...current, selectedAction: actionName });
  state.smartItemsControl = { ...state.smartItemsControl, smartItems: next };
}

export function setSmartItemVisibility(entity: Entity, visible: boolean): void {
  const current = state.smartItemsControl.smartItems.get(entity);
  if (!current) return;
  const next = new Map(state.smartItemsControl.smartItems);
  next.set(entity, { ...current, visible });
  state.smartItemsControl = { ...state.smartItemsControl, smartItems: next };
}

// --- Presentation lifecycle ---
// Called on the detector's presentation-started edge. Deterministic regardless of
// the current panel/tab/casting-screen because the sub-view is shared state, not a
// mount-derived local. Pass the casting screen index (findActiveCastScreenIndex) if
// one is live so the panel points at it; never auto-activates a screen. The full
// DCL Cast panel renders the presentation controls inline, so no minimize step.
export function showPresentation(castScreenIndex?: number): void {
  openPanel();
  // Force VIDEO_CONTROL open — not setActiveTab, which would toggle it closed if
  // the admin is already on it.
  state.activeTab = TabType.VIDEO_CONTROL;
  selectVideoSubTab('dcl-cast');
  if (castScreenIndex !== undefined) {
    selectVideoPlayer(castScreenIndex);
  }
  setStream('dcl-cast');
}

// Called on presentation end (bot 'stopped' or track gone). Clears the slide state;
// leaves panel/tab as-is.
export function dismissPresentation(): void {
  clearPresentationState();
}

// Detector-driven slide/video state (arrives over the 'presentation' comms topic).
export function setPresentationState(presentation: PresentationState): void {
  state.videoControl.presentationState = presentation;
}

export function clearPresentationState(): void {
  state.videoControl.presentationState = undefined;
}

export function setStream(stream: 'live' | 'dcl-cast' | undefined): void {
  state.videoControl.selectedStream = stream;
}

// Cast room info (streaming key, room id) fetched from getDclCastInfo.
export function setDclCastInfo(info: DclCastResponse): void {
  state.videoControl.dclCast = info;
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
  const { showcase } = state.videoControl;
  showcase.show = false;
  // Drop the stored handlers so their captured render closures (entity/engine/
  // controls) aren't retained while the modal is hidden.
  showcase.onSelectTrack = undefined;
  showcase.onSetDefault = undefined;
  showcase.onClose = undefined;
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
  state.videoControl.sharePresentation.onClose = undefined;
}

// --- Text Announcements ---
export function setAnnouncementText(text: string): void {
  state.textAnnouncementControl.text = text;
}

export function clearAnnouncements(): void {
  state.textAnnouncementControl.announcements = [];
}

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

export function setUnbanMessage(message: string | undefined): void {
  state.moderationControl.unbanMessage = message;
}
