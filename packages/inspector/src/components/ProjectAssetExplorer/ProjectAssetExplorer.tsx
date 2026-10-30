import React, { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '../../redux/hooks';
import { selectAssetCatalog, selectThumbnails } from '../../redux/app';
import { useAssetTree } from '../../hooks/catalog/useAssetTree';
import { fetchLatestCatalog, getBuiltInEmote, type Asset } from '../../lib/logic/catalog';

import ProjectView from './ProjectView';
import { buildBuiltInAnimationsFolder } from './utils';

import type { AssetNodeFolder } from './types';

import './ProjectAssetExplorer.css';

function useBuiltInEmotes(): Asset[] {
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    void fetchLatestCatalog()
      .then(packs => setAssets(packs.flatMap(pack => pack.assets).filter(getBuiltInEmote)))
      .catch(() => setAssets([]));
  }, []);
  return assets;
}

function ProjectAssetExplorer() {
  const files = useAppSelector(selectAssetCatalog) ?? { basePath: '', assets: [] };
  const thumbnails = useAppSelector(selectThumbnails);
  const { tree } = useAssetTree(files);
  const builtInEmotes = useBuiltInEmotes();
  const folders = useMemo(() => {
    const sceneFolders = tree.children.filter(item => item.type === 'folder') as AssetNodeFolder[];
    if (builtInEmotes.length === 0) return sceneFolders;
    return [buildBuiltInAnimationsFolder(builtInEmotes), ...sceneFolders];
  }, [tree, builtInEmotes]);

  return (
    <ProjectView
      folders={folders}
      thumbnails={thumbnails}
    />
  );
}

export default React.memo(ProjectAssetExplorer);
