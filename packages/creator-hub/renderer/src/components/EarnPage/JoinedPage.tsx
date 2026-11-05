import { useId } from 'react';
import { Tab } from 'decentraland-ui2';

import { useSelector } from '#store';
import { selectors } from '/@/modules/store/creatorFund';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { EarnHeader } from './joined/EarnHeader';
import { LeaderboardTab } from './joined/LeaderboardTab';
import { Page, SectionTabs, TabPanel } from './JoinedPage.styled';

export type JoinedTab = 'leaderboard' | 'my_places';

const TABS: { id: JoinedTab; label: TranslationPath }[] = [
  { id: 'leaderboard', label: 'earn.joined.tabs.leaderboard' },
  { id: 'my_places', label: 'earn.joined.tabs.my_places' },
];

/** The Creator Fund page for a joined user: the Leaderboard and My Places tabs. */
export function JoinedPage({
  tab,
  onTabChange,
}: {
  tab: JoinedTab;
  onTabChange: (tab: JoinedTab) => void;
}) {
  const id = useId();
  const gettingReady = useSelector(
    state =>
      tab === 'leaderboard' &&
      state.creatorFund.cycles.status === 'succeeded' &&
      !selectors.getLatestClosedCycle(state),
  );
  return (
    <Page bottom={gettingReady ? 'flush' : 'padded'}>
      <EarnHeader />
      <SectionTabs
        value={tab}
        onChange={(_, value: JoinedTab) => onTabChange(value)}
        aria-label={t('earn.joined.sections')}
      >
        {TABS.map(({ id: tabId, label }) => (
          <Tab
            key={tabId}
            value={tabId}
            label={t(label)}
            id={`${id}-${tabId}`}
            aria-controls={`${id}-panel`}
            disableRipple
          />
        ))}
      </SectionTabs>
      <TabPanel
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${tab}`}
      >
        {tab === 'leaderboard' ? <LeaderboardTab /> : null}
      </TabPanel>
    </Page>
  );
}
