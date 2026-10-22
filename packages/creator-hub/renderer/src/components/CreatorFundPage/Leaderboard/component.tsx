import { type ReactNode, type SyntheticEvent, useCallback, useEffect, useState } from 'react';
import cx from 'classnames';
import {
  Box,
  Chip,
  MenuItem,
  type SelectChangeEvent,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useCreatorFund } from '/@/hooks/useCreatorFund';
import type { LeaderboardCreator, LeaderboardScene } from '/@/lib/creatorFund';
import { CLOSED_CYCLES, PROGRAM } from '/@/lib/creatorFund';
import { actions, selectors } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';

import { Button } from '../../Button';
import { Loader } from '../../Loader';
import { Select } from '../../Select';
import { formatCycleRange, formatUsdc, shortAddress } from '../../CreatorFund/utils';

import './styles.css';

type Board = 'creators' | 'scenes';

/** The podium gets the accent; everyone else reads in plain ink. */
const PODIUM = 3;

type Props = {
  /** Opens the join flow, for a creator who isn't on any board yet. */
  onJoin: () => void;
};

function Rank({ rank }: { rank: number }) {
  return <span className={cx('Rank', { Podium: rank <= PODIUM })}>#{rank}</span>;
}

function CreatorName({ creator, isMe }: { creator: LeaderboardCreator; isMe: boolean }) {
  const { avatar } = useAuth();
  const name = isMe ? (avatar?.name ?? creator.name) : creator.name;
  return (
    <Box className="CreatorName">
      <Box className="NameLine">
        <Typography variant="body2">{name ?? shortAddress(creator.address)}</Typography>
        {isMe && (
          <Chip
            size="small"
            label={t('creator_fund.leaderboard.you')}
            className="YouChip"
          />
        )}
      </Box>
      {name && (
        <Typography
          variant="caption"
          className="Address"
        >
          {shortAddress(creator.address)}
        </Typography>
      )}
    </Box>
  );
}

function CreatorRow({ creator, isMe }: { creator: LeaderboardCreator; isMe: boolean }) {
  return (
    <TableRow className={cx({ Me: isMe })}>
      <TableCell>
        <Rank rank={creator.rank} />
      </TableCell>
      <TableCell>
        <CreatorName
          creator={creator}
          isMe={isMe}
        />
      </TableCell>
      <TableCell>{creator.paid_places}</TableCell>
      <TableCell
        align="right"
        className="Amount"
      >
        {formatUsdc(creator.amount_usdc)}
      </TableCell>
    </TableRow>
  );
}

function SceneRow({ scene }: { scene: LeaderboardScene }) {
  return (
    <TableRow>
      <TableCell>
        <Rank rank={scene.rank} />
      </TableCell>
      <TableCell>
        <Box className="SceneName">
          <img
            className="Thumbnail"
            src={FallbackThumbnail}
            alt=""
          />
          <Box>
            <Typography variant="body2">{scene.title}</Typography>
            <Typography
              variant="caption"
              className="Address"
            >
              {scene.world_name ??
                t('creator_fund.leaderboard.genesis_city', { coords: scene.base_position })}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell className="Owner">{scene.owner_name ?? shortAddress(scene.owner)}</TableCell>
      <TableCell
        align="right"
        className="Amount"
      >
        {formatUsdc(scene.amount_usdc)}
      </TableCell>
    </TableRow>
  );
}

/** A full-width row under the board, for the asking creator when they aren't on it. */
function NoteRow({ children }: { children: ReactNode }) {
  return (
    <TableRow className="Note">
      <TableCell colSpan={4}>{children}</TableCell>
    </TableRow>
  );
}

/**
 * The public top 20 of a closed cycle, for creators and for scenes.
 *
 * Only the rank and the amount paid are shown: the fund keeps scene metrics
 * private to their owner. The asking creator sees their own row too — in place
 * when they made the top 20, pinned under it when they didn't.
 */
