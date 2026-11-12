import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { CreatorFundPlace } from '/shared/types/creator-fund';

import { analytics } from '#preload';
import { useDispatch, useSelector } from '#store';
import type { LocationMetrics } from '/@/lib/metricsApi';
import { actions, selectors } from '/@/modules/store/creatorFund';
import { formatCycleLabel } from '/@/modules/store/creatorFund/utils';
import { t } from '/@/modules/store/translation/utils';

import { MapPinIcon, NewPlayersIcon, PlaytimeIcon, RetentionIcon } from '../icons';

import {
  formatCount,
  formatRatio,
  formatTime,
  metricValue,
  placeLocation,
  placeTitle,
} from './format';
import { MyPlacesEmpty } from './MyPlacesEmpty';
import {
  Entry,
  List,
  Name,
  NameBlock,
  Panel,
  SceneData,
  Stats,
  StatsList,
  Thumbnail,
  Where,
  WhereText,
} from './MyPlacesTab.styled';
import { FilterBar, FilterGroup, FilterNote, FilterSentence } from './parts.styled';
import {
  CycleSelect,
  ListState,
  MetricStat,
  StatusChip,
  type ChipProps,
  type MetricReading,
} from './parts';
import { useWorldSceneCounts } from './useWorldSceneCounts';

const SECONDS_PER_MINUTE = 60;
const NO_CYCLE = 'current';

const chipOf = (place: CreatorFundPlace): ChipProps => {
  if (place.status === 'in_program' || place.status === 'eligible') return { status: 'in_program' };
  if (place.status === 'replaced') return { status: 'replaced' };
  return { status: 'not_eligible', reasons: place.reasons };
};

const hasStats = (place: CreatorFundPlace) =>
  place.status === 'in_program' || place.status === 'replaced';

const chipsInProgram = (place: CreatorFundPlace) => chipOf(place).status === 'in_program';

const inProgramFirst = (places: CreatorFundPlace[]) =>
  [...places].sort((a, b) => Number(chipsInProgram(b)) - Number(chipsInProgram(a)));

type PlaceMetricsReading =
  | { status: 'loading' }
  | { status: 'ready'; metrics: LocationMetrics | undefined };

function PlaceStats({ reading, locale }: { reading: PlaceMetricsReading; locale: string }) {
  const stat = (name: string, format: (value: number) => string): MetricReading => {
    if (reading.status === 'loading') return reading;
    const value = metricValue(reading.metrics, name);
    return { status: 'ready', value: value === null ? null : format(value) };
  };
  return (
    <Stats>
      <StatsList>
        <MetricStat
          icon={<NewPlayersIcon />}
          label={t('earn.joined.my_places.metrics.new_players')}
          info={{
            name: t('earn.joined.my_places.metrics.new_players_info_label'),
            tooltip: t('earn.joined.my_places.metrics.new_players_info'),
          }}
          reading={stat('new_decentraland_players_30d', value => formatCount(value, locale))}
        />
        <MetricStat
          icon={<RetentionIcon />}
          label={t('earn.joined.my_places.metrics.d3_retention')}
          info={{
            name: t('earn.joined.my_places.metrics.d3_retention_info_label'),
            tooltip: t('analytics.metrics.day_3_retention.tooltip'),
          }}
          reading={stat('d3_retention_rate_30d', value => formatRatio(value, locale))}
        />
        <MetricStat
          icon={<PlaytimeIcon />}
          label={t('earn.joined.my_places.metrics.playtime')}
          info={{
            name: t('earn.joined.my_places.metrics.playtime_info_label'),
            tooltip: t('earn.joined.my_places.metrics.playtime_info'),
          }}
          reading={stat('avg_playtime_seconds_30d', value =>
            t('earn.joined.my_places.metrics.minutes', {
              value: formatCount(value / SECONDS_PER_MINUTE, locale),
            }),
          )}
        />
      </StatsList>
    </Stats>
  );
}

function PlaceEntry({
  place,
  scenesInWorld,
  children,
}: {
  place: CreatorFundPlace;
  scenesInWorld?: number;
  children?: React.ReactNode;
}) {
  const nameId = useId();
  return (
    <Entry aria-labelledby={nameId}>
      <Thumbnail
        src={place.image ?? undefined}
        alt=""
        width={206}
        height={116}
        loading="lazy"
      />
      <SceneData>
        <NameBlock>
          <Name
            id={nameId}
            title={placeTitle(place)}
          >
            {placeTitle(place)}
          </Name>
          <Where>
            <MapPinIcon />
            <WhereText title={placeLocation(place, scenesInWorld)}>
              {placeLocation(place, scenesInWorld)}
            </WhereText>
          </Where>
        </NameBlock>
        <StatusChip {...chipOf(place)} />
      </SceneData>
      {children}
    </Entry>
  );
}

function FirstSteps() {
  const { projects, status } = useSelector(state => state.workspace);
  if (status === 'idle' || status === 'loading') return <ListState kind="loading" />;
  return projects.length ? (
    <MyPlacesEmpty
      variant="unpublished"
      projects={projects}
    />
  ) : (
    <MyPlacesEmpty variant="no_scenes" />
  );
}

