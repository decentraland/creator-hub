import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import { useDispatch } from '#store';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { actions } from '/@/modules/store/creatorFund';
import { FeatureFlag, fetchFeatureFlags } from '/@/modules/store/featureFlags';
import * as api from '/@/lib/creatorFundApi';

import { tracked } from '../../../tests/utils/analytics';
import { createTestStore } from '../../../tests/utils/testStore';
import { CYCLES, LAUNCH_CYCLES, LAUNCH_VARIANT, ok } from './joined/fixtures';
import { JoinedPage, type JoinedTab } from './JoinedPage';

vi.mock('/@/lib/creatorFundApi', () => ({
  getEnrollment: vi.fn(),
  getTerms: vi.fn(),
  getCycles: vi.fn(),
  getPayouts: vi.fn(),
  getPayoutWallet: vi.fn(),
}));
vi.mock('./joined/LeaderboardTab', () => ({ LeaderboardTab: () => <p>leaderboard panel</p> }));
vi.mock('./joined/MyPlacesTab', () => ({ MyPlacesTab: () => <p>my places panel</p> }));
vi.mock('./joined/PayoutsTab', () => ({
  PayoutsTab: () => {
    const dispatch = useDispatch();
    useEffect(() => {
      void dispatch(actions.fetchPayouts());
      void dispatch(actions.fetchPayoutWallet());
    }, [dispatch]);
    return <p>payouts panel</p>;
  },
}));
vi.mock('../Modals', async importOriginal => ({
  ...((await importOriginal()) as object),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

const PAYOUTS_LOCKED = 'Payout Wallet setup unlocks November 25th';

const JOINED = {
  status: 'active' as const,
  enrolled_at: '2026-10-30T14:02:11Z',
  terms_version: 1,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
};

async function renderPage(
  tab: JoinedTab = 'leaderboard',
  { awaitCycles = true, payout = true, variants = {} } = {},
) {
  const store = createTestStore();
  store.dispatch(
    fetchFeatureFlags.fulfilled(
      { flags: { [FeatureFlag.CREATOR_FUND_PAYOUT]: payout }, variants },
      '',
    ),
  );
  await act(async () => {
    await store.dispatch(actions.fetchEnrollment());
    const cycles = store.dispatch(actions.fetchCycles());
    if (awaitCycles) await cycles;
  });
  const onTabChange = vi.fn();
  const { container } = render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <StatefulJoinedPage
          initialTab={tab}
          onTabChange={onTabChange}
        />
      </ThemeProvider>
    </Provider>,
  );
  return { container, onTabChange };
}

function pressEnter(element: HTMLElement) {
  const activates = fireEvent.keyDown(element, { key: 'Enter' });
  if (activates && element instanceof HTMLButtonElement) fireEvent.click(element);
}

function StatefulJoinedPage({
  initialTab,
  onTabChange,
}: {
  initialTab: JoinedTab;
  onTabChange: (tab: JoinedTab) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <JoinedPage
      tab={tab}
      onTabChange={next => {
        onTabChange(next);
        setTab(next);
      }}
    />
  );
}

describe('JoinedPage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getEnrollment).mockResolvedValue({ ok: true, status: 200, data: JOINED });
    vi.mocked(api.getTerms).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getCycles).mockResolvedValue(ok(CYCLES));
    vi.mocked(api.getPayouts).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getPayoutWallet).mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when the Payouts flag is off', () => {
    it('should still offer all three tabs', async () => {
      const { container } = await renderPage('leaderboard', { payout: false });

      expect(
        within(container)
          .getAllByRole('tab')
          .map(tab => tab.textContent),
      ).toEqual(['Leaderboard', 'My Places', 'Payouts']);
    });

    it('should show the payout wallet setup date in the Payouts tab and request no payouts', async () => {
      const { container } = await renderPage('payouts', { payout: false });

      expect(within(container).getByRole('tab', { name: 'Payouts', selected: true })).toBeTruthy();
      expect(
        within(within(container).getByRole('tabpanel')).getByRole('heading', {
          name: PAYOUTS_LOCKED,
        }),
      ).toBeTruthy();
      expect(within(container).queryByText('payouts panel')).toBeNull();
      expect(api.getPayouts).not.toHaveBeenCalled();
      expect(api.getPayoutWallet).not.toHaveBeenCalled();
    });
  });

  describe('when the Payouts flag is on', () => {
    it('should show the full Payouts tab and no setup date', async () => {
      const { container } = await renderPage('payouts');

      expect(
        within(within(container).getByRole('tabpanel')).getByText('payouts panel'),
      ).toBeTruthy();
      expect(within(container).queryByText(PAYOUTS_LOCKED)).toBeNull();
      expect(api.getPayouts).toHaveBeenCalled();
      expect(api.getPayoutWallet).toHaveBeenCalled();
    });
  });

  describe('when it renders', () => {
    it('should title the page, mark it beta and say when the user joined', async () => {
      await renderPage();

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Earn · Creator Fund');
      expect(screen.getByText('Beta')).toBeTruthy();
      expect(screen.getByText('Joined on Oct 30, 2026')).toBeTruthy();
    });

    it('should leave out the joined date when the enrolment date is malformed', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue({
        ok: true,
        status: 200,
        data: { ...JOINED, enrolled_at: 'not-a-date' },
      });

      await renderPage();

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Earn · Creator Fund');
      expect(screen.queryByText(/^Joined on/)).toBeNull();
    });

    it.each([
      ['my_places', 'My Places', 'my places panel'],
      ['payouts', 'Payouts', 'payouts panel'],
    ] as const)('should show the selected tab panel for %s', async (tab, name, panel) => {
      await renderPage(tab);

      expect(screen.getByRole('tab', { name, selected: true })).toBeTruthy();
      expect(screen.getByRole('tabpanel').textContent).toBe(panel);
    });

    it('should name the first tab Leaderboard once a cycle has closed', async () => {
      await renderPage();

      expect(screen.getByRole('tab', { name: 'Leaderboard', selected: true })).toBeTruthy();
    });

    it('should name the first tab Home while the cycles load', async () => {
      vi.mocked(api.getCycles).mockReturnValue(new Promise(() => {}));
      await renderPage('leaderboard', { awaitCycles: false });

      expect(screen.getByRole('tab', { name: 'Home', selected: true })).toBeTruthy();
    });

    it('should name the first tab Home when the cycles fail to load', async () => {
      vi.mocked(api.getCycles).mockResolvedValue({ ok: false, status: 500, error: 'boom' });
      await renderPage();

      expect(screen.getByRole('tab', { name: 'Home', selected: true })).toBeTruthy();
    });

    it('should list Payouts third, after My Places', async () => {
      await renderPage();

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Leaderboard',
        'My Places',
        'Payouts',
      ]);
    });
  });

  describe('when moving through the tabs with the keyboard', () => {
    it('should move focus with the arrow keys and select with Enter', async () => {
      const { onTabChange } = await renderPage();
      const tablist = screen.getByRole('tablist', { name: 'Creator Fund sections' });
      const leaderboard = within(tablist).getByRole('tab', { name: 'Leaderboard' });
      const myPlaces = within(tablist).getByRole('tab', { name: 'My Places' });

      leaderboard.focus();
      fireEvent.keyDown(leaderboard, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(myPlaces);

      pressEnter(myPlaces);
      expect(onTabChange).toHaveBeenCalledWith('my_places');
    });
  });

  describe('when the More options menu is used', () => {
    it('should point the More options button at the menu it opens', async () => {
      await renderPage();
      const button = screen.getByRole('button', { name: 'More options' });

      fireEvent.click(button);
      const menu = await screen.findByRole('menu');

      expect(menu.id).not.toBe('');
      expect(button.getAttribute('aria-controls')).toBe(menu.id);
    });

    it('should offer Program, Program Rules, Read Terms and Contact Support', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual([
        'Program',
        'Program Rules',
        'Read Terms',
        'Contact Support',
      ]);
    });

    it.each([
      ['Program', 'https://decentraland.org/creator-fund', 'Creator Fund Program Opened'],
      [
        'Program Rules',
        'https://docs.decentraland.org/creator/creator-fund/program-rules',
        'Creator Fund Program Rules Opened',
      ],
      ['Read Terms', 'https://decentraland.org/creator-fund-terms', 'Creator Fund Read Terms'],
    ] as const)('should open %s in the browser', async (name, url, event) => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      fireEvent.click(await screen.findByRole('menuitem', { name }));

      expect(misc.openExternal).toHaveBeenCalledWith(url);
      expect(tracked(event)).toEqual([{ source: 'menu' }]);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Program Terms' })).toBeNull();
    });

    it.each(['leaderboard', 'my_places', 'payouts'] as const)(
      'should open support in the browser from Contact Support on %s',
      async tab => {
        await renderPage(tab);

        fireEvent.click(screen.getByRole('button', { name: 'More options' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Contact Support' }));

        expect(misc.openExternal).toHaveBeenCalledWith('https://decentraland.org/help/');
        expect(screen.queryByRole('menu')).toBeNull();
      },
    );
  });

  describe('when the only closed cycle starts before the program start date', () => {
    beforeEach(() => {
      vi.mocked(api.getCycles).mockResolvedValue(ok(LAUNCH_CYCLES));
    });

    it('should name the first tab Home', async () => {
      await renderPage('leaderboard', {
        variants: { [FeatureFlag.CREATOR_FUND]: LAUNCH_VARIANT },
      });

      expect(screen.getByRole('tab', { name: 'Home', selected: true })).toBeTruthy();
    });

    it('should name the first tab Leaderboard when the flag sets no start date', async () => {
      await renderPage();

      expect(screen.getByRole('tab', { name: 'Leaderboard', selected: true })).toBeTruthy();
    });
  });

  describe('when no cycle has closed yet', () => {
    beforeEach(() => {
      vi.mocked(api.getCycles).mockResolvedValue(
        ok({ cycles: CYCLES.cycles.filter(cycle => cycle.status !== 'closed') }),
      );
    });

    it('should name the first tab Home', async () => {
      await renderPage();

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Home',
        'My Places',
        'Payouts',
      ]);
    });

    it('should offer support only from the More options menu, not from a header button', async () => {
      await renderPage();

      const moreOptions = screen.getByRole('button', { name: 'More options' });
      expect(within(screen.getByRole('banner')).getAllByRole('button')).toEqual([moreOptions]);
      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Contact Support' }));

      expect(misc.openExternal).toHaveBeenCalledWith('https://decentraland.org/help/');
    });

    it('should keep focus and the header in place when My Places is selected', async () => {
      await renderPage();
      const header = screen.getByRole('banner');
      const myPlaces = screen.getByRole('tab', { name: 'My Places' });

      myPlaces.focus();
      pressEnter(myPlaces);

      expect(screen.getByRole('tab', { name: 'My Places', selected: true })).toBe(myPlaces);
      expect(document.activeElement).toBe(myPlaces);
      expect(screen.getByRole('banner')).toBe(header);
    });
  });

  describe('analytics', () => {
    it('should report each tab the user selects, the first as Leaderboard once a cycle has closed', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('tab', { name: 'My Places' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Payouts' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Leaderboard' }));

      expect(tracked('Creator Fund Tab Viewed')).toEqual([
        { tab: 'my_places' },
        { tab: 'payouts' },
        { tab: 'leaderboard' },
      ]);
    });

    it('should report the first tab as Home while it reads Home', async () => {
      vi.mocked(api.getCycles).mockResolvedValue(
        ok({ cycles: CYCLES.cycles.filter(cycle => cycle.status !== 'closed') }),
      );
      await renderPage('my_places');

      fireEvent.click(screen.getByRole('tab', { name: 'Home' }));

      expect(tracked('Creator Fund Tab Viewed')).toEqual([{ tab: 'home' }]);
    });

    it('should report Read Terms and Contact Support from the menu', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Read Terms' }));
      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Contact Support' }));

      expect(tracked('Creator Fund Read Terms')).toEqual([{ source: 'menu' }]);
      expect(tracked('Creator Fund Contact Support')).toEqual([{ source: 'menu' }]);
    });
  });
});
