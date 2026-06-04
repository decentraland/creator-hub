import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import cx from 'classnames';
import { useSnackbar } from '../../hooks/useSnackbar';
import { getAssetCatalog, getDataLayerInterface } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { Loading } from '../Loading';
import { Modal } from '../Modal';
import { Button } from '../Button';
import OptimizeIcon from '../Icons/Optimize/Optimize';
import { CheckboxField } from '../ui';
import { normalizeBytes } from '../ImportAsset/utils';
import { optimizeAsset, getMaxHeight } from './utils';
import type { Props, CompressionSettings, OptimizationResult } from './types';
import { DEFAULT_SETTINGS } from './types';

import './OptimizeAssets.css';

const TEXTURE_TYPE_LABELS: Record<string, string> = {
  baseColor: 'Base Color',
  normal: 'Normal Map',
  orm: 'ORM',
  emissive: 'Emissive',
  other: 'Other',
};

const OptimizeAssets: React.FC<Props> = ({
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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [settings, setSettings] = useState<CompressionSettings>({ ...DEFAULT_SETTINGS });
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { pushNotification } = useSnackbar();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(() => assets.reduce((sum, a) => sum + a.size, 0), [assets]);
  const selectedSize = useMemo(
    () => assets.reduce((sum, a) => (selectedAssets.has(a.path) ? sum + a.size : sum), 0),
    [assets, selectedAssets],
  );
  const allSelected = useMemo(
    () => assets.length > 0 && selectedAssets.size === assets.length,
    [assets.length, selectedAssets.size],
  );
  const isIndeterminate = useMemo(
    () => selectedAssets.size > 0 && selectedAssets.size < assets.length,
    [assets.length, selectedAssets.size],
  );

  const savedBytes = useMemo(() => {
    if (!results) return 0;
    return results.reduce((sum, r) => sum + (r.originalSize - r.optimizedSize), 0);
  }, [results]);

  const handleSelectAll = useCallback(() => {
    onSelectAll(selectedAssets.size === 0 || !allSelected);
  }, [selectedAssets.size, allSelected, onSelectAll]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleSettingChange = useCallback(
    (key: keyof CompressionSettings, value: number | string) => {
      setSettings(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleOptimize = useCallback(async () => {
    if (selectedAssets.size === 0) return;

    const dataLayer = getDataLayerInterface();
    if (!dataLayer) return;

    setIsOptimizing(true);
    setResults(null);

    const selected = assets.filter(a => selectedAssets.has(a.path));
    setProgress({ current: 0, total: selected.length });

    const optimizationResults: OptimizationResult[] = [];

    for (let i = 0; i < selected.length; i++) {
      const result = await optimizeAsset(dataLayer, selected[i], settings);
      optimizationResults.push(result);
      setProgress({ current: i + 1, total: selected.length });
    }

    setResults(optimizationResults);
    setIsOptimizing(false);

    const optimized = optimizationResults.filter(r => !r.skipped);
    const totalSaved = optimizationResults.reduce(
      (sum, r) => sum + (r.originalSize - r.optimizedSize),
      0,
    );

    if (optimized.length > 0) {
      pushNotification(
        'success',
        `${optimized.length} ${optimized.length === 1 ? 'file' : 'files'} optimized. Saved ${normalizeBytes(totalSaved)}.`,
      );
      dispatch(getAssetCatalog());
    } else {
      pushNotification('info', 'No files were optimized — all were already at or below target size.');
    }
  }, [selectedAssets, assets, settings, pushNotification, dispatch]);

  const handleBack = useCallback(() => {
    setResults(null);
  }, []);

  const handleClose = useCallback(() => {
    setResults(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      className="OptimizeAssetsModal"
    >
      <header className="OptimizeAssetsHeader">
        <h2>Optimize Assets</h2>
        <button
          className="CloseButton"
          onClick={handleClose}
        >
          <IoClose size={24} />
        </button>
      </header>

      <div className="OptimizeAssets">
        <div className="LeftPanel">
          {results ? (
            <div className="ResultsSummary">
              <p className="ResultsTitle">Optimization Complete</p>
              <div className="ResultsStat">
                <span className="ResultsLabel">Files processed</span>
                <span className="ResultsValue">{results.length}</span>
              </div>
              <div className="ResultsStat">
                <span className="ResultsLabel">Files optimized</span>
                <span className="ResultsValue">{results.filter(r => !r.skipped).length}</span>
              </div>
              <div className="ResultsStat">
                <span className="ResultsLabel">Files skipped</span>
                <span className="ResultsValue">{results.filter(r => r.skipped).length}</span>
              </div>
              <div className="ResultsStat total">
                <span className="ResultsLabel">Total saved</span>
                <span className="ResultsValue">{normalizeBytes(savedBytes)}</span>
              </div>
            </div>
          ) : (
            <>
              <p>
                Resize and compress image textures in your scene. Textures are classified by naming
                convention and each type gets its own maximum height.
              </p>
              <div className="SettingsSection">
                <p className="SettingsTitle">Max Height (px)</p>
                <div className="SettingsGrid">
                  {(['baseColor', 'normal', 'orm', 'emissive', 'other'] as const).map(type => (
                    <label
                      key={type}
                      className="SettingsRow"
                    >
                      <span>{TEXTURE_TYPE_LABELS[type]}</span>
                      <select
                        value={getMaxHeight(type, settings)}
                        onChange={e =>
                          handleSettingChange(`${type}Size` as keyof CompressionSettings, Number(e.target.value))
                        }
                      >
                        <option value={256}>256</option>
                        <option value={512}>512</option>
                        <option value={1024}>1024</option>
                        <option value={2048}>2048</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="SettingsSection">
                <p className="SettingsTitle">Output</p>
                <label className="SettingsRow">
                  <span>Format</span>
                  <select
                    value={settings.format}
                    onChange={e => handleSettingChange('format', e.target.value)}
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                </label>
                {settings.format !== 'png' && (
                  <label className="SettingsRow">
                    <span>Quality</span>
                    <div className="QualityControl">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={settings.quality}
                        onChange={e => handleSettingChange('quality', Number(e.target.value))}
                      />
                      <span className="QualityValue">{settings.quality}</span>
                    </div>
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        <div className="RightPanel">
          {isScanning || isOptimizing ? (
            <div className="LoadingContainer">
              <div className="SpinnerContainer">
                <Loading dimmer={false} />
              </div>
              <p>
                {isScanning
                  ? 'SCANNING ASSETS...'
                  : `OPTIMIZING ${progress.current}/${progress.total}...`}
              </p>
            </div>
          ) : results ? (
            <>
              <div className="stats">
                <p className="FilesCounter">{results.length} FILES PROCESSED</p>
                <p className="TotalSize">Saved: {normalizeBytes(savedBytes)}</p>
              </div>
              <div className="FileList">
                {results.map(result => (
                  <div
                    key={result.path}
                    className={cx('FileItem', { skipped: result.skipped })}
                  >
                    <span className="path">{result.path}</span>
                    <span className="sizes">
                      {normalizeBytes(result.originalSize)}
                      {!result.skipped && (
                        <>
                          {' → '}
                          <span className="optimized">{normalizeBytes(result.optimizedSize)}</span>
                        </>
                      )}
                      {result.skipped && <span className="skipped-label">skipped</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="footer">
                <Button
                  type="text"
                  onClick={handleBack}
                  className="ScanButton"
                >
                  BACK
                </Button>
                <Button onClick={handleClose}>DONE</Button>
              </div>
            </>
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
                <p className="ReducedSize">Selected: {normalizeBytes(selectedSize)}</p>
              </div>

              <div className="FileList">
                {assets.length === 0 ? (
                  <p className="EmptyFiles">
                    No optimizable assets <br /> were found
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
                        onChange={() => onSelect(asset.path)}
                        className="checkbox"
                      />
                      <span>{asset.path}</span>
                      <span className="type-badge">{asset.type}</span>
                      <span className="size">{normalizeBytes(asset.size)}</span>
                    </label>
                  ))
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
                  onClick={handleOptimize}
                  disabled={selectedAssets.size === 0}
                >
                  <OptimizeIcon />
                  OPTIMIZE SELECTED
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(OptimizeAssets);
