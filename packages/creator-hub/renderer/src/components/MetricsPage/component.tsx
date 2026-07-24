import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import cx from 'classnames';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeftOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorderOutlined';
import CalendarIcon from '@mui/icons-material/CalendarMonthOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardOutlined';
import { Box, Chip, MenuItem, Tooltip, Typography } from 'decentraland-ui2';
import { analytics, misc } from '#preload';
import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { t } from '/@/modules/store/translation/utils';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { isRankingEnabled } from '/@/lib/metrics';
import { actions as metricsActions } from '/@/modules/store/metrics';
import {
  buildCsvRows,
  buildSocialSeries,
  dailyMeanDelta,
  getLastDeploy,
  isSeriesEmpty,
  retentionPoints,
  sceneDisplayName,
  tailPoints,
  toCsv,
  WINDOW_BY_RANGE,
} from '/@/modules/store/metrics';
import type { ChartSeries, RangeDays, RetentionKey } from '/@/modules/store/metrics';
import type { ManagedProject } from '/shared/types/manage';
import type { SceneStats, SceneType } from '/shared/types/metrics';
import { resolveSceneMetricsTarget } from '../EditorPage/utils';
import { Navbar, NavbarItem } from '../Navbar';
import { Container } from '../Container';
import { Loader } from '../Loader';
import { Button } from '../Button';
import { Select } from '../Select';
import { Chart } from './Chart';
import './styles.css';

const RANGE_OPTIONS: RangeDays[] = [7, 30, 90];
const OVERVIEW_WINDOW = 'last_30d' as const;

const RANGE_LABEL_KEYS = {
  7: 'metrics.range.last_7d',
  30: 'metrics.range.last_30d',
  90: 'metrics.range.last_90d',
} as const;

const COLOR = {
  ruby: 'var(--primary)',
  messages: '#2196F3',
  emotes: '#34CE77',
} as const;

type LocationState = {
  sceneType?: SceneType;
  sceneId?: string;
  source?: 'manage-card' | 'publish-success' | 'editor';
};

type PortfolioSort = 'recent' | 'visitors' | 'name';

const PORTFOLIO_SORTS: PortfolioSort[] = ['recent', 'visitors', 'name'];

const PORTFOLIO_WINDOW = 'last_30d' as const;

const NO_DATA = '—';

function formatNumber(value: number | null): string {
  return value === null ? NO_DATA : value.toLocaleString();
}

function formatPercent(value: number | null): string {
  return value === null ? NO_DATA : `${Math.round(value)}%`;
}

