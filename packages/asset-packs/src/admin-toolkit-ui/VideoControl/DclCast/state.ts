import type { FlattenedTrack, Participant } from '../api';

// Shared, mutable DCL Cast UI singletons.
//
// These live in a pure leaf module (no JSX) so the boot-time presentation
// detector can update them without importing the DclCast component graph, and
// to keep the admin-toolkit import graph free of the barrel/circular-import
// hazard called out in CLAUDE.md.

export const showcaseState: {
  show: boolean;
  participants: Participant[];
  activeTrackSid: string | undefined;
  onSelectTrack: ((track: FlattenedTrack) => void) | undefined;
  onSetDefault: (() => void) | undefined;
  onClose: (() => void) | undefined;
} = {
  show: false,
  participants: [],
  activeTrackSid: undefined,
  onSelectTrack: undefined,
  onSetDefault: undefined,
  onClose: undefined,
};

export const sharePresentationState: {
  show: boolean;
  onClose: (() => void) | undefined;
} = {
  show: false,
  onClose: undefined,
};
