import { useCallback, useState } from 'react';

import type { Asset, CustomAsset } from '../lib/logic/catalog';
import { getConfig } from '../lib/logic/config';
import { DIRECTORY, withAssetDir } from '../lib/data-layer/host/fs-utils';
import { getDataLayerInterface, getAssetCatalog, saveThumbnail } from '../redux/data-layer';
import { useAppDispatch } from '../redux/hooks';
import { analytics, Event } from '../lib/logic/analytics';
import { useIsMounted } from './useIsMounted';

const THUMBNAIL_PATH = 'thumbnail.png';

const isAssetFile = (value: string): boolean => value.endsWith('.gltf') || value.endsWith('.glb');

export function useImportAssetToFilesystem() {
  const dispatch = useAppDispatch();
  const config = getConfig();
  const isMounted = useIsMounted();
  const [isImporting, setIsImporting] = useState(false);

  const getContentFetchUrl = useCallback(
    (path: string, contentHash: string) => {
      let url = `${config.contentUrl}/contents/${contentHash}`;
      if (path.endsWith(THUMBNAIL_PATH)) url += '?resize';
      return url;
    },
    [config.contentUrl],
  );

  const importCatalogAssetToFilesystem = useCallback(
    async (asset: Asset) => {
      const fileContent: Record<string, Uint8Array> = {};
      const destFolder = DIRECTORY.ASSET_PACKS;
      const assetPackageName = asset.name.trim().replaceAll(' ', '_').toLowerCase();
      const assetPath = Object.keys(asset.contents).find(isAssetFile);
      let thumbnail: Uint8Array | undefined;

      setIsImporting(true);

      await Promise.all(
        Object.entries(asset.contents).map(async ([path, contentHash]) => {
          try {
            const url = getContentFetchUrl(path, contentHash);
            const response = await fetch(url);
            const content = new Uint8Array(await response.arrayBuffer());
            if (path.endsWith(THUMBNAIL_PATH)) {
              thumbnail = content;
            } else {
              fileContent[path] = content;
            }
          } catch (err) {
            console.error('Error fetching an asset import ' + path);
          }
        }),
      );

      const content = new Map(Object.entries(fileContent));
      if (content.size > 0) {
        const dataLayer = getDataLayerInterface();
        if (dataLayer) {
          await dataLayer.importAsset({
            content,
            basePath: withAssetDir(destFolder),
            assetPackageName,
          });
          dispatch(getAssetCatalog());
        }
      }

      if (thumbnail) {
        dispatch(
          saveThumbnail({
            content: thumbnail,
            path: `${destFolder}/${assetPackageName}/${assetPath || asset.name}`,
          }),
        );
      }

      if (isMounted()) {
        setIsImporting(false);
      }

      analytics.track(Event.ADD_ITEM, {
        itemId: asset.id,
        itemName: asset.name,
        itemPath: assetPath ?? '',
        isSmart: false,
        isCustom: false,
      });

      return {
        basePath: withAssetDir(`${destFolder}/${assetPackageName}`),
        assetPath,
      };
    },
    [dispatch, getContentFetchUrl, isMounted],
  );

  const importCustomAssetToFilesystem = useCallback(
    async (asset: CustomAsset) => {
      const destFolder = 'custom';
      const assetPackageName = asset.name.trim().replaceAll(' ', '_').toLowerCase();
      const content: Map<string, Uint8Array> = new Map();

      const dataLayer = getDataLayerInterface();
      if (!dataLayer) return;

      setIsImporting(true);

      const files = await Promise.all(
        asset.resources.map(async resourcePath => {
          const fileContent = await dataLayer
            .getFile({ path: resourcePath })
            .then(res => res.content);
          const fileName = resourcePath.split('/').pop()!;
          return { fileName, content: fileContent };
        }),
      );
      for (const file of files) {
        content.set(file.fileName, file.content);
      }

      if (asset.composite) {
        const compositeJson = new TextEncoder().encode(JSON.stringify(asset.composite, null, 2));
        content.set('composite.json', compositeJson);
      }

      const basePath = withAssetDir(`${destFolder}/${assetPackageName}`);
      await dataLayer.importAsset({ content, basePath, assetPackageName: '' });
      dispatch(getAssetCatalog());

      if (isMounted()) {
        setIsImporting(false);
      }

      return { basePath };
    },
    [dispatch, isMounted],
  );

  return {
    importCatalogAssetToFilesystem,
    importCustomAssetToFilesystem,
    isImporting,
  };
}
