import React from 'react';
import { openCustomAssetContextMenu } from './ContextMenu/ContextMenu';

type Props = {
  assetId: string;
  onDelete: (assetId: string) => void;
  onRename: (assetId: string) => void;
  onAddToFilesystem: (assetId: string) => void;
};

export function CustomAssetItem({ assetId, onDelete, onRename, onAddToFilesystem }: Props) {
  const handleContextMenu = (event: React.MouseEvent) => {
    openCustomAssetContextMenu(event, {
      assetId,
      onDelete,
      onRename,
      onAddToFilesystem,
    });
  };

  return <div onContextMenu={handleContextMenu}>{/* Your custom asset item content */}</div>;
}