function formatMinutes(seconds: number | null): string {
  return seconds === null
    ? NO_DATA
    : t('metrics.unit.min', { value: Math.round((seconds / 60) * 10) / 10 });
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function truncateAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

const SUBMIT_EVENT_URL = 'https://decentraland.org/events/submit';

function jumpInUrl(scene: SceneStats): string {
  if (scene.sceneType === 'world') {
    return `https://decentraland.org/play/?realm=${encodeURIComponent(scene.sceneId)}`;
  }
  return `https://decentraland.org/play/?position=${encodeURIComponent(scene.sceneId.replace('|', ','))}`;
}

function sceneKey(scene: Pick<SceneStats, 'sceneType' | 'sceneId'>): string {
  return `${scene.sceneType}:${scene.sceneId}`;
}

function lastActive(scene: SceneStats): string | null {
  return getLastDeploy(scene);
}

function comparePortfolio(a: SceneStats, b: SceneStats, sort: PortfolioSort): number {
  if (sort === 'name') {
    return sceneDisplayName(a).localeCompare(sceneDisplayName(b), undefined, {
      sensitivity: 'base',
    });
  }
  if (sort === 'visitors') {
    return (b.windows[PORTFOLIO_WINDOW].users ?? -1) - (a.windows[PORTFOLIO_WINDOW].users ?? -1);
  }
  return (lastActive(b) ?? '').localeCompare(lastActive(a) ?? '');
}

function ScenePortfolioCard({ scene, onOpen }: { scene: SceneStats; onOpen: () => void }) {
  const isWorld = scene.sceneType === 'world';
  const w = scene.windows[PORTFOLIO_WINDOW];
  const d7 = scene.retention.d7;
  const updated = lastActive(scene);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    },
    [onOpen],
  );

  return (
    <div
      className="ScenePortfolioCard"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <Box className="PortfolioIdentity">
        {isWorld ? (
          <PublicOutlinedIcon className="PortfolioTypeIcon" />
        ) : (
          <PlaceOutlinedIcon className="PortfolioTypeIcon" />
        )}
        <Box className="PortfolioNames">
          <Typography className="PortfolioName">{sceneDisplayName(scene)}</Typography>
          {!isWorld && scene.title && (
            <Typography className="PortfolioCoords">{scene.sceneId}</Typography>
          )}
        </Box>
        <Chip
          className="PortfolioTypeChip"
          variant="outlined"
          size="small"
          label={isWorld ? t('metrics.scene.type_world') : t('metrics.scene.type_genesis')}
        />
      </Box>
      <Box className="PortfolioStats">
        <Box className="PortfolioStat">
          <Typography className="PortfolioStatLabel">
            {t('metrics.portfolio.stat.unique_visitors')}
          </Typography>
          <Typography className="PortfolioStatValue">{formatNumber(w.users)}</Typography>
        </Box>
        <Box className="PortfolioStat">
          <Typography className="PortfolioStatLabel">
            {t('metrics.overview.tile.total_visits')}
          </Typography>
          <Typography className="PortfolioStatValue">{formatNumber(w.visits)}</Typography>
        </Box>
        <Box className="PortfolioStat">
          <Typography className="PortfolioStatLabel">{t('metrics.overview.tile.d7')}</Typography>
          {d7 !== null ? (
            <Typography className="PortfolioStatValue Positive">{`${Math.round(d7)}%`}</Typography>
          ) : (
            <Typography className="PortfolioStatValue Muted">
              {t('metrics.not_enough_data')}
            </Typography>
          )}
        </Box>
        <Box className="PortfolioStat">
          <Typography className="PortfolioStatLabel">{t('metrics.scene.last_update')}</Typography>
          <Typography className="PortfolioStatValue">
            {updated ? formatDate(updated) : NO_DATA}
          </Typography>
        </Box>
      </Box>
    </div>
  );
}

