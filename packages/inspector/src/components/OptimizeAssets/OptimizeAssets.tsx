import React, { useState, useCallback, useMemo } from 'react';
import { IoClose } from 'react-icons/io5';
import cx from 'classnames';
import { getSceneClient } from '../../lib/rpc/scene';
import { useSnackbar } from '../../hooks/useSnackbar';
import { getAssetCatalog } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { Loading } from '../Loading';
import { Modal } from '../Modal';
import { Button } from '../Button';
import OptimizeIcon from '../Icons/Optimize/Optimize';
import { normalizeBytes } from '../ImportAsset/utils';
import { getMaxHeight } from './utils';
import type { Props, CompressionSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import type { OptimizeAssetsResult } from '../../lib/rpc/scene/client';

import './OptimizeAssets.css';

const TEXTURE_TYPE_LABELS: Record<string, string> = {
  baseColor: 'Base Color',
  normal: 'Normal Map',
  orm: 'ORM',
  emissive: 'Emissive',
  other: 'Other',
};

const OptimizeAssets: React.FC<Props> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [settings, setSettings] = useState<CompressionSettings>({ ...DEFAULT_SETTINGS });
  const [results, setResults] = useState<OptimizeAssetsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pushNotification } = useSnackbar();

  const savedBytes = useMemo(() => {
    if (!results) return 0;
    return results.summary.totalSaved;
  }, [results]);

  const handleSettingChange = useCallback(
    (key: keyof CompressionSettings, value: number | string) => {
      setSettings(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleOptimize = useCallback(async () => {
    const sceneClient = getSceneClient();
    if (!sceneClient) return;

    setIsOptimizing(true);
    setResults(null);
    setError(null);

    try {
      const result = await sceneClient.optimizeAssets({
        basecolorSize: settings.basecolorSize,
        normalSize: settings.normalSize,
        ormSize: settings.ormSize,
        emissiveSize: settings.emissiveSize,
        otherSize: settings.otherSize,
        quality: settings.quality,
        format: settings.format,
      });

      setResults(result);

      if (result.summary.filesOptimized > 0) {
        pushNotification(
          'success',
          `${result.summary.filesOptimized} ${result.summary.filesOptimized === 1 ? 'file' : 'files'} optimized. Saved ${normalizeBytes(result.summary.totalSaved)}.`,
        );
        dispatch(getAssetCatalog());
      } else {
        pushNotification('info', 'No files were optimized — all were already at or below target size.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Optimization failed';
      setError(message);
      pushNotification('error', message);
    } finally {
      setIsOptimizing(false);
    }
  }, [settings, pushNotification, dispatch]);

  const handleBack = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    setResults(null);
    setError(null);
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
              {results.glbsProcessed > 0 && (
                <div className="ResultsStat">
                  <span className="ResultsLabel">GLBs processed</span>
                  <span className="ResultsValue">{results.glbsProcessed}</span>
                </div>
              )}
              {results.texturesExtracted > 0 && (
                <div className="ResultsStat">
                  <span className="ResultsLabel">Textures extracted</span>
                  <span className="ResultsValue">{results.texturesExtracted}</span>
                </div>
              )}
              <div className="ResultsStat">
                <span className="ResultsLabel">Files processed</span>
                <span className="ResultsValue">{results.summary.filesProcessed}</span>
              </div>
              <div className="ResultsStat">
                <span className="ResultsLabel">Files optimized</span>
                <span className="ResultsValue">{results.summary.filesOptimized}</span>
              </div>
              <div className="ResultsStat">
                <span className="ResultsLabel">Files skipped</span>
                <span className="ResultsValue">
                  {results.summary.filesProcessed - results.summary.filesOptimized}
                </span>
              </div>
              <div className="ResultsStat total">
                <span className="ResultsLabel">Total saved</span>
                <span className="ResultsValue">{normalizeBytes(savedBytes)}</span>
              </div>
            </div>
          ) : (
            <>
              <p>
                Resize and compress image textures in your scene. GLB files with embedded textures
                are automatically extracted first, then all images are optimized.
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
          {isOptimizing ? (
            <div className="LoadingContainer">
              <div className="SpinnerContainer">
                <Loading dimmer={false} />
              </div>
              <p>OPTIMIZING ASSETS...</p>
            </div>
          ) : error ? (
            <>
              <div className="stats">
                <p className="FilesCounter">OPTIMIZATION FAILED</p>
              </div>
              <div className="FileList">
                <p className="EmptyFiles">{error}</p>
              </div>
              <div className="footer">
                <Button
                  type="text"
                  onClick={handleBack}
                  className="ScanButton"
                >
                  BACK
                </Button>
              </div>
            </>
          ) : results ? (
            <>
              <div className="stats">
                <p className="FilesCounter">{results.summary.filesProcessed} FILES PROCESSED</p>
                <p className="TotalSize">Saved: {normalizeBytes(savedBytes)}</p>
              </div>
              <div className="FileList">
                {results.compression.map(result => (
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
                      {result.skipped && result.reason && (
                        <span className="skipped-label">{result.reason}</span>
                      )}
                      {result.skipped && !result.reason && (
                        <span className="skipped-label">skipped</span>
                      )}
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
              <div className="FileList">
                <p className="EmptyFiles">
                  Configure settings and click Optimize <br /> to process all scene assets
                </p>
              </div>
              <div className="footer">
                <Button onClick={handleOptimize}>
                  <OptimizeIcon />
                  OPTIMIZE
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
