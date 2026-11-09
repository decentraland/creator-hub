import { useId } from 'react';
import { Tab } from 'decentraland-ui2';

import { analytics } from '#preload';
import { useSelector } from '#store';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { selectors } from '/@/modules/store/creatorFund';
import { FeatureFlag } from '/@/modules/store/featureFlags';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { EarnHeader } from './joined/EarnHeader';
import { LeaderboardTab } from './joined/LeaderboardTab';
import { MyPlacesTab } from './joined/MyPlacesTab';
import { PayoutsLocked } from './joined/PayoutsLocked';
import { PayoutsTab } from './joined/PayoutsTab';
import { GradientDefs, Page, SectionTabs, TabPanel } from './JoinedPage.styled';

export type JoinedTab = 'leaderboard' | 'my_places' | 'payouts';

const TABS: { id: JoinedTab; label: TranslationPath }[] = [
  { id: 'leaderboard', label: 'earn.joined.tabs.leaderboard' },
  { id: 'my_places', label: 'earn.joined.tabs.my_places' },
  { id: 'payouts', label: 'earn.joined.tabs.payouts' },
];

const PANELS: Record<JoinedTab, (payoutEnabled: boolean) => React.ReactNode> = {
  leaderboard: () => <LeaderboardTab />,
  my_places: () => <MyPlacesTab />,
  payouts: payoutEnabled => (payoutEnabled ? <PayoutsTab /> : <PayoutsLocked />),
};

/** The Creator Fund page for a joined user: the Leaderboard, My Places and Payouts tabs. */
export function JoinedPage({
  tab,
  onTabChange,
}: {
  tab: JoinedTab;
  onTabChange: (tab: JoinedTab) => void;
}) {
  const id = useId();
  const payoutEnabled = useFeatureFlags().isEnabled(FeatureFlag.CREATOR_FUND_PAYOUT);
  const hasClosedCycle = useSelector(state => !!selectors.getLatestClosedCycle(state));
  const fillsWindow = useSelector(state =>
    tab === 'leaderboard'
      ? state.creatorFund.cycles.status === 'succeeded' && !selectors.getLatestClosedCycle(state)
      : tab === 'payouts' &&
        (!payoutEnabled || state.creatorFund.payouts.data?.payouts.length === 0),
  );
  return (
    <Page bottom={fillsWindow ? 'flush' : 'padded'}>
      <GradientDefs aria-hidden>
        <defs>
          <linearGradient
            id="cf-cerise"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0"
              stopColor="var(--primary)"
            />
            <stop
              offset="1"
              stopColor="var(--lavender)"
            />
          </linearGradient>
        </defs>
      </GradientDefs>
      <EarnHeader />
      <SectionTabs
        value={tab}
        onChange={(_, value: JoinedTab) => {
          void analytics.track('Creator Fund Tab Viewed', {
            tab: value === 'leaderboard' && !hasClosedCycle ? 'home' : value,
          });
          onTabChange(value);
        }}
        aria-label={t('earn.joined.sections')}
      >
        {TABS.map(({ id: tabId, label }) => (
          <Tab
            key={tabId}
            value={tabId}
            label={t(tabId === 'leaderboard' && !hasClosedCycle ? 'earn.joined.tabs.home' : label)}
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
        {PANELS[tab](payoutEnabled)}
      </TabPanel>
    </Page>
  );
}
