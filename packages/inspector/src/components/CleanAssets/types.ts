export type FileSize = {
  path: string;
  size: number; // in bytes
};

export type AssetFile = {
  path: string;
  size: number; // in bytes
  unused: boolean;
};

export type Props = {
  isOpen: boolean;
  assets: AssetFile[];
  isScanning: boolean;
  selectedAssets: Set<string>;
  onClose: () => void;
  onScan: () => void;
  onSelect: (asset: string) => void;
};
