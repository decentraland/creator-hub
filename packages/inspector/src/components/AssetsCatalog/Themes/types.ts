import type { AssetPack } from '../../../lib/logic/catalog';

export interface Props {
  catalog: AssetPack[];
  externalCatalog?: AssetPack[];
  onClick: (value: AssetPack) => void;
}
