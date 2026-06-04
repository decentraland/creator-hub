export type TextureType = 'baseColor' | 'normal' | 'orm' | 'emissive' | 'other';

export type OptimizableAsset = {
  path: string;
  size: number;
  type: TextureType;
};

export type CompressionSettings = {
  baseColorSize: number;
  normalSize: number;
  ormSize: number;
  emissiveSize: number;
  otherSize: number;
  quality: number;
  format: 'png' | 'jpeg' | 'webp';
};

export type OptimizationResult = {
  path: string;
  originalSize: number;
  optimizedSize: number;
  skipped: boolean;
};

export type Props = {
  isOpen: boolean;
  assets: OptimizableAsset[];
  isScanning: boolean;
  selectedAssets: Set<string>;
  onClose: () => void;
  onScan: () => void;
  onSelect: (asset: string) => void;
  onSelectAll: (selectAll: boolean) => void;
};

export const DEFAULT_SETTINGS: CompressionSettings = {
  baseColorSize: 1024,
  normalSize: 1024,
  ormSize: 512,
  emissiveSize: 512,
  otherSize: 512,
  quality: 85,
  format: 'png',
};
