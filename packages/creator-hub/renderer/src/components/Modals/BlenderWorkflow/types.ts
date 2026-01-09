import type { BlenderInfo, TransformChange, BlenderExportMetadata } from '/shared/types/ipc';

export interface BlenderWorkflowProps {
  open: boolean;
  onClose: () => void;
  projectPath: string;
  onSyncComplete?: () => void;
}

export interface BlenderSyncState {
  isDetecting: boolean;
  isSyncing: boolean;
  blenderInfo: BlenderInfo | null;
  linkedBlendFile: string | null;
  changes: TransformChange[] | null;
  metadata: BlenderExportMetadata | null;
  error: string | null;
  showPreview: boolean;
}

