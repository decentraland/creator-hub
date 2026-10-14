import type { TreeNode } from '../ProjectView';

export interface Props {
  valueId: string;
  value?: TreeNode;
  getDragContext: () => unknown;
  /** Single click: selects the card. */
  onClick: () => void;
  /** Double click: opens folders. */
  onSelect: () => void;
  onRemove: (value: string) => void;
  onRename: (value: string, newName: string) => void;
  onDuplicate: (value: string) => void;
  onCopyRelativePath: (value: string) => void;
  onCopyFileName: (value: string) => void;
  selected?: boolean;
  dndType: string;
  /** Saved thumbnail for a model, when there is one. */
  thumbnail?: Uint8Array | null;
  /** True while a thumbnail for this model is still being generated. */
  thumbnailPending?: boolean;
}
