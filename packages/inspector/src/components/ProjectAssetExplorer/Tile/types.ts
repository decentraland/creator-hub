import type { TreeNode } from '../ProjectView';
import type { AssetNodeItem } from '../types';

export interface Props {
  valueId: string;
  value?: TreeNode;
  getDragContext: () => unknown;
  onSelect: () => void;
  onRemove: (value: string) => void;
  dndType: string;
  getThumbnail: (value: AssetNodeItem) => Promise<Uint8Array | undefined>;
}
