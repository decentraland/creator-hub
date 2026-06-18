import React from 'react';

import { type Asset as AssetType } from '../../../lib/logic/catalog';
import { AssetContainer } from '../Asset';

import './Assets.css';

type AssetsProps = {
  assets: AssetType[];
  onAddToFilesystem?: (asset: AssetType) => void;
};

const Assets: React.FC<AssetsProps> = ({ assets, onAddToFilesystem }) => {
  return (
    <div className="assets-catalog-assets-container">
      {assets.map(asset => (
        <AssetContainer
          key={asset.id}
          value={asset}
          onAddToFilesystem={onAddToFilesystem}
        />
      ))}
    </div>
  );
};

export default React.memo(Assets);
