import { contextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';
import type { Asset } from '../../../../lib/logic/catalog';

export const CATALOG_ASSET_CONTEXT_MENU_ID = 'catalog-asset-context-menu';

export type CatalogAssetContextMenuProps = {
  asset: Asset;
  onAddToFilesystem: (asset: Asset) => void;
};

export function openCatalogAssetContextMenu(
  event: React.MouseEvent,
  props: CatalogAssetContextMenuProps,
) {
  event.preventDefault();
  contextMenu.show({
    id: CATALOG_ASSET_CONTEXT_MENU_ID,
    event,
    props,
  });
}
