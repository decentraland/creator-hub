import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { LeaderboardCycle, LeaderboardEntry } from '/shared/types/creator-fund';

import { analytics } from '#preload';
import { useDispatch, useSelector } from '#store';
import { actions, selectors } from '/@/modules/store/creatorFund';
import { formatCycleLabel } from '/@/modules/store/creatorFund/utils';
import { t } from '/@/modules/store/translation/utils';

import { VisuallyHidden } from '../EarnModal.styled';
import { MapPinIcon } from '../icons';

import { FilterBar, FilterSentence } from './parts.styled';
import { CycleSelect, JumpInButton, ListState } from './parts';
import { formatUsdc, placeLocation, placeTitle } from './format';
import { GetReady } from './GetReady';
import { useWorldSceneCounts } from './useWorldSceneCounts';
import {
  Body,
  Earned,
  Head,
  HeaderCell,
  HeaderRow,
  Medal,
  News,
  Panel,
  PlaceCell,
  PlaceName,
  PlaceText,
  PlaceWhere,
  PlaceWhereText,
  Places,
  Rank,
  Row,
  Scrolldown,
  Table,
  Thumbnail,
  Toolbar,
} from './LeaderboardTab.styled';
import { SNAPSHOT_BANNER_ENABLED, SnapshotBanner } from './SnapshotBanner';

const MEDALS = ['🥇', '🥈', '🥉'];
const NEWS_SHOWN = 4;

function LeaderboardRow({
  entry,
  locale,
  scenesInWorld,
}: {
  entry: LeaderboardEntry;
  locale: string;
  scenesInWorld?: number;
}) {
  return (
    <Row role="row">
      <Rank role="cell">
        {entry.rank <= MEDALS.length ? (
          <Medal
            role="img"
            aria-label={t('earn.joined.leaderboard.rank_label', { rank: entry.rank })}
          >
            {MEDALS[entry.rank - 1]}
          </Medal>
        ) : (
          entry.rank
        )}
      </Rank>
      <PlaceCell role="cell">
        <Thumbnail
          src={entry.place.image ?? undefined}
          alt=""
          width={89}
          height={50}
          loading="lazy"
        />
        <PlaceText>
          <PlaceName title={placeTitle(entry.place)}>{placeTitle(entry.place)}</PlaceName>
          <PlaceWhere>
            <MapPinIcon />
            <PlaceWhereText title={placeLocation(entry.place, scenesInWorld)}>
              {placeLocation(entry.place, scenesInWorld)}
            </PlaceWhereText>
          </PlaceWhere>
        </PlaceText>
      </PlaceCell>
      <Earned role="cell">
        {t('earn.joined.leaderboard.amount', { amount: formatUsdc(entry.earned_usdc, locale) })}
      </Earned>
      <span
        role="cell"
        className="JumpInCell"
      >
        <JumpInButton
          place={entry.place}
          scenesInWorld={scenesInWorld}
          onJumpIn={() =>
            void analytics.track('Creator Fund Jump In', {
              rank: entry.rank,
              place_id: entry.place.id,
            })
          }
        />
      </span>
    </Row>
  );
}

const STUCK_HEAD_HEIGHT = 66;

/**
 * Tracks the sticky toolbar's height for the stuck table head, and publishes the toolbar and head
 * as `--cf-sticky-extra` on the root so focus scrolling keeps controls below them.
 */
function useToolbarHeight() {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const placesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const places = placesRef.current;
    if (!toolbar || !places) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      places.style.setProperty('--cf-toolbar-h', `${toolbar.offsetHeight}px`);
      root.style.setProperty('--cf-sticky-extra', `${toolbar.offsetHeight + STUCK_HEAD_HEIGHT}px`);
    });
    observer.observe(toolbar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cf-sticky-extra');
    };
  });
  return { toolbarRef, placesRef };
}

