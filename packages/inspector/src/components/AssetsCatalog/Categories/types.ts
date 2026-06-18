import type { Asset, AssetPack } from '../../../lib/logic/catalog';

export interface Props {
  onGoBack: () => void;
  value: AssetPack;
  onAddToFilesystem?: (asset: Asset) => void;
}
