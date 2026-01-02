import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { FiAlertTriangle } from 'react-icons/fi';
import cx from 'classnames';
import { useSnackbar } from '../../hooks/useSnackbar';
import { setRemovedFiles } from '../../redux/clean-assets';
import { getAssetCatalog, getDataLayerInterface } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { Loading } from '../Loading';
import { Modal } from '../Modal';
import { Button } from '../Button';
import CleanupIcon from '../Icons/Cleanup';
import { CheckboxField } from '../ui';
import { normalizeBytes } from '../ImportAsset/utils';
import type { Props } from './types';

import './CleanAssets.css';

const CleanAssets: React.FC<Props> = ({
  isOpen,
  onClose,
  onScan,
  assets,
  isScanning,
  selectedAssets,
  onSelect,
  onSelectAll,
}) => {
  const dispatch = useAppDispatch();
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { pushNotification } = useSnackbar();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const unusedAssets = useMemo(() => assets.filter(a => a.unused).map(a => a.path), [assets]);
  const totalSize = useMemo(() => assets.reduce((sum, a) => sum + a.size, 0), [assets]);
  const selectedSize = useMemo(
    () => assets.reduce((sum, a) => (selectedAssets.has(a.path) ? sum + a.size : sum), 0),
    [assets, selectedAssets],
  );
  const reducedSize = useMemo(() => totalSize - selectedSize, [totalSize, selectedSize]);
  const allSelected = useMemo(
    () => assets.length > 0 && selectedAssets.size === assets.length,
    [assets.length, selectedAssets.size],
  );
  const onlyUnusedSelected = useMemo(
    () =>
      unusedAssets.length > 0 &&
      selectedAssets.size === unusedAssets.length &&
      unusedAssets.every(path => selectedAssets.has(path)),
    [unusedAssets, selectedAssets],
  );
  const isIndeterminate = useMemo(
    () => (selectedAssets.size > 0 && selectedAssets.size < assets.length) || onlyUnusedSelected,
    [assets.length, selectedAssets.size, onlyUnusedSelected],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedAssets.size === 0) {
      // None selected → Select all
      onSelectAll(true);
    } else if (allSelected) {
      // All selected → Select only unused
      onSelectAll(false);
      unusedAssets.forEach(path => onSelect(path));
    } else if (onlyUnusedSelected) {
      // Only unused selected → Deselect all
      onSelectAll(false);
    } else {
      // Some other mix → Select all
      onSelectAll(true);
    }
  }, [selectedAssets.size, allSelected, onlyUnusedSelected, unusedAssets, onSelect, onSelectAll]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleRemoveSelected = useCallback(async () => {
    if (selectedAssets.size === 0) return;

    const dataLayer = getDataLayerInterface();
    if (!dataLayer) return;

    setIsRemoving(true);

    try {
      const filePaths = Array.from(selectedAssets.values());
      const filesBackup = await dataLayer.getFilesList({ paths: filePaths });
      const successfulBackups = filesBackup.files
        .filter(file => file.success && file.content)
        .map(file => ({ path: file.path, content: file.content }));

      const removedFiles = await dataLayer.removeFiles({ filePaths });

      if (removedFiles.success.length > 0) {
        const recoveryData = successfulBackups.filter(backup =>
          removedFiles.success.includes(backup.path),
        );
        dispatch(setRemovedFiles(recoveryData));
      }

      let message = `${removedFiles.success.length} ${removedFiles.success.length === 1 ? 'file' : 'files'} have been successfully removed.`;
      if (removedFiles.failed.length > 0) {
        message += ` ${removedFiles.failed.length} ${removedFiles.failed.length === 1 ? 'file' : 'files'} could not be removed.`;
      }
      pushNotification('success', message);

      // Refresh asset catalog and reset state
      dispatch(getAssetCatalog());
      setShowConfirmation(false);
    } catch (error) {
      console.error('Failed to remove files:', error);
      pushNotification('error', 'Failed to remove files. Please try again.');
    } finally {
      onClose();
      setIsRemoving(false);
    }
  }, [selectedAssets, onClose, pushNotification, dispatch]);

  const validateRemove = useCallback(() => {
    if (selectedAssets.size === 0) return;

    const hasSelectedInUse = assets.some(asset => selectedAssets.has(asset.path) && !asset.unused);

    // Show remove confirmation modal if any selected asset is in use
    if (hasSelectedInUse) setShowConfirmation(true);
    else handleRemoveSelected();
  }, [assets, selectedAssets, handleRemoveSelected]);

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
                <CheckboxField
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="checkbox"
                />
                <p className="FilesCounter">{assets.length} FILES</p>
                <p className="TotalSize">Total size: {normalizeBytes(totalSize)}</p>
                <p className="ReducedSize">Reduced size: {normalizeBytes(reducedSize)}</p>
              </div>

              <div className="FileList">
                {unusedAssets.length === 0 ? (
                  <p className="EmptyFiles">
                    No unused assets <br /> were found
                  </p>
                ) : (
                  <>
                    {assets.map(asset => (
                      <label
                        key={asset.path}
                        className={cx('FileItem', { selected: selectedAssets.has(asset.path) })}
                      >
                        <CheckboxField
                          type="checkbox"
                          checked={selectedAssets.has(asset.path)}
                          onChange={() => onSelect(asset.path)}
                          className="checkbox"
                        />
                        <span>{asset.path}</span>
                        {asset.unused && <CleanupIcon />}
                        <span className="size">{normalizeBytes(asset.size)}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>

              <div className="footer">
                <Button
                  type="text"
                  onClick={onScan}
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
