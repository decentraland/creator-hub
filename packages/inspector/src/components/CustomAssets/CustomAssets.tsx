import React, { useCallback } from 'react';
import { useDrag } from 'react-dnd';

import './CustomAssets.css';
import type { CustomAsset } from '../../lib/logic/catalog';
import CustomAssetIcon from '../Icons/CustomAsset';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectCustomAssets } from '../../redux/app';
import { DropTypesEnum } from '../../lib/sdk/drag-drop';
import { deleteCustomAsset, setAssetToRename } from '../../redux/data-layer';
import { AssetsTab } from '../../redux/ui/types';
import { selectAssetsTab } from '../../redux/ui';
import { openCustomAssetContextMenu } from './ContextMenu/ContextMenu';
import { CustomAssetContextMenu } from './ContextMenu/CustomAssetContextMenu';

interface CustomAssetItemProps {
  value: CustomAsset;
  onDelete: (assetId: string) => void;
  onRename: (assetId: string) => void;
  onAddToFilesystem: (assetId: string) => void;
}

const CustomAssetItem: React.FC<CustomAssetItemProps> = ({
  value,
  onDelete,
  onRename,
  onAddToFilesystem,
}) => {
  const [, drag] = useDrag(
    () => ({
      type: DropTypesEnum.CustomAsset,
      item: { value },
    }),
    [value],
  );

  const handleContextMenu = (event: React.MouseEvent) => {
    openCustomAssetContextMenu(event, {
      assetId: value.id,
      onDelete,
      onRename,
      onAddToFilesystem,
    });
  };

  return (
    <>
      <div
        className="custom-asset-item"
        onContextMenu={handleContextMenu}
      >
        <div
          className="custom-asset-item-box"
          ref={drag}
          title={value.name}
        >
          {value.thumbnail ? (
            <img
              src={value.thumbnail}
              alt={value.name}
            />
          ) : (
            <CustomAssetIcon />
          )}
        </div>
        <span className="custom-asset-item-label">{value.name}</span>
      </div>
    </>
  );
};

const EmptyCustomAssets = () => {
  return (
    <div className="custom-assets-empty">
      <div className="custom-assets-empty-card">
        <div className="custom-assets-empty-content">
          <i className="icon-custom-assets" />
          <p>
            Create custom items by selecting one or more entities, then choosing “
            <strong>Create Custom Item</strong>” from the right-click menu.
          </p>
        </div>
        <a
          href="https://www.youtube.com/watch?v=7cGLu8P7dso"
          target="_blank"
          rel="noopener noreferrer"
        >
          WATCH TUTORIAL
        </a>
      </div>
    </div>
  );
};

type CustomAssetsProps = {
  onAddToFilesystem?: (asset: CustomAsset) => void;
};

export function CustomAssets({ onAddToFilesystem }: CustomAssetsProps) {
  const customAssets = useAppSelector(selectCustomAssets);
  const dispatch = useAppDispatch();

  const handleDelete = useCallback((assetId: string) => {
    dispatch(deleteCustomAsset({ assetId }));
  }, []);

  const handleRename = useCallback(
    (assetId: string) => {
      const asset = customAssets.find(asset => asset.id === assetId);
      if (!asset) return;
      dispatch(setAssetToRename({ assetId: asset.id, name: asset.name }));
      dispatch(selectAssetsTab({ tab: AssetsTab.RenameAsset }));
    },
    [customAssets, dispatch],
  );

  const handleAddToFilesystem = useCallback(
    (assetId: string) => {
      if (!onAddToFilesystem) return;
      const asset = customAssets.find(a => a.id === assetId);
      if (!asset) return;
      void onAddToFilesystem(asset);
    },
    [customAssets, onAddToFilesystem],
  );

  if (customAssets.length === 0) return <EmptyCustomAssets />;

  return (
    <div className="custom-assets">
      <CustomAssetContextMenu />
      {customAssets.map(asset => (
        <CustomAssetItem
          key={asset.id}
          value={asset}
          onDelete={handleDelete}
          onRename={handleRename}
          onAddToFilesystem={handleAddToFilesystem}
        />
      ))}
    </div>
  );
}

export default React.memo(CustomAssets);
