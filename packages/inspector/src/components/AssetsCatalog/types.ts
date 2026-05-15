import type { Asset, AssetPack } from '../../lib/logic/catalog';

export interface Props {
  catalog: AssetPack[];
  onAddToFilesystem?: (asset: Asset) => void;
}
