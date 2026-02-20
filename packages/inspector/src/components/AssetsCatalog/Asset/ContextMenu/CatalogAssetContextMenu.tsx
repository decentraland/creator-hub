import React from 'react';
import { Item } from 'react-contexify';
import { ContextMenu } from '../../../ContexMenu/ContextMenu';
import { CATALOG_ASSET_CONTEXT_MENU_ID, type CatalogAssetContextMenuProps } from './ContextMenu';

export function CatalogAssetContextMenu() {
  return (
    <ContextMenu id={CATALOG_ASSET_CONTEXT_MENU_ID}>
      <Item
        onClick={({ props }) => {
          const { asset, onAddToFilesystem } = props as CatalogAssetContextMenuProps;
          onAddToFilesystem(asset);
        }}
      >
        Add to filesystem
      </Item>
    </ContextMenu>
  );
}
