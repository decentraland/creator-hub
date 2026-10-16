import type React from 'react';
import type { TreeNode } from '../ProjectView';

export interface Props {
  valueId: string;
  value?: TreeNode;
  getDragContext: () => unknown;
  /** Single click: selects the card (Ctrl/Cmd toggles it, Shift selects a range). */
  onClick: (event: React.MouseEvent) => void;
  /** Double click: opens folders. */
  onSelect: () => void;
  onRemove: (value: string) => void;
  onRename: (value: string, newName: string) => void;
  onDuplicate: (value: string) => void;
  onCopyRelativePath: (value: string) => void;
  onCopyFileName: (value: string) => void;
  /** Items the context menu acts on: the whole selection when this card is part of it. */
  actionCount?: number;
  /** Paths a drag that starts on this card carries: the selection when the card is in it. */
  getDragItems: (value: string) => string[];
  /** Drop of other cards / tree rows onto a folder card, which moves them inside it. */
  onDropItems: (items: string[], folder: string) => void;
  selected?: boolean;
  dndType: string;
  /** Saved thumbnail for a model, when there is one. */
  thumbnail?: Uint8Array | null;
  /** True while a thumbnail for this model is still being generated. */
  thumbnailPending?: boolean;
}