/** The user's places in the Creator Fund and how each performed in the selected cycle. */
export function MyPlacesTab() {
  const dispatch = useDispatch();
  const locale = useSelector(state => state.translation.locale);
  const cycles = useSelector(state => state.creatorFund.cycles);
  const myCycles = useSelector(selectors.getMyPlacesCycles);
  const defaultCycle = useSelector(selectors.getDefaultPlacesCycle);
  const sortedCycles = useSelector(selectors.getSortedCycles);
  const places = useSelector(state => state.creatorFund.places);
  const placeMetrics = useSelector(state => state.creatorFund.placeMetrics);
  const [chosen, setChosen] = useState<number | null>(null);
  const sentenceId = useId();
  const selected = chosen ?? defaultCycle?.id ?? null;
  const preLaunch = selected === null && sortedCycles.some(cycle => cycle.status === 'upcoming');
  const [placesLoaded, setPlacesLoaded] = useState(() => places.status === 'succeeded');
  const [metricsLoaded, setMetricsLoaded] = useState(() => placeMetrics.status === 'succeeded');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (cycles.status === 'idle') void dispatch(actions.fetchCycles());
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadPlaces = useCallback(() => {
    if (selected === null && !preLaunch) return;
    void dispatch(actions.fetchPlaces(selected ?? undefined)).then(
      () => mounted.current && setPlacesLoaded(true),
    );
  }, [dispatch, selected, preLaunch]);
  useEffect(loadPlaces, [loadPlaces]);

  const retryPlaces = () => {
    setPlacesLoaded(false);
    loadPlaces();
  };

  const placesFailed = placesLoaded && places.status === 'failed';
  const shown =
    placesLoaded &&
    !placesFailed &&
    places.data &&
    (preLaunch || places.data.cycle?.id === selected)
      ? places.data
      : null;

  const running = shown?.cycle?.status === 'running';

  useEffect(() => {
    if (!running || !shown?.places.length) return;
    void dispatch(actions.fetchPlaceMetrics(shown.places)).then(
      () => mounted.current && setMetricsLoaded(true),
    );
  }, [running, shown, dispatch]);

  const cachedMetrics = placeMetrics.data;
  const metricsCoverShown =
    !!shown && !!cachedMetrics && shown.places.every(place => place.id in cachedMetrics.byPlaceId);
  const metricsFailed = metricsLoaded && placeMetrics.status === 'failed';
  const metricsPending = !metricsLoaded || (!metricsFailed && !metricsCoverShown);
  const metrics = running && !metricsPending && !metricsFailed ? placeMetrics.data : null;

  const sceneCounts = useWorldSceneCounts(shown?.places ?? []);

  const options = useMemo(
    () =>
      myCycles.length
        ? myCycles.map(cycle => ({
            value: String(cycle.id),
            label:
              cycle.status === 'running'
                ? t('earn.joined.filter.current_cycle')
                : formatCycleLabel(cycle, locale),
          }))
        : [{ value: NO_CYCLE, label: t('earn.joined.filter.current_cycle') }],
    [myCycles, locale],
  );

  const hasClosedCycle = sortedCycles.some(cycle => cycle.status === 'closed');
  const firstSteps =
    (cycles.status === 'succeeded' && selected === null && !preLaunch) ||
    (!!shown && shown.places.length === 0 && shown.cycle?.status !== 'closed');

  let body: React.ReactNode;
  if (cycles.status === 'failed') {
    body = (
      <ListState
        kind="error"
        message={t('earn.joined.my_places.error')}
        onRetry={() => void dispatch(actions.fetchCycles())}
      />
    );
  } else if (firstSteps) {
    body = <FirstSteps />;
  } else if (!shown) {
    body = placesFailed ? (
      <ListState
        kind="error"
        message={t('earn.joined.my_places.error')}
        onRetry={retryPlaces}
      />
    ) : (
      <ListState kind="loading" />
    );
  } else if (shown.places.length === 0) {
    body = (
      <ListState
        kind="empty"
        message={t('earn.joined.my_places.empty_closed_cycle')}
      />
    );
  } else {
    body = (
      <List>
        {inProgramFirst(shown.places).map(place => (
          <PlaceEntry
            key={place.id}
            place={place}
            scenesInWorld={sceneCounts[place.world_name ?? '']}
          >
            {running && hasStats(place) && (
              <PlaceStats
                reading={
                  metricsPending
                    ? { status: 'loading' }
                    : { status: 'ready', metrics: metrics?.byPlaceId[place.id] }
                }
                locale={locale}
              />
            )}
          </PlaceEntry>
        ))}
      </List>
    );
  }

  return (
    <Panel>
      {(!firstSteps || hasClosedCycle) && (
        <FilterBar
          role="toolbar"
          aria-labelledby={sentenceId}
        >
          <FilterSentence id={sentenceId}>{t('earn.joined.my_places.sentence')}</FilterSentence>
          <FilterGroup>
            {running && !!shown?.places.length && metrics && (
              <FilterNote>
                {t('earn.joined.my_places.last_update', {
                  time: formatTime(metrics.exported_at, locale),
                })}
              </FilterNote>
            )}
            {cycles.status === 'succeeded' && (
              <CycleSelect
                value={selected === null ? NO_CYCLE : String(selected)}
                options={options}
                onChange={value => {
                  if (value === NO_CYCLE) return;
                  void analytics.track('Creator Fund Cycle Changed', {
                    tab: 'my_places',
                    cycle_id: Number(value),
                  });
                  setChosen(Number(value));
                }}
              />
            )}
          </FilterGroup>
        </FilterBar>
      )}
      {body}
    </Panel>
  );
}
