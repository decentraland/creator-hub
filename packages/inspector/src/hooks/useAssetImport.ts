import { useCallback, useMemo, useState } from 'react';

import { removeBasePath } from '../lib/logic/remove-base-path';
import {
  DIRECTORY,
  transformBase64ResourceToBinary,
  withAssetDir,
} from '../lib/data-layer/host/fs-utils';
import { importAsset, saveThumbnail } from '../redux/data-layer';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { selectAssetCatalog, updateAssetCatalog } from '../redux/app';

import {
  processAssets,
  assetsAreValid,
  formatFileName,
  convertAssetToBinary,
  buildAssetPath,
} from '../components/ImportAsset/utils';
import type { Asset } from '../components/ImportAsset/types';

export interface UseAssetImportOptions {
  /** Called after successful import with the imported asset paths */
  onImportComplete?: (paths: string[]) => void;
  /** Called when import fails */
  onImportError?: (error: Error) => void;
  /** Called when modal is closed without importing */
  onCancel?: () => void;
  /** Whether to allow multiple files (default: true) */
  multiple?: boolean;
  /** Filter function to accept only certain file types */
  acceptExtensions?: string[];
}

export interface UseAssetImportReturn {
  /** Whether the import modal is open */
  isModalOpen: boolean;
  /** Whether an import is in progress */
  isImporting: boolean;
  /** The pending assets to be imported (shown in Slider) */
  pendingAssets: Asset[];
  /** Whether the pending assets are valid */
  areAssetsValid: boolean;
  /** Error message if import failed */
  importError: string | null;
  /** Start the import process with files */
  startImport: (files: File[]) => Promise<void>;
  /** Submit the import (called by Slider) */
  submitImport: (assets: Asset[]) => Promise<void>;
  /** Close the modal and cancel import */
  cancelImport: () => void;
  /** Check if an asset name is available (not already in catalog) */
  isNameAvailable: (asset: Asset, fileName: string) => boolean;
}

export function useAssetImport(options: UseAssetImportOptions = {}): UseAssetImportReturn {
  const { onImportComplete, onImportError, onCancel, multiple = true, acceptExtensions } = options;

  const dispatch = useAppDispatch();
  const catalog = useAppSelector(selectAssetCatalog) ?? { basePath: '', assets: [] };
  const { basePath, assets } = catalog;

  const [pendingAssets, setPendingAssets] = useState<Asset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const areAssetsValid = useMemo(() => assetsAreValid(pendingAssets), [pendingAssets]);

  const isNameAvailable = useCallback(
    (asset: Asset, fileName: string) => {
      return !assets.find(existingAsset => {
        const [packageName, ...otherAssetName] = removeBasePath(basePath, existingAsset.path).split(
          '/',
        );
        if (packageName === 'builder') return false;
        const assetPath = buildAssetPath(asset);
        return otherAssetName.join('/') === `${assetPath}/${fileName}`;
      });
    },
    [assets, basePath],
  );

  const startImport = useCallback(
    async (files: File[]) => {
      // Filter by accepted extensions if specified
      let filesToProcess = files;
      if (acceptExtensions?.length) {
        filesToProcess = files.filter(file =>
          acceptExtensions.some(ext => file.name.toLowerCase().endsWith(ext.toLowerCase())),
        );
      }

      if (!multiple && filesToProcess.length > 1) {
        filesToProcess = [filesToProcess[0]];
      }

      if (filesToProcess.length === 0) return;

      const processedAssets = await processAssets(filesToProcess);
      setPendingAssets(processedAssets);
      setIsModalOpen(true);
    },
    [multiple, acceptExtensions],
  );

  const submitImport = useCallback(
    async (assetsToImport: Asset[]) => {
      if (!assetsAreValid(assetsToImport)) return;

      setIsImporting(true);
      setImportError(null);

      try {
        const importBasePath = withAssetDir(DIRECTORY.SCENE);
        const importedPaths: string[] = [];

        for (const asset of assetsToImport) {
          const content = await convertAssetToBinary(asset);
          const assetPackageName = buildAssetPath(asset);
          const assetPath = `${importBasePath}/${assetPackageName}/${formatFileName(asset)}`;

          dispatch(
            importAsset({
              content,
              basePath: importBasePath,
              assetPackageName,
              reload: true,
            }),
          );

          if (asset.thumbnail) {
            dispatch(
              saveThumbnail({
                content: new Uint8Array(transformBase64ResourceToBinary(asset.thumbnail)),
                path: `${DIRECTORY.SCENE}/${assetPackageName}/${formatFileName(asset)}`,
              }),
            );
          }

          importedPaths.push(assetPath);
        }

        dispatch(updateAssetCatalog({ assets: catalog, customAssets: [] }));

        setPendingAssets([]);
        setIsModalOpen(false);

        onImportComplete?.(importedPaths);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to import assets';
        setImportError(errorMessage);
        onImportError?.(error instanceof Error ? error : new Error(errorMessage));
      } finally {
        setIsImporting(false);
      }
    },
    [dispatch, catalog, onImportComplete, onImportError],
  );

  const cancelImport = useCallback(() => {
    setPendingAssets([]);
    setIsModalOpen(false);
    setImportError(null);
    onCancel?.();
  }, [onCancel]);

  return {
    isModalOpen,
    isImporting,
    pendingAssets,
    areAssetsValid,
    importError,
    startImport,
    submitImport,
    cancelImport,
    isNameAvailable,
  };
}
