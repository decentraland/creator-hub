import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import type { CreatorFundPlace } from '/shared/types/creator-fund';

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
import { CycleSelect, ListState, MetricStat, StatusChip, type ChipProps } from './parts';
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

function PlaceStats({ metrics, locale }: { metrics: LocationMetrics | undefined; locale: string }) {
  const stat = (name: string, format: (value: number) => string) => {
    const value = metricValue(metrics, name);
    return value === null ? null : format(value);
  };
  return (
    <Stats>
      <StatsList>
        <MetricStat
          icon={<NewPlayersIcon />}
          label={t('earn.joined.my_places.metrics.new_players')}
          value={stat('new_decentraland_players_30d', value => formatCount(value, locale))}
        />
        <MetricStat
          icon={<RetentionIcon />}
          label={t('earn.joined.my_places.metrics.d3_retention')}
          value={stat('d3_retention_rate_30d', value => formatRatio(value, locale))}
        />
        <MetricStat
          icon={<PlaytimeIcon />}
          label={t('earn.joined.my_places.metrics.playtime')}
          value={stat('avg_playtime_seconds_30d', value =>
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

  useEffect(() => {
    if (cycles.status === 'idle') void dispatch(actions.fetchCycles());
  }, []);

  const loadPlaces = useCallback(() => {
    if (selected !== null) void dispatch(actions.fetchPlaces(selected));
    else if (preLaunch) void dispatch(actions.fetchPlaces(undefined));
  }, [dispatch, selected, preLaunch]);
  useEffect(loadPlaces, [loadPlaces]);

  const shown =
    places.data && (preLaunch || places.data.cycle?.id === selected) ? places.data : null;

  const running = shown?.cycle?.status === 'running';

  useEffect(() => {
    if (running && shown?.places.length) void dispatch(actions.fetchPlaceMetrics(shown.places));
  }, [running, shown, dispatch]);

  const metrics = running && placeMetrics.status === 'succeeded' ? placeMetrics.data : null;

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

  let body: React.ReactNode;
  if (cycles.status === 'failed') {
    body = (
      <ListState
        kind="error"
        message={t('earn.joined.my_places.error')}
        onRetry={() => void dispatch(actions.fetchCycles())}
      />
    );
  } else if (cycles.status === 'succeeded' && selected === null && !preLaunch) {
    body = (
      <ListState
        kind="empty"
        message={t('earn.joined.my_places.empty')}
      />
    );
  } else if (!shown || places.status === 'failed') {
    body =
      places.status === 'failed' ? (
        <ListState
          kind="error"
          message={t('earn.joined.my_places.error')}
          onRetry={loadPlaces}
        />
      ) : (
        <ListState kind="loading" />
      );
  } else if (shown.places.length === 0) {
    body = (
      <ListState
        kind="empty"
        message={t('earn.joined.my_places.empty')}
      />
    );
  } else {
    body = (
      <List>
        {shown.places.map(place => (
          <PlaceEntry
            key={place.id}
            place={place}
            scenesInWorld={sceneCounts[place.world_name ?? '']}
          >
            {running && hasStats(place) && (
              <PlaceStats
                metrics={metrics?.byPlaceId[place.id]}
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
              onChange={value => value !== NO_CYCLE && setChosen(Number(value))}
            />
          )}
        </FilterGroup>
      </FilterBar>
      {body}
    </Panel>
  );
}
