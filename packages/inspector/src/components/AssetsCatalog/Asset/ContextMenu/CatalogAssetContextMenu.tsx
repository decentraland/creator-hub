import React from 'react';
import { Item } from 'react-contexify';
import { getBuiltInEmote } from '../../../../lib/logic/catalog';
import { copyBuiltInEmoteName } from '../../../../lib/logic/built-in-emotes';
import { ContextMenu } from '../../../ContexMenu/ContextMenu';
import { CATALOG_ASSET_CONTEXT_MENU_ID, type CatalogAssetContextMenuProps } from './ContextMenu';

const isBuiltIn = ({ props }: { props?: unknown }) => {
  const asset = (props as CatalogAssetContextMenuProps | undefined)?.asset;
  return !!asset && !!getBuiltInEmote(asset);
};

export function CatalogAssetContextMenu() {
  return (
    <ContextMenu id={CATALOG_ASSET_CONTEXT_MENU_ID}>
      <Item
        hidden={isBuiltIn}
        onClick={({ props }) => {
          const { asset, onAddToFilesystem } = props as CatalogAssetContextMenuProps;
          onAddToFilesystem?.(asset);
        }}
      >
        Add to filesystem
      </Item>
      <Item
        hidden={args => !isBuiltIn(args)}
        onClick={({ props }) => {
          const { asset } = props as CatalogAssetContextMenuProps;
          void copyBuiltInEmoteName(getBuiltInEmote(asset)!);
        }}
      >
        Copy name
      </Item>
    </ContextMenu>
  );
}
