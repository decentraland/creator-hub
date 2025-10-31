import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { FiAlertTriangle } from 'react-icons/fi';
import cx from 'classnames';
import { DIRECTORY } from '../../lib/data-layer/host/fs-utils';
import { useSdk } from '../../hooks/sdk/useSdk';
import useSnackbar from '../../hooks/sdk/useSnackbar';
import { getAssetCatalog, getDataLayerInterface } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { Loading } from '../Loading';
import { Modal } from '../Modal';
import { Button } from '../Button';
import CleanupIcon from '../Icons/Cleanup';
import { CheckboxField } from '../ui';
import { scanForUnusedAssets } from './scanner';
import type { Props, AssetFile } from './types';
import { formatBytes } from './utils';

import './CleanAssets.css';

const CleanAssets: React.FC<Props> = ({ isOpen, onClose }) => {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const [isScanning, setIsScanning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { pushGeneric } = useSnackbar();

  const totalSize = useMemo(() => assets.reduce((sum, a) => sum + a.size, 0), [assets]);
  const selectedSize = useMemo(
    () => assets.reduce((sum, a) => (selectedAssets.has(a.path) ? sum + a.size : sum), 0),
    [assets, selectedAssets],
  );
  const reducedSize = useMemo(() => totalSize - selectedSize, [totalSize, selectedSize]);

  // Start scanning when modal opens for the first time
  useEffect(() => {
    if (isOpen && !isScanning && assets.length === 0) {
      handleScan();
    }
  }, [isOpen, sdk]);

  const handleScan = useCallback(async () => {
    if (!sdk) return;

    const dataLayer = getDataLayerInterface();
    if (!dataLayer) return;

    try {
      setIsScanning(true);
      const { files } = await dataLayer.getFilesSizes({
        path: DIRECTORY.ASSETS,
        ignore: ['main.composite', 'composite.json', '*.ts', '*.js'], // Ignore code files
      });
      if (!files || files.length === 0) {
        setAssets([]);
        setSelectedAssets(new Set());
        setIsScanning(false);
        return;
      }

      const scannedAssets = await scanForUnusedAssets(sdk, files);
      const unusedAssets = scannedAssets.filter(a => a.unused);
      if (unusedAssets.length === 0) {
        // No unused assets found
        setAssets([]);
        setSelectedAssets(new Set());
        setIsScanning(false);
        return;
      } else {
        setAssets(scannedAssets);
        setSelectedAssets(new Set(unusedAssets.map(a => a.path)));
      }
    } catch (err) {
      console.error('Error scanning assets:', err);
    } finally {
      setIsScanning(false);
    }
  }, [sdk]);

  const handleRemoveSelected = useCallback(async () => {
    if (selectedAssets.size === 0) return;

    const dataLayer = getDataLayerInterface();
    if (!dataLayer) return;

    setIsRemoving(true);
    const filePaths = Array.from(selectedAssets.values());
    const removedFiles = await dataLayer.removeFiles({ filePaths });

    let message = `${removedFiles.success.length} ${removedFiles.success.length === 1 ? 'file' : 'files'} have been successfully removed.`;
    if (removedFiles.failed.length > 0) {
      message += ` ${removedFiles.failed.length} ${removedFiles.failed.length === 1 ? 'file' : 'files'} could not be removed.`;
    }
    pushGeneric('success', message);

    // Refresh asset catalog and reset state
    dispatch(getAssetCatalog());
    setShowConfirmation(false);
    setAssets([]);
    setSelectedAssets(new Set());
    setIsRemoving(false);
    onClose();
  }, [selectedAssets, onClose, pushGeneric, dispatch]);

  const validateRemove = useCallback(() => {
    if (selectedAssets.size === 0) return;

    const hasSelectedInUse = assets.some(asset => selectedAssets.has(asset.path) && !asset.unused);

    // Show remove confirmation modal if any selected asset is in use
    if (hasSelectedInUse) setShowConfirmation(true);
    else handleRemoveSelected();
  }, [assets, selectedAssets, handleRemoveSelected]);

  const toggleAsset = useCallback((value: string) => {
    setSelectedAssets(prevSet => {
      const isSelected = prevSet.has(value);
      const newSet = new Set(prevSet);
      if (isSelected) newSet.delete(value);
      else newSet.add(value);
      return newSet;
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="CleanAssetsModal"
    >
      <header className="CleanAssetsHeader">
        <h2>Remove Unused Assets</h2>
        <button
          className="CloseButton"
          onClick={onClose}
        >
          <IoClose size={24} />
        </button>
      </header>

      <div className="CleanAssets">
        <div className="LeftPanel">
          <p>
            This tool helps you clean up leftover files that are no longer in use by your scene.
          </p>
          <p>Some considerations:</p>
          <div className="considerations">
            <div>
              <FiAlertTriangle />
              <p>
                All unused files will be permanently deleted. Please back up your scene before
                removing any files.
              </p>
            </div>
            <div>
              <FiAlertTriangle />
              <p>If your scene uses code, referenced files may also be removed.</p>
            </div>
          </div>
        </div>

        <div className="RightPanel">
          {isScanning || isRemoving ? (
            <div className="LoadingContainer">
              <div className="SpinnerContainer">
                <Loading dimmer={false} />
              </div>
              <p>{isScanning ? 'SCANNING SCENE ASSETS...' : 'REMOVING SELECTED ASSETS...'}</p>
            </div>
          ) : (
            <>
              <div className="stats">
                <p className="FilesCounter">{assets.length} FILES</p>
                <p className="TotalSize">Total size: {formatBytes(totalSize)}</p>
                <p className="ReducedSize">Reduced size: {formatBytes(reducedSize)}</p>
              </div>

              <div className="FileList">
                {assets.length === 0 ? (
                  <p className="EmptyFiles">
                    No unused assets <br /> were found
                  </p>
                ) : (
                  assets.map(asset => (
                    <label
                      key={asset.path}
                      className={cx('FileItem', { selected: selectedAssets.has(asset.path) })}
                    >
                      <CheckboxField
                        type="checkbox"
                        checked={selectedAssets.has(asset.path)}
                        onChange={() => toggleAsset(asset.path)}
                        className="checkbox"
                      />
                      <span>{asset.path}</span>
                      {asset.unused && <CleanupIcon />}
                      <span className="size">{formatBytes(asset.size)}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="footer">
                <Button
                  type="text"
                  onClick={handleScan}
                  className="ScanButton"
                >
                  SCAN AGAIN
                </Button>
                <Button
                  type="danger"
                  onClick={validateRemove}
                  disabled={selectedAssets.size === 0}
                >
                  <CleanupIcon />
                  REMOVE SELECTED
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      {showConfirmation && (
        <Modal
          isOpen={showConfirmation}
          onRequestClose={() => setShowConfirmation(false)}
          className="ConfirmationModal"
        >
          <div className="content">
            <h2 className="title">Remove selected?</h2>
            <div className="warning">
              Some selected files might be in use. <br />
              Removing them from the scene could cause the scene to stop working.
            </div>
          </div>
          <div className="actions">
            <Button
              size="big"
              type="danger"
              onClick={handleRemoveSelected}
            >
              Remove
            </Button>
            <Button
              size="big"
              onClick={() => setShowConfirmation(false)}
            >
              Back
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default React.memo(CleanAssets);
