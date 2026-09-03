import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from 'decentraland-ui2';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import {
  DEFAULT_OPTIMIZE_OPTIONS,
  type GeometryCompression,
  type OptimizeOptions,
  type TextureCategory,
  type TextureFormat,
} from '/shared/types/optimizer';
import type { Project } from '/shared/types/projects';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { misc, optimizer as optimizerPreload } from '#preload';
import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/optimizer';
import { t } from '/@/modules/store/translation/utils';

import { Modal } from '../Modals';
import './styles.css';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

const TEXTURE_CATEGORIES: TextureCategory[] = ['baseColor', 'normal', 'orm', 'emissive', 'other'];
const FORMATS: TextureFormat[] = ['png', 'jpeg', 'webp'];

// TODO: replace with the published "Optimize models" documentation URL.
const DOCS_URL = 'https://docs.decentraland.org/creator/optimize-models';

// The open-source tools the optimizer relies on. Shown up front (with links out to their
// package and source pages) so the creator can review them before running anything. `draco`
// only loads when Draco compression is chosen.
const TOOLS: {
  name: string;
  purposeKey: 'sharp' | 'gltf' | 'oxipng' | 'meshopt' | 'draco';
  npm: string;
  source: string;
}[] = [
  {
    name: 'sharp',
    purposeKey: 'sharp',
    npm: 'https://www.npmjs.com/package/sharp',
    source: 'https://github.com/lovell/sharp/releases',
  },
  {
    name: 'glTF-Transform',
    purposeKey: 'gltf',
    npm: 'https://www.npmjs.com/package/@gltf-transform/core',
    source: 'https://github.com/donmccurdy/glTF-Transform/releases',
  },
  {
    name: 'oxipng',
    purposeKey: 'oxipng',
    npm: 'https://www.npmjs.com/package/@wasm-codecs/oxipng',
    source: 'https://github.com/oxipng/oxipng/releases',
  },
  {
    name: 'meshoptimizer',
    purposeKey: 'meshopt',
    npm: 'https://www.npmjs.com/package/meshoptimizer',
    source: 'https://github.com/zeux/meshoptimizer/releases',
  },
  {
    name: 'Draco',
    purposeKey: 'draco',
    npm: 'https://www.npmjs.com/package/draco3dgltf',
    source: 'https://github.com/google/draco/releases',
  },
];

function InfoTip({ tip }: { tip: string }) {
  return (
    <Tooltip
      title={tip}
      placement="top"
      arrow
    >
      <InfoOutlinedIcon
        className="info-tip"
        fontSize="small"
        tabIndex={0}
        aria-label={tip}
      />
    </Tooltip>
  );
}

// Label + info icon, for use as a FormControlLabel `label` or a standalone field label.
function LabelWithInfo({ text, tip }: { text: string; tip: string }) {
  return (
    <span className="label-with-info">
      {text}
      <InfoTip tip={tip} />
    </span>
  );
}