/** The Creator Fund leaderboard: the top 20 places of a closed cycle, or of all cycles. */
export function LeaderboardTab() {
  const dispatch = useDispatch();
  const locale = useSelector(state => state.translation.locale);
  const cycles = useSelector(state => state.creatorFund.cycles);
  const board = useSelector(state => state.creatorFund.leaderboard);
  const news = useSelector(state => state.creatorFund.news);
  const banner = useSelector(state => state.creatorFund.banner);
  const sortedCycles = useSelector(selectors.getSortedCycles);
  const latestClosed = useSelector(selectors.getLatestClosedCycle);
  const sentenceId = useId();
  const { toolbarRef, placesRef } = useToolbarHeight();
  const sceneCounts = useWorldSceneCounts(board.data?.entries.map(entry => entry.place) ?? []);
  const [chosen, setChosen] = useState<LeaderboardCycle | null>(null);
  const selected: LeaderboardCycle | null = chosen ?? latestClosed?.id ?? null;
  const [boardLoaded, setBoardLoaded] = useState(() => board.status === 'succeeded');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cycles.status === 'idle') void dispatch(actions.fetchCycles());
    if (news.status === 'idle') void dispatch(actions.fetchNews());
    if (SNAPSHOT_BANNER_ENABLED && banner.status === 'idle') void dispatch(actions.fetchBanner());
  }, []);

  const loadBoard = useCallback(() => {
    if (selected === null) return;
    void dispatch(actions.fetchLeaderboard(selected)).then(
      () => mounted.current && setBoardLoaded(true),
    );
  }, [dispatch, selected]);
  useEffect(loadBoard, [loadBoard]);

  const retryBoard = () => {
    setBoardLoaded(false);
    loadBoard();
  };

  const options = useMemo(
    () => [
      ...sortedCycles
        .filter(cycle => cycle.status === 'closed')
        .map(cycle => ({ value: String(cycle.id), label: formatCycleLabel(cycle, locale) })),
      { value: 'all', label: t('earn.joined.filter.all_cycles') },
    ],
    [sortedCycles, locale],
  );

  if (cycles.status === 'failed') {
    return (
      <ListState
        kind="error"
        message={t('earn.joined.leaderboard.error')}
        onRetry={() => void dispatch(actions.fetchCycles())}
      />
    );
  }
  if (cycles.status !== 'succeeded' || selected === null) {
    return cycles.status === 'succeeded' ? <GetReady /> : <ListState kind="loading" />;
  }

  const boardFailed = boardLoaded && board.status === 'failed';
  const shown =
    boardLoaded && !boardFailed && board.data && board.data.cycle_id === selected
      ? board.data
      : null;
  let state: React.ReactNode = null;
  if (boardFailed) {
    state = (
      <ListState
        kind="error"
        message={t('earn.joined.leaderboard.error')}
        onRetry={retryBoard}
      />
    );
  } else if (!shown) {
    state = <ListState kind="loading" />;
  } else if (shown.entries.length === 0) {
    state = (
      <ListState
        kind="empty"
        message={t('earn.joined.leaderboard.empty')}
      />
    );
  }
  const rows = shown?.entries ?? [];
  const newsItems = news.status === 'succeeded' ? (news.data?.news.slice(0, NEWS_SHOWN) ?? []) : [];

  return (
    <Panel>
      {SNAPSHOT_BANNER_ENABLED && banner.status === 'succeeded' && banner.data?.markdown && (
        <SnapshotBanner markdown={banner.data.markdown} />
      )}
      <Scrolldown>
        <Places ref={placesRef}>
          <Toolbar
            ref={toolbarRef}
            role="toolbar"
            aria-labelledby={sentenceId}
          >
            <FilterBar>
              <FilterSentence id={sentenceId}>
                {t(
                  selected === 'all'
                    ? 'earn.joined.leaderboard.sentence_all'
                    : 'earn.joined.leaderboard.sentence',
                )}
              </FilterSentence>
              <CycleSelect
                value={String(selected)}
                options={options}
                onChange={value => {
                  const cycleId = value === 'all' ? 'all' : Number(value);
                  void analytics.track('Creator Fund Cycle Changed', {
                    tab: 'leaderboard',
                    cycle_id: cycleId,
                  });
                  setChosen(cycleId);
                }}
              />
            </FilterBar>
          </Toolbar>
          <Table
            role="table"
            aria-labelledby={sentenceId}
          >
            <Head role="rowgroup">
              <HeaderRow role="row">
                <HeaderCell role="columnheader">{t('earn.joined.leaderboard.rank')}</HeaderCell>
                <HeaderCell role="columnheader">{t('earn.joined.leaderboard.place')}</HeaderCell>
                <HeaderCell role="columnheader">{t('earn.joined.leaderboard.earned')}</HeaderCell>
                <HeaderCell role="columnheader">
                  <VisuallyHidden>{t('earn.joined.leaderboard.jump_in')}</VisuallyHidden>
                </HeaderCell>
              </HeaderRow>
            </Head>
            <Body role="rowgroup">
              {rows.map(entry => (
                <LeaderboardRow
                  key={entry.place.id}
                  entry={entry}
                  locale={locale}
                  scenesInWorld={sceneCounts[entry.place.world_name ?? '']}
                />
              ))}
            </Body>
          </Table>
          {state}
        </Places>
        {newsItems.length > 0 && <News items={newsItems} />}
      </Scrolldown>
    </Panel>
  );
}