function ScenePortfolio({
  scenes,
  onOpen,
}: {
  scenes: SceneStats[];
  onOpen: (scene: SceneStats) => void;
}) {
  const [sort, setSort] = useState<PortfolioSort>('recent');
  const sorted = useMemo(
    () => [...scenes].sort((a, b) => comparePortfolio(a, b, sort)),
    [scenes, sort],
  );

  return (
    <>
      <Typography variant="h3">{t('metrics.header.title')}</Typography>
      <Box className="PortfolioControls">
        <Typography variant="h6">
          {t('metrics.portfolio.count', { count: scenes.length })}
        </Typography>
        <Box className="PortfolioSort">
          <Typography>{t('metrics.portfolio.sort_by')}</Typography>
          <Select
            value={sort}
            onChange={event => setSort(event.target.value as PortfolioSort)}
          >
            {PORTFOLIO_SORTS.map(option => (
              <MenuItem
                key={option}
                value={option}
              >
                {t(`metrics.portfolio.sort.${option}`)}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>
      <Box className="ScenePortfolioList">
        {sorted.map(scene => (
          <ScenePortfolioCard
            key={sceneKey(scene)}
            scene={scene}
            onOpen={() => onOpen(scene)}
          />
        ))}
      </Box>
    </>
  );
}

function SignInCard({ onClickSignIn }: { onClickSignIn: () => void }) {
  return (
    <Box className="Card SignInCard">
      <Typography
        className="CardTitle"
        variant="h6"
      >
        {t('metrics.sign_in.title')}
      </Typography>
      <Button
        className="SignInButton"
        variant="contained"
        onClick={onClickSignIn}
      >
        {t('metrics.sign_in.action')}
      </Button>
    </Box>
  );
}

function DeltaChip({ pct }: { pct: number | null }) {
  if (pct === null || pct === 0) return null;
  const up = pct > 0;
  return (
    <Typography className={cx('DeltaChip', up ? 'Up' : 'Down')}>
      {`${up ? '↑' : '↓'}${Math.abs(pct)}%`}
    </Typography>
  );
}

type TileProps = {
  label: string;
  tip?: string;
  valueClassName?: string;
  children: React.ReactNode;
};

function MetricTile({ label, tip, valueClassName, children }: TileProps) {
  return (
    <Box className="MetricTile">
      <Box className="TileHeader">
        <Typography className="TileLabel">{label}</Typography>
        {tip && (
          <Tooltip
            title={tip}
            arrow
          >
            <InfoOutlinedIcon
              className="TileInfo"
              fontSize="inherit"
              aria-label={tip}
            />
          </Tooltip>
        )}
      </Box>
      <Box className={cx('TileValue', valueClassName)}>{children}</Box>
    </Box>
  );
}

function DateRangeControl({
  range,
  onChange,
}: {
  range: RangeDays;
  onChange: (range: RangeDays) => void;
}) {
  return (
    <Box className="DateRangeControl">
      <Typography className="DateRangeLabel">{t('metrics.retention.date_range')}</Typography>
      <Box className="DateRangeChips">
        {RANGE_OPTIONS.map(option => (
          <button
            key={option}
            type="button"
            className={cx('DateRangeChip', { Active: option === range })}
            onClick={() => onChange(option)}
          >
            {t(RANGE_LABEL_KEYS[option])}
          </button>
        ))}
      </Box>
    </Box>
  );
}

function SceneCard({ scene, project }: { scene: SceneStats; project?: ManagedProject }) {
  const thumbnail = project?.deployment?.thumbnail;
  const lastDeploy = getLastDeploy(scene);
  const isWorld = scene.sceneType === 'world';
  const { projects: localProjects, runProject } = useWorkspace();
  const { pushGeneric } = useSnackbar();

  const localProject = useMemo(
    () =>
      localProjects.find($ => {
        const target = resolveSceneMetricsTarget($);
        return target?.sceneType === scene.sceneType && target?.sceneId === scene.sceneId;
      }),
    [localProjects, scene.sceneType, scene.sceneId],
  );

  const handleCopyUrl = useCallback(() => {
    void misc.copyToClipboard(jumpInUrl(scene));
    pushGeneric('success', t('snackbar.generic.url_copied'));
  }, [scene, pushGeneric]);

  const handleJumpIn = useCallback(() => {
    void misc.openExternal(jumpInUrl(scene));
  }, [scene]);

  const handleCreateEvent = useCallback(() => {
    void misc.openExternal(SUBMIT_EVENT_URL);
  }, []);

  const handleEditScene = useCallback(() => {
    if (localProject) runProject(localProject);
  }, [localProject, runProject]);

  return (
    <Box className="SceneCard">
      <Box className="SceneThumb">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={sceneDisplayName(scene)}
          />
        ) : (
          <Box className="SceneThumbEmpty" />
        )}
      </Box>
      <Typography
        variant="h5"
        className="SceneName"
      >
        {sceneDisplayName(scene)}
      </Typography>
      <Box className="SceneLike">
        <FavoriteBorderIcon fontSize="inherit" />
        <Typography className="SceneLikeValue">{t('metrics.not_available_short')}</Typography>
      </Box>

      <Box className="SceneMeta">
        <Typography className="SceneMetaLabel">{t('metrics.scene.access')}</Typography>
        <Box className="SceneMetaValue">
          {isWorld ? (
            <LockOutlinedIcon fontSize="inherit" />
          ) : (
            <PublicOutlinedIcon fontSize="inherit" />
          )}
          <span>
            {isWorld ? t('metrics.scene.access_private') : t('metrics.scene.access_public')}
          </span>
        </Box>
      </Box>
      <Box className="SceneMeta">
        <Typography className="SceneMetaLabel">{t('metrics.scene.published_in')}</Typography>
        <Box className="SceneMetaValue">
          <PlaceOutlinedIcon fontSize="inherit" />
          <span>{scene.sceneId}</span>
        </Box>
      </Box>
      <Box className="SceneMeta">
        <Typography className="SceneMetaLabel">{t('metrics.scene.last_published_by')}</Typography>
        <Box className="SceneMetaValue">
          <span>{scene.deployerAddress ? truncateAddress(scene.deployerAddress) : '—'}</span>
        </Box>
      </Box>
      <Box className="SceneMeta">
        <Typography className="SceneMetaLabel">{t('metrics.scene.last_update')}</Typography>
        <Box className="SceneMetaValue">
          <span>{lastDeploy ? formatDate(lastDeploy) : '—'}</span>
        </Box>
      </Box>

      <Box className="SceneActions">
        <button
          type="button"
          className="SceneAction"
          onClick={handleCreateEvent}
        >
          <CalendarIcon fontSize="inherit" />
          <span>{t('metrics.scene.create_event')}</span>
        </button>
        <Tooltip
          title={localProject ? '' : t('metrics.scene.edit_scene_unavailable')}
          placement="top"
          arrow
        >
          <span className="SceneActionSlot">
            <button
              type="button"
              className="SceneAction"
              disabled={!localProject}
              onClick={handleEditScene}
            >
              <EditOutlinedIcon fontSize="inherit" />
              <span>{t('metrics.scene.edit_scene')}</span>
            </button>
          </span>
        </Tooltip>
        <button
          type="button"
          className="SceneAction"
          onClick={handleCopyUrl}
        >
          <LinkOutlinedIcon fontSize="inherit" />
          <span>{t('metrics.scene.copy_url')}</span>
        </button>
      </Box>

      <Button
        className="JumpInButton"
        variant="contained"
        onClick={handleJumpIn}
      >
        {t('metrics.scene.jump_in')}
        <ArrowForwardIcon fontSize="inherit" />
      </Button>
    </Box>
  );
}

function OverviewSection({ scene }: { scene: SceneStats }) {
  const { flags } = useFeatureFlags();
  const rankingEnabled = isRankingEnabled(flags);
  const w = scene.windows[OVERVIEW_WINDOW];
  const d7 = scene.retention.d7;

  return (
    <Box
      component="section"
      className="SectionCard OverviewSection"
    >
      <Typography
        variant="h5"
        className="SectionTitle"
      >
        {t('metrics.overview.title')}
      </Typography>

      {rankingEnabled && (
        <Box className="RankingSlot">
          <Typography className="RankingLabel">{t('metrics.overview.ranking')}</Typography>
          <Typography className="RankingValue">—</Typography>
          <Typography className="RankingLink">{t('metrics.overview.view_leaderboard')}</Typography>
        </Box>
      )}

      <Box className="TileGrid">
        <MetricTile
          label={t('metrics.overview.tile.total_visits')}
          tip={t('metrics.overview.tip.total_visits')}
        >
          {formatNumber(w.visits)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.unique_visits')}
          tip={t('metrics.overview.tip.unique_visits')}
        >
          {formatNumber(w.users)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.concurrent_users')}
          tip={t('metrics.overview.tip.concurrent_users')}
        >
          {formatNumber(w.peakConcurrentUsers)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.revenue')}
          tip={t('metrics.overview.tip.revenue')}
          valueClassName="Muted"
        >
          —
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.new_users')}
          tip={t('metrics.overview.tip.new_users')}
        >
          {formatNumber(w.newUsers)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.dau')}
          tip={t('metrics.overview.tip.dau')}
        >
          {formatNumber(w.dau)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.d7')}
          tip={t('metrics.overview.tip.d7')}
          valueClassName={d7 !== null ? 'Positive' : 'Muted'}
        >
          {d7 !== null ? `${Math.round(d7)}%` : t('metrics.not_enough_data')}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.avg_playtime')}
          tip={t('metrics.overview.tip.avg_playtime')}
        >
          {formatMinutes(w.medianActiveTimeS)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.afk_time')}
          tip={t('metrics.overview.tip.afk_time')}
        >
          {formatPercent(w.afkTimePct)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.desktop')}
          tip={t('metrics.overview.tip.device')}
        >
          {formatNumber(w.desktopUsers)}
        </MetricTile>
        <MetricTile
          label={t('metrics.overview.tile.mobile')}
          tip={t('metrics.overview.tip.device')}
        >
          {formatNumber(w.mobileUsers)}
        </MetricTile>
      </Box>
    </Box>
  );
}

function RetentionChart({
  scene,
  metric,
  label,
  range,
  className,
}: {
  scene: SceneStats;
  metric: RetentionKey;
  label: string;
  range: RangeDays;
  className?: string;
}) {
  const points = useMemo(
    () => tailPoints(retentionPoints(scene, metric), range),
    [scene, metric, range],
  );
  const series: ChartSeries[] = [{ key: metric, label, color: COLOR.ruby, points }];

  return (
    <Box className={cx('RetentionChart', className)}>
      <Typography className="ChartTitle">{label}</Typography>
      {isSeriesEmpty(points) ? (
        <Box className="ChartEmpty">
          <Typography>{t('metrics.not_enough_data')}</Typography>
        </Box>
      ) : (
        <Chart
          series={series}
          ariaLabel={label}
          unit="%"
          yMax={80}
          yStep={20}
          area
          showDelta
        />
      )}
    </Box>
  );
}

function RetentionSection({ scene }: { scene: SceneStats }) {
  const [range, setRange] = useState<RangeDays>(90);

  return (
    <Box
      component="section"
      className="SectionCard RetentionSection"
    >
      <Box className="SectionHeader">
        <Typography
          variant="h5"
          className="SectionTitle"
        >
          {t('metrics.retention.title')}
        </Typography>
        <DateRangeControl
          range={range}
          onChange={setRange}
        />
      </Box>
      <Box className="RetentionRow">
        <RetentionChart
          scene={scene}
          metric="d1"
          label={t('metrics.retention.day1')}
          range={range}
        />
        <RetentionChart
          scene={scene}
          metric="d7"
          label={t('metrics.retention.day7')}
          range={range}
        />
      </Box>
      <RetentionChart
        scene={scene}
        metric="d30"
        label={t('metrics.retention.day30')}
        range={range}
        className="FullWidth"
      />
    </Box>
  );
}

function EngagementSection({ scene, asOf }: { scene: SceneStats; asOf: string }) {
  const [range, setRange] = useState<RangeDays>(7);
  const windowKey = WINDOW_BY_RANGE[range];
  const w = windowKey ? scene.windows[windowKey] : null;
  const playtimeDelta = useMemo(
    () => dailyMeanDelta([scene], asOf, range, row => row.medianActiveTimeS),
    [scene, asOf, range],
  );
  const social = useMemo(() => buildSocialSeries([scene], asOf, range), [scene, asOf, range]);
  const socialSeries: ChartSeries[] = [
    {
      key: 'messages',
      label: t('metrics.engagement.messages'),
      color: COLOR.messages,
      points: social.messages,
    },
    {
      key: 'emotes',
      label: t('metrics.engagement.emotes'),
      color: COLOR.emotes,
      points: social.emotes,
    },
  ];

  return (
    <Box
      component="section"
      className="SectionCard EngagementSection"
    >
      <Box className="SectionHeader">
        <Typography
          variant="h5"
          className="SectionTitle"
        >
          {t('metrics.engagement.title')}
        </Typography>
        <DateRangeControl
          range={range}
          onChange={setRange}
        />
      </Box>
      <Box className="EngagementBody">
        <Box className="EngagementTiles">
          <MetricTile
            label={t('metrics.engagement.avg_playtime')}
            tip={t('metrics.overview.tip.avg_playtime')}
          >
            {w ? formatMinutes(w.medianActiveTimeS) : '—'}
            {w && <DeltaChip pct={playtimeDelta} />}
          </MetricTile>
          <MetricTile
            label={t('metrics.engagement.avg_session')}
            tip={t('metrics.engagement.tip.avg_session')}
          >
            {w ? formatMinutes(w.avgSessionActiveTimeS) : '—'}
          </MetricTile>
          <MetricTile
            label={t('metrics.engagement.afk_time')}
            tip={t('metrics.overview.tip.afk_time')}
          >
            {w ? formatPercent(w.afkTimePct) : '—'}
          </MetricTile>
        </Box>
        <Box className="SocialChart">
          <Typography className="ChartTitle">{t('metrics.engagement.social')}</Typography>
          <Chart
            series={socialSeries}
            ariaLabel={t('metrics.engagement.social')}
            legend
          />
        </Box>
      </Box>
    </Box>
  );
}

function BackToList({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      className="BackButton"
      aria-label={t('metrics.header.back')}
      onClick={onBack}
    >
      <ChevronLeftIcon />
    </button>
  );
}

function NoSceneData({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Box className="AnalyticsHeader">
        <Box className="AnalyticsTitle">
          <BackToList onBack={onBack} />
          <Typography variant="h3">{t('metrics.header.title')}</Typography>
        </Box>
      </Box>
      <Box className="EmptyContainer">
        <Typography variant="h6">{t('metrics.no_scene_data.title')}</Typography>
        <Typography variant="body1">{t('metrics.no_scene_data.description')}</Typography>
      </Box>
    </>
  );
}

function SceneAnalytics({
  scene,
  project,
  asOf,
  onBack,
  onExportCsv,
}: {
  scene: SceneStats;
  project?: ManagedProject;
  asOf: string;
  onBack: () => void;
  onExportCsv: () => void;
}) {
  return (
    <>
      <Box className="AnalyticsHeader">
        <Box className="AnalyticsTitle">
          <BackToList onBack={onBack} />
          <Typography variant="h3">
            {t('metrics.scene.header', { name: sceneDisplayName(scene) })}
          </Typography>
        </Box>
        <Button
          className="ExportButton"
          color="secondary"
          variant="outlined"
          onClick={onExportCsv}
        >
          <FileDownloadIcon fontSize="inherit" />
          {t('metrics.scene.export')}
        </Button>
      </Box>
      <Box className="AnalyticsBody">
        <Box className="AnalyticsRail">
          <SceneCard
            scene={scene}
            project={project}
          />
        </Box>
        <Box className="AnalyticsColumns">
          <OverviewSection scene={scene} />
          <RetentionSection scene={scene} />
          <EngagementSection
            scene={scene}
            asOf={asOf}
          />
        </Box>
      </Box>
    </>
  );
}

export function MetricsPage() {
  const { isSignedIn, isSigningIn, signIn, wallet } = useAuth();
  const dispatch = useDispatch();
  const location = useLocation();
  const { scenes, asOf, status, error } = useSelector(state => state.metrics);
  const projects = useSelector(state => state.management.projects);
  const locationState = (location.state ?? {}) as LocationState;
  const [selectedKey, setSelectedKey] = useState<string | null>(
    locationState.sceneType && locationState.sceneId
      ? `${locationState.sceneType}:${locationState.sceneId}`
      : null,
  );

  useEffect(() => {
    void analytics.track('Metrics Viewed', {
      source: locationState.source ?? 'direct',
      scene_type: locationState.sceneType,
      scene_id: locationState.sceneId,
    });
  }, []);

  useEffect(() => {
    if (isSignedIn && wallet && status === 'idle') {
      dispatch(metricsActions.fetchCreatorScenesStats({ address: wallet }));
    }
  }, [isSignedIn, wallet, status, dispatch]);

  const activeScene = useMemo(
    () => (selectedKey ? scenes.find(scene => sceneKey(scene) === selectedKey) : undefined),
    [scenes, selectedKey],
  );

  const handleSelectScene = useCallback((scene: SceneStats) => {
    setSelectedKey(sceneKey(scene));
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedKey(null);
  }, []);

  const activeProject = useMemo(
    () =>
      activeScene
        ? projects.find(
            project =>
              project.id === activeScene.sceneId || project.displayName === activeScene.title,
          )
        : undefined,
    [projects, activeScene],
  );

  const handleRetry = useCallback(() => {
    if (wallet) dispatch(metricsActions.fetchCreatorScenesStats({ address: wallet }));
  }, [dispatch, wallet]);

  const handleExportCsv = useCallback(() => {
    if (!asOf || !activeScene) return;
    const csv = toCsv(buildCsvRows([activeScene], asOf, 90));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scope = activeScene.sceneId.replace(/[^a-z0-9.-]/gi, '_');
    link.download = `scene-metrics-${scope}-${asOf}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [activeScene, asOf]);

  const isLoading = status === 'idle' || status === 'loading';
  const showMainLoader = isLoading && !scenes.length;
  const inDrilldown = selectedKey !== null;

  const renderBody = () => {
    if (!isSignedIn && !isSigningIn) return <SignInCard onClickSignIn={signIn} />;
    if (showMainLoader) return <Loader size={70} />;
    if (status === 'failed') {
      return (
        <Box className="EmptyContainer">
          <Typography variant="h6">{t('metrics.error.title')}</Typography>
          {error && <Typography variant="body1">{error}</Typography>}
          <Button
            onClick={handleRetry}
            color="secondary"
          >
            {t('metrics.error.retry')}
          </Button>
        </Box>
      );
    }

    if (inDrilldown) {
      return activeScene && asOf ? (
        <SceneAnalytics
          scene={activeScene}
          project={activeProject}
          asOf={asOf}
          onBack={handleBackToList}
          onExportCsv={handleExportCsv}
        />
      ) : (
        <NoSceneData onBack={handleBackToList} />
      );
    }

    if (!scenes.length || !asOf) {
      return (
        <Box className="EmptyContainer">
          <Typography variant="h6">{t('metrics.empty.title')}</Typography>
          <Typography variant="body1">{t('metrics.empty.description')}</Typography>
        </Box>
      );
    }

    return (
      <ScenePortfolio
        scenes={scenes}
        onOpen={handleSelectScene}
      />
    );
  };

  return (
    <main className="MetricsPage">
      <Navbar active={NavbarItem.METRICS} />
      <Container>{renderBody()}</Container>
    </main>
  );
}
