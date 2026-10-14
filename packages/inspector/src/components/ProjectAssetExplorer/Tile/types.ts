import type { TreeNode } from '../ProjectView';
import type { AssetNodeItem } from '../types';

export interface Props {
  valueId: string;
  value?: TreeNode;
  getDragContext: () => unknown;
  onSelect: () => void;
  onRemove: (value: string) => void;
  dndType: string;
  getThumbnail: (value: AssetNodeItem) => Promise<string | undefined>;
  layout?: 'grid' | 'list';
  /** Show which folder the asset lives in; used when results come from several folders. */
  showPath?: boolean;
  getAnimatedThumbnail?: (value: AssetNodeItem) => Promise<Uint8Array | undefined>;
}