export function Leaderboard({ onJoin }: Props) {
  const { wallet, isSignedIn, isEnrolled, isLoaded } = useCreatorFund();
  const dispatch = useDispatch();
  const [board, setBoard] = useState<Board>('creators');
  const [cycleId, setCycleId] = useState(CLOSED_CYCLES[0]?.id ?? '');
  // Only a member has a standing; asking for anyone else's would leak nothing, but means nothing.
  const address = isEnrolled ? wallet : undefined;
  const leaderboard = useSelector(state => selectors.getLeaderboard(state, cycleId, address));
  const status = useSelector(state => state.creatorFund.leaderboardStatus);

  useEffect(() => {
    if (!cycleId || leaderboard || (isSignedIn && !isLoaded)) return;
    dispatch(actions.fetchLeaderboard({ cycleId, address }));
  }, [cycleId, address, leaderboard, isSignedIn, isLoaded]);

  const handleBoardChange = useCallback((_e: SyntheticEvent, value: Board) => setBoard(value), []);
  const handleCycleChange = useCallback(
    (e: SelectChangeEvent<string>) => setCycleId(e.target.value),
    [],
  );

  const me = leaderboard?.me ?? null;
  const meIsBelow = !!me && me.rank > PROGRAM.leaderboardSize;

  return (
    <Box className="Leaderboard">
      <Box className="LeaderboardHeader">
        <Box>
          <Typography variant="h5">{t('creator_fund.leaderboard.title')}</Typography>
          <Typography
            variant="body2"
            className="Muted"
          >
            {t('creator_fund.leaderboard.description', { count: PROGRAM.leaderboardSize })}
          </Typography>
        </Box>
      </Box>
      <Box className="LeaderboardBar">
        <Tabs
          value={board}
          onChange={handleBoardChange}
        >
          <Tab
            value="creators"
            label={t('creator_fund.leaderboard.tabs.creators')}
          />
          <Tab
            value="scenes"
            label={t('creator_fund.leaderboard.tabs.scenes')}
          />
        </Tabs>
        <Box className="CyclePicker">
          <Typography variant="body1">{t('creator_fund.leaderboard.cycle')}</Typography>
          <Select
            value={cycleId}
            onChange={handleCycleChange}
          >
            {CLOSED_CYCLES.map(cycle => (
              <MenuItem
                key={cycle.id}
                value={cycle.id}
              >
                {formatCycleRange(cycle.start_date, cycle.end_date)}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {!leaderboard ? (
        status === 'failed' ? (
          <Typography
            variant="body2"
            className="Muted"
          >
            {t('creator_fund.leaderboard.error')}
          </Typography>
        ) : (
          <Loader size={40} />
        )
      ) : (
        <>
          <Table className="LeaderboardTable">
            <TableHead>
              <TableRow>
                <TableCell>{t('creator_fund.leaderboard.columns.rank')}</TableCell>
                <TableCell>
                  {board === 'creators'
                    ? t('creator_fund.leaderboard.columns.creator')
                    : t('creator_fund.leaderboard.columns.scene')}
                </TableCell>
                <TableCell>
                  {board === 'creators'
                    ? t('creator_fund.leaderboard.columns.paid_scenes')
                    : t('creator_fund.leaderboard.columns.creator')}
                </TableCell>
                <TableCell align="right">{t('creator_fund.leaderboard.columns.paid')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {board === 'creators' ? (
                <>
                  {leaderboard.creators.map(creator => (
                    <CreatorRow
                      key={creator.rank}
                      creator={creator}
                      isMe={!!me && creator.address === me.address}
                    />
                  ))}
                  {meIsBelow && (
                    <>
                      <TableRow
                        className="Gap"
                        aria-hidden
                      >
                        <TableCell colSpan={4}>⋯</TableCell>
                      </TableRow>
                      <CreatorRow
                        creator={me}
                        isMe
                      />
                    </>
                  )}
                  {isSignedIn && isLoaded && !isEnrolled && (
                    <NoteRow>
                      <Box className="NoteContent">
                        <Typography variant="body2">
                          {t('creator_fund.leaderboard.join_hint')}
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={onJoin}
                        >
                          {t('creator_fund.page.join')}
                        </Button>
                      </Box>
                    </NoteRow>
                  )}
                  {isEnrolled && !me && (
                    <NoteRow>
                      <Typography variant="body2">
                        {t('creator_fund.leaderboard.not_paid')}
                      </Typography>
                    </NoteRow>
                  )}
                </>
              ) : (
                leaderboard.scenes.map(scene => (
                  <SceneRow
                    key={scene.rank}
                    scene={scene}
                  />
                ))
              )}
            </TableBody>
          </Table>
          <Typography
            variant="caption"
            className="Muted"
          >
            {t('creator_fund.leaderboard.footer', {
              creators: leaderboard.paid_creators,
              scenes: leaderboard.paid_places,
            })}
          </Typography>
        </>
      )}
    </Box>
  );
}