export function OptimizeModal({ project }: { project?: Project | null }) {
  const dispatch = useDispatch();
  const { isOpen, acknowledged, scan, scanStatus, runStatus, progress, result, error } =
    useSelector(state => state.optimizer);

  const [options, setOptions] = useState<OptimizeOptions>(DEFAULT_OPTIMIZE_OPTIONS);
  const [showDetails, setShowDetails] = useState(false);

  const projectPath = project?.path ?? null;
  const isRunning = runStatus === 'loading';

  // Scan the scene only after the creator has seen the disclosure and continued — so nothing
  // touches their files until they've decided to proceed.
  useEffect(() => {
    if (isOpen && acknowledged && projectPath) dispatch(actions.scanProject(projectPath));
  }, [isOpen, acknowledged, projectPath, dispatch]);

  // Stream progress for this scene while the modal is open.
  useEffect(() => {
    if (!isOpen || !projectPath) return;
    const { cleanup } = optimizerPreload.subscribeProgress(projectPath, p =>
      dispatch(actions.setProgress(p)),
    );
    return cleanup;
  }, [isOpen, projectPath, dispatch]);

  const updateMesh = useCallback(
    (patch: Partial<OptimizeOptions['mesh']>) =>
      setOptions(o => ({ ...o, mesh: { ...o.mesh, ...patch } })),
    [],
  );
  const updateTextures = useCallback(
    (patch: Partial<OptimizeOptions['textures']>) =>
      setOptions(o => ({ ...o, textures: { ...o.textures, ...patch } })),
    [],
  );
  const updateSize = useCallback(
    (category: TextureCategory, value: number) =>
      setOptions(o => ({
        ...o,
        textures: { ...o.textures, sizes: { ...o.textures.sizes, [category]: value } },
      })),
    [],
  );

  const handleClose = useCallback(() => {
    if (!isRunning) dispatch(actions.close());
  }, [isRunning, dispatch]);

  const handleRun = useCallback(() => {
    if (projectPath) dispatch(actions.runOptimize({ path: projectPath, options }));
  }, [projectPath, options, dispatch]);

  const handleRevert = useCallback(() => {
    if (projectPath) dispatch(actions.revertProject(projectPath));
  }, [projectPath, dispatch]);

  const percent = useMemo(() => {
    if (progress && progress.total > 0)
      return Math.round((progress.current / progress.total) * 100);
    return 0;
  }, [progress]);

  const savings = useMemo(() => {
    if (!result || result.bytesBefore === 0) return { saved: 0, percent: '0.0' };
    const saved = result.bytesBefore - result.bytesAfter;
    return { saved, percent: ((saved / result.bytesBefore) * 100).toFixed(1) };
  }, [result]);

  const details = useMemo(() => {
    const files = result?.files ?? [];
    const counts = { optimized: 0, unchanged: 0, skipped: 0 };
    for (const f of files) counts[f.status]++;
    const saved = (f: (typeof files)[number]) => f.bytesBefore - f.bytesAfter;
    // Most-impactful first — that's what a creator wants to scan.
    const sorted = [...files].sort((a, b) => saved(b) - saved(a));
    return { counts, sorted };
  }, [result]);

  if (!isOpen || !project) return null;

  return (
    <Modal
      open={isOpen}
      size="small"
      title={t('optimize.title')}
      onClose={handleClose}
    >
      {!acknowledged ? (
        <div className="OptimizeModal consent">
          <Typography
            variant="body2"
            className="subtitle"
          >
            {t('optimize.consent.blurb')}
          </Typography>
          <ul className="tool-list">
            {TOOLS.map(tool => (
              <li key={tool.name}>
                <div className="tool-head">
                  <span className="tool-name">{tool.name}</span>
                  <span className="tool-links">
                    <button
                      type="button"
                      className="docs-link"
                      onClick={() => misc.openExternal(tool.npm)}
                    >
                      {t('optimize.consent.npm')}
                      <OpenInNewIcon fontSize="inherit" />
                    </button>
                    <button
                      type="button"
                      className="docs-link"
                      onClick={() => misc.openExternal(tool.source)}
                    >
                      {t('optimize.consent.source')}
                      <OpenInNewIcon fontSize="inherit" />
                    </button>
                  </span>
                </div>
                <span className="tool-purpose">
                  {t(`optimize.consent.purpose.${tool.purposeKey}`)}
                </span>
              </li>
            ))}
          </ul>
          <Typography
            variant="caption"
            className="consent-note"
          >
            {t('optimize.consent.note')}
          </Typography>
          <Box className="actions">
            <Button
              variant="contained"
              onClick={() => dispatch(actions.acknowledge())}
            >
              {t('optimize.consent.continue')}
            </Button>
            <Button
              variant="outlined"
              onClick={handleClose}
            >
              {t('optimize.consent.cancel')}
            </Button>
          </Box>
        </div>
      ) : (
        <div className="OptimizeModal">
          <Typography
            variant="body2"
            className="subtitle"
          >
            {t('optimize.subtitle')}
          </Typography>

          <button
            type="button"
            className="docs-link"
            onClick={() => misc.openExternal(DOCS_URL)}
          >
            {t('optimize.docs_link')}
            <OpenInNewIcon fontSize="inherit" />
          </button>

          {scanStatus === 'succeeded' && scan && (
            <Box className="summary">
              {scan.glbCount === 0 ? (
                <Typography className="empty">{t('optimize.scan.empty')}</Typography>
              ) : (
                <>
                  <span>{t('optimize.scan.glbs', { count: scan.glbCount })}</span>
                  <span>{t('optimize.scan.size', { size: formatBytes(scan.totalBytes) })}</span>
                  <span>{t('optimize.scan.textures', { count: scan.embeddedTextureCount })}</span>
                </>
              )}
            </Box>
          )}

          <Box className="options">
            <Typography variant="h6">{t('optimize.options.mesh.title')}</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={options.mesh.enabled}
                  onChange={e => updateMesh({ enabled: e.target.checked })}
                />
              }
              label={
                <LabelWithInfo
                  text={t('optimize.options.mesh.enabled')}
                  tip={t('optimize.options.mesh.enabled_tip')}
                />
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.mesh.join}
                  disabled={!options.mesh.enabled}
                  onChange={e => updateMesh({ join: e.target.checked })}
                />
              }
              label={
                <LabelWithInfo
                  text={t('optimize.options.mesh.join')}
                  tip={t('optimize.options.mesh.join_tip')}
                />
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.mesh.simplify}
                  disabled={!options.mesh.enabled}
                  onChange={e => updateMesh({ simplify: e.target.checked })}
                />
              }
              label={
                <LabelWithInfo
                  text={t('optimize.options.mesh.simplify')}
                  tip={t('optimize.options.mesh.simplify_tip')}
                />
              }
            />
            {options.mesh.enabled && options.mesh.simplify && (
              <Box className="slider">
                <span>{t('optimize.options.mesh.ratio')}</span>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={options.mesh.simplifyRatio}
                  valueLabelDisplay="auto"
                  onChange={(_, v) => updateMesh({ simplifyRatio: v as number })}
                />
              </Box>
            )}

            <Box className="row">
              <LabelWithInfo
                text={t('optimize.options.mesh.compression')}
                tip={t('optimize.options.mesh.compression_tip')}
              />
              <Select
                size="small"
                value={options.mesh.compression}
                disabled={!options.mesh.enabled}
                onChange={e => updateMesh({ compression: e.target.value as GeometryCompression })}
              >
                <MenuItem value="none">{t('optimize.options.mesh.compression_none')}</MenuItem>
                <MenuItem value="quantize">
                  {t('optimize.options.mesh.compression_quantize')}
                </MenuItem>
                <MenuItem value="meshopt">
                  {t('optimize.options.mesh.compression_meshopt')}
                </MenuItem>
                <MenuItem value="draco">{t('optimize.options.mesh.compression_draco')}</MenuItem>
              </Select>
            </Box>
            {options.mesh.enabled && options.mesh.compression !== 'none' && (
              <Typography
                variant="caption"
                className="warning"
              >
                {t('optimize.options.mesh.compression_warning')}
              </Typography>
            )}

            <Typography variant="h6">{t('optimize.options.textures.title')}</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={options.textures.compress}
                  onChange={e => updateTextures({ compress: e.target.checked })}
                />
              }
              label={
                <LabelWithInfo
                  text={t('optimize.options.textures.compress')}
                  tip={t('optimize.options.textures.compress_tip')}
                />
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={options.textures.dedup}
                  onChange={e => updateTextures({ dedup: e.target.checked })}
                />
              }
              label={
                <LabelWithInfo
                  text={t('optimize.options.textures.dedup')}
                  tip={t('optimize.options.textures.dedup_tip')}
                />
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={options.textures.externalize}
                  onChange={e => updateTextures({ externalize: e.target.checked })}
                />
              }
              label={
                <LabelWithInfo
                  text={t('optimize.options.textures.externalize')}
                  tip={t('optimize.options.textures.externalize_tip')}
                />
              }
            />

            {options.textures.compress && (
              <>
                <Box className="row">
                  <LabelWithInfo
                    text={t('optimize.options.textures.format')}
                    tip={t('optimize.options.textures.format_tip')}
                  />
                  <Select
                    size="small"
                    value={options.textures.format}
                    onChange={e => updateTextures({ format: e.target.value as TextureFormat })}
                  >
                    {FORMATS.map(f => (
                      <MenuItem
                        key={f}
                        value={f}
                      >
                        {f.toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>

                {options.textures.format !== 'png' && (
                  <Box className="slider">
                    <LabelWithInfo
                      text={t('optimize.options.textures.quality')}
                      tip={t('optimize.options.textures.quality_tip')}
                    />
                    <Slider
                      min={1}
                      max={100}
                      value={options.textures.quality}
                      valueLabelDisplay="auto"
                      onChange={(_, v) => updateTextures({ quality: v as number })}
                    />
                  </Box>
                )}

                <Typography className="sizes-title">
                  <LabelWithInfo
                    text={t('optimize.options.textures.sizes')}
                    tip={t('optimize.options.textures.sizes_tip')}
                  />
                </Typography>
                <Box className="sizes">
                  {TEXTURE_CATEGORIES.map(cat => (
                    <TextField
                      key={cat}
                      size="small"
                      type="number"
                      label={t(`optimize.options.textures.${cat}`)}
                      value={options.textures.sizes[cat]}
                      onChange={e => updateSize(cat, Number(e.target.value))}
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>

          {isRunning && (
            <Box className="progress">
              <LinearProgress
                variant={progress && progress.total > 0 ? 'determinate' : 'indeterminate'}
                value={percent}
              />
              <span className="progress-message">{progress?.message ?? t('optimize.running')}</span>
            </Box>
          )}

          {error && runStatus === 'failed' && (
            <Typography className="error">{t('optimize.error', { message: error })}</Typography>
          )}

          {result && runStatus === 'succeeded' && (
            <Box className="result">
              <Typography variant="h6">{t('optimize.result.title')}</Typography>
              <span className="saved">
                {t('optimize.result.saved', {
                  saved: formatBytes(savings.saved),
                  percent: savings.percent,
                })}
              </span>
              <span>
                {t('optimize.result.before_after', {
                  before: formatBytes(result.bytesBefore),
                  after: formatBytes(result.bytesAfter),
                })}
              </span>
              <span>{t('optimize.result.glbs_changed', { count: result.glbsChanged })}</span>
              <span>
                {t('optimize.result.textures_extracted', { count: result.texturesExtracted })}
              </span>
              <span>
                {t('optimize.result.textures_deduped', { count: result.texturesDeduped })}
              </span>
              {(details.counts.unchanged > 0 || details.counts.skipped > 0) && (
                <span className="muted">
                  {t('optimize.result.unchanged_skipped', {
                    unchanged: details.counts.unchanged,
                    skipped: details.counts.skipped,
                  })}
                </span>
              )}

              <FormControlLabel
                className="details-toggle"
                control={
                  <Switch
                    size="small"
                    checked={showDetails}
                    onChange={e => setShowDetails(e.target.checked)}
                  />
                }
                label={t('optimize.result.show_details')}
              />

              {showDetails && (
                <div className="file-details">
                  {details.sorted.map(f => {
                    const saved = f.bytesBefore - f.bytesAfter;
                    const pct =
                      f.bytesBefore > 0 ? ((saved / f.bytesBefore) * 100).toFixed(0) : '0';
                    return (
                      <div
                        className="file-row"
                        key={f.file}
                      >
                        <span
                          className="file-name"
                          title={f.file}
                        >
                          {f.file}
                        </span>
                        {f.status === 'optimized' ? (
                          <span className="file-size">
                            {formatBytes(f.bytesBefore)} → {formatBytes(f.bytesAfter)}
                            <em className="file-pct"> −{pct}%</em>
                          </span>
                        ) : (
                          <span className="file-status">
                            {t(`optimize.result.status.${f.status}`)}
                          </span>
                        )}
                        <span className="file-badges">
                          {f.texturesExtracted > 0 && <em>+{f.texturesExtracted} tex</em>}
                          {f.texturesDeduped > 0 && <em>−{f.texturesDeduped} dup</em>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Box>
          )}

          <Box className="actions">
            <Button
              variant="contained"
              disabled={isRunning || !projectPath || scan?.glbCount === 0}
              onClick={handleRun}
            >
              {isRunning ? t('optimize.running') : t('optimize.run')}
            </Button>
            {scan?.hasBackup && (
              <Button
                variant="outlined"
                disabled={isRunning}
                onClick={handleRevert}
              >
                {t('optimize.revert')}
              </Button>
            )}
          </Box>
        </div>
      )}
    </Modal>
  );
}
