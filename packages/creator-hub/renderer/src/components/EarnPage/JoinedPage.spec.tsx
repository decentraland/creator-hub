import { useState } from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { actions } from '/@/modules/store/creatorFund';
import * as api from '/@/lib/creatorFundApi';

import { tracked } from '../../../tests/utils/analytics';
import { createTestStore } from '../../../tests/utils/testStore';
import { CYCLES, ok } from './joined/fixtures';
import { JoinedPage, type JoinedTab } from './JoinedPage';

vi.mock('/@/lib/creatorFundApi', () => ({
  getEnrollment: vi.fn(),
  getTerms: vi.fn(),
  getCycles: vi.fn(),
}));
vi.mock('./joined/LeaderboardTab', () => ({ LeaderboardTab: () => <p>leaderboard panel</p> }));
vi.mock('./joined/MyPlacesTab', () => ({ MyPlacesTab: () => <p>my places panel</p> }));
vi.mock('../Modals', async importOriginal => ({
  ...((await importOriginal()) as object),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

const JOINED = {
  status: 'active' as const,
  enrolled_at: '2026-10-30T14:02:11Z',
  terms_version: 1,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
};

async function renderPage(tab: JoinedTab = 'leaderboard', { awaitCycles = true } = {}) {
  const store = createTestStore();
  await act(async () => {
    await store.dispatch(actions.fetchEnrollment());
    const cycles = store.dispatch(actions.fetchCycles());
    if (awaitCycles) await cycles;
  });
  const onTabChange = vi.fn();
  render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <StatefulJoinedPage
          initialTab={tab}
          onTabChange={onTabChange}
        />
      </ThemeProvider>
    </Provider>,
  );
  return { onTabChange };
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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

    it('should show the selected tab panel', async () => {
      await renderPage('my_places');

      expect(screen.getByRole('tab', { name: 'My Places', selected: true })).toBeTruthy();
      expect(screen.getByRole('tabpanel').textContent).toBe('my places panel');
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

    it('should offer Read Terms and Contact Support, and open the terms read only', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual(['Read Terms', 'Contact Support']);

      fireEvent.click(items[0]);

      expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it.each(['leaderboard', 'my_places'] as const)(
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

  describe('when no cycle has closed yet', () => {
    beforeEach(() => {
      vi.mocked(api.getCycles).mockResolvedValue(
        ok({ cycles: CYCLES.cycles.filter(cycle => cycle.status !== 'closed') }),
      );
    });

    it('should name the first tab Home', async () => {
      await renderPage();

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Home', 'My Places']);
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
      fireEvent.click(screen.getByRole('tab', { name: 'Leaderboard' }));

      expect(tracked('Creator Fund Tab Viewed')).toEqual([
        { tab: 'my_places' },
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
