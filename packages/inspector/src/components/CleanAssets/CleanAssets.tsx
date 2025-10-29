import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { FiAlertTriangle } from 'react-icons/fi';
import cx from 'classnames';
import { Loading } from '../Loading';
import { Modal } from '../Modal';
import { Button } from '../Button';
import CleanupIcon from '../Icons/Cleanup';
import { CheckboxField } from '../ui';
import { formatBytes } from './utils';
import type { Props, AssetFile } from './types';

import './CleanAssets.css';

// Mock data for development - will be replaced with actual scan logic
const MOCK_ASSETS: AssetFile[] = [
  { path: 'assets/scene/models/park/park.glb', size: 7466015, unused: true },
  { path: 'assets/scene/models/characters/main.glb', size: 3911065, unused: true },
  { path: 'assets/scene/models/characters/npc.glb', size: 1520435, unused: false },
  { path: 'assets/scene/models/props/game.glb', size: 1122509, unused: true },
  { path: 'assets/scene/models/enemy/enemy3.glb', size: 1006632, unused: false },
  { path: 'assets/scene/models/park/lake.glb', size: 912179, unused: false },
  { path: 'assets/scene/models/props/tree.glb', size: 440524, unused: false },
  { path: 'assets/scene/models/props/tree2.glb', size: 419430, unused: false },
  { path: 'assets/scene/screenshot_2024-09-13_at_51113.png', size: 20971, unused: true },
];

const CleanAssets: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && !isScanning && assets.length === 0) {
      handleScan(); // Start scanning when modal opens for the first time
    }
  }, [isOpen, isScanning, assets]);

  const toggleAsset = useCallback((value: string) => {
    setSelectedAssets(prevSet => {
      const isSelected = prevSet.has(value);
      const newSet = new Set(prevSet);
      if (isSelected) newSet.delete(value);
      else newSet.add(value);
      return newSet;
    });
  }, []);

  const totalSize = useMemo(() => assets.reduce((sum, a) => sum + a.size, 0), [assets]);
  const selectedSize = useMemo(
    () => assets.reduce((sum, a) => (selectedAssets.has(a.path) ? sum + a.size : sum), 0),
    [assets, selectedAssets],
  );
  const reducedSize = useMemo(() => totalSize - selectedSize, [totalSize, selectedSize]);

  const handleScan = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      /// This will be replaced with actual scanning logic
      const assets = MOCK_ASSETS;
      setAssets(assets);
      setSelectedAssets(new Set(assets.filter(a => a.unused).map(a => a.path))); // Select unused by default
      setIsScanning(false);
    }, 2000);
  }, []);

  const handleRemoveSelected = useCallback(() => {
    /// This will be implemented with actual file removal logic
    console.log('Removing files:', Array.from(selectedAssets.values()));
    onSave();
  }, [selectedAssets, onSave]);

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
          {isScanning ? (
            <div className="LoadingContainer">
              <div className="SpinnerContainer">
                <Loading dimmer={false} />
              </div>
              <p>SCANNING SCENE ASSETS...</p>
            </div>
          ) : (
            <>
              <div className="stats">
                <p className="FilesCounter">{assets.length} FILES</p>
                <p className="TotalSize">Total size: {formatBytes(totalSize)}</p>
                <p className="ReducedSize">Reduced size: {formatBytes(reducedSize)}</p>
              </div>

              <div className="FileList">
                {assets.map(asset => (
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
                ))}
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
                  onClick={handleRemoveSelected}
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
    </Modal>
  );
};

export default React.memo(CleanAssets);
