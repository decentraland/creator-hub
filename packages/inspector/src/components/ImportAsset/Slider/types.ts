import type { Asset } from '../types';

export type PropTypes = {
  assets: AssetWithEmote[];
  onSubmit(assets: Asset[]): void;
  isNameAvailable(asset: Asset, newName: string): boolean;
  isImporting?: boolean;
};

export type AssetWithEmote = Asset & { isEmote?: boolean };

export type Thumbnails = Record<string, string>;
