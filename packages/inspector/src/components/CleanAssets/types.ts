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
  onClose: () => void;
};
