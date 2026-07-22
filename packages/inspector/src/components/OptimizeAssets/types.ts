export type CompressionSettings = {
  basecolorSize: number;
  normalSize: number;
  ormSize: number;
  emissiveSize: number;
  otherSize: number;
  quality: number;
  format: 'png' | 'jpeg' | 'webp';
};

export type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const DEFAULT_SETTINGS: CompressionSettings = {
  basecolorSize: 1024,
  normalSize: 1024,
  ormSize: 512,
  emissiveSize: 512,
  otherSize: 512,
  quality: 85,
  format: 'png',
};
