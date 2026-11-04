import type { AssetData } from '../../lib/logic/catalog';

export interface IAsset {
  src: string;
  type: 'unknown' | 'gltf' | 'composite' | 'audio' | 'video' | 'image' | 'script';
  id?: string;
  // Set on the read-only "Built-in animations" entries, which are listed from the catalog and
  // have no file in the scene.
  builtInEmote?: BuiltInEmoteAsset;
}

export interface BuiltInEmoteAsset {
  name: string;
  thumbnailUrl: string;
  previewUrl?: string;
}

export interface FolderCellProp {
  back?: boolean;
  onClick: (item: AssetNodeFolder) => void;
  folder: AssetNodeFolder;
}

export interface AssetCellProp {
  value: AssetNodeItem;
}

export type AssetNodeBase = {
  name: string;
  parent: AssetNodeFolder | null;
  composite?: AssetData['composite'];
};

export type AssetNodeItem = AssetNodeBase & {
  type: 'asset';
  asset: IAsset;
};

export type AssetNodeFolder = AssetNodeBase & {
  type: 'folder';
  children: AssetNode[];
};

export type AssetNode = AssetNodeItem | AssetNodeFolder;
