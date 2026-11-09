import { useEffect } from 'react';

import { useDispatch, useSelector } from '#store';
import { actions, selectors } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { ListState } from './parts';
import { GetReady } from './GetReady';

/** The Creator Fund leaderboard tab: Get ready until a cycle has closed. */
export function LeaderboardTab() {
  const dispatch = useDispatch();
  const cycles = useSelector(state => state.creatorFund.cycles);
  const latestClosed = useSelector(selectors.getLatestClosedCycle);

  useEffect(() => {
    if (cycles.status === 'idle') void dispatch(actions.fetchCycles());
  }, []);

  if (cycles.status === 'failed') {
    return (
      <ListState
        kind="error"
        message={t('earn.joined.leaderboard.error')}
        onRetry={() => void dispatch(actions.fetchCycles())}
      />
    );
  }
  if (cycles.status !== 'succeeded') return <ListState kind="loading" />;
  return latestClosed ? null : <GetReady />;
}
