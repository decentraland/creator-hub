import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { analytics, misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';
import { Worlds } from '/@/lib/worlds';

import { createTestStore } from '../../../../tests/utils/testStore';
import { watchFor } from '../../../../tests/utils/watchFor';
import { CYCLES, LATEST_CLOSED, fail, leaderboard, ok } from './fixtures';
import { LeaderboardTab } from './LeaderboardTab';
import { SnapshotBanner } from './SnapshotBanner';

vi.mock('/@/lib/worlds', () => ({ Worlds: vi.fn() }));
Worlds.prototype.fetchWorldScenes = vi.fn();
vi.mock('/@/lib/creatorFundApi', () => ({
  getCycles: vi.fn(),
  getLeaderboard: vi.fn(),
  getNews: vi.fn(),
  getBanner: vi.fn(),
}));

const NEWS = {
  news: [6, 5, 4, 3, 2, 1].map(n => ({
    id: n,
    published_at: `2026-11-0${n}T00:00:00Z`,
    title: `Example news ${n}`,
    body: `Placeholder body ${n}.`,
  })),
};

const mountTab = (store: ReturnType<typeof createTestStore>) =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <LeaderboardTab />
      </ThemeProvider>
    </Provider>,
  );

const renderTab = () => {
  const store = createTestStore();
  mountTab(store);
  return store;
};

const ALERT = '[role="alert"]';
const SPINNER = '[role="progressbar"]';
const ROWS = '[aria-label^="Jump In to"]';
const NEWS_ENTRY = (element: Element) =>
  element.childElementCount === 0 && element.textContent === 'Example news 6';

async function chooseCycle(name: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Cycle' }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

describe('LeaderboardTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getCycles).mockResolvedValue(ok(CYCLES));
    vi.mocked(api.getLeaderboard).mockImplementation(async cycle => ok(leaderboard(cycle)));
    vi.mocked(api.getNews).mockResolvedValue(ok(NEWS));
    vi.mocked(api.getBanner).mockResolvedValue(
      ok({ markdown: '**Cycle Nov 1 - Nov 15** is live.' }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when it opens', () => {
    it('should load the latest closed cycle under the static sentence', async () => {
      renderTab();

      const toolbar = await screen.findByRole('toolbar', {
        name: 'The top 20 places with the highest payouts this cycle',
      });
      expect(api.getLeaderboard).toHaveBeenCalledWith(LATEST_CLOSED.id);
      expect(toolbar.getAttribute('aria-live')).toBeNull();
      expect(screen.getByRole('combobox', { name: 'Cycle' }).textContent).toBe(
        'Oct 16 - Oct 31, 2026',
      );
    });

    it('should keep the toolbar out of a table made of a head and a body row group', async () => {
      renderTab();
      await screen.findByText('Example Place 1');

      const table = screen.getByRole('table', {
        name: 'The top 20 places with the highest payouts this cycle',
      });
      expect(table.contains(screen.getByRole('toolbar'))).toBe(false);
      const [head, body] = within(table).getAllByRole('rowgroup');
      expect(
        within(head)
          .getAllByRole('columnheader')
          .map(cell => cell.textContent),
      ).toEqual(['Rank', 'Place', 'Earned', 'Jump In']);
      expect(within(body).getAllByRole('row')).toHaveLength(20);
    });

    it('should offer the closed cycles newest first, then All cycles', async () => {
      renderTab();
      await screen.findByText('Example Place 1');

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Cycle' }));

      expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual([
        'Oct 16 - Oct 31, 2026',
        'Oct 1 - Oct 15, 2026',
        'All cycles',
      ]);
    });
  });

  describe('when All cycles is chosen', () => {
    it('should load the aggregate under the all-cycles sentence', async () => {
      renderTab();
      await screen.findByText('Example Place 1');

      await chooseCycle('All cycles');

      await waitFor(() => expect(api.getLeaderboard).toHaveBeenLastCalledWith('all'));
      expect(
        screen.getByRole('toolbar', {
          name: 'The top 20 places with the highest payouts across all cycles',
        }),
      ).toBeTruthy();
    });
  });

  describe('when the leaderboard loads', () => {
    it('should list 20 places with medals for the top three', async () => {
      renderTab();

      await screen.findByText('Example Place 1');
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(20);
      expect(within(rows[0]).getByRole('img', { name: 'Rank 1' }).textContent).toBe('🥇');
      expect(within(rows[1]).getByRole('img', { name: 'Rank 2' }).textContent).toBe('🥈');
      expect(within(rows[2]).getByRole('img', { name: 'Rank 3' }).textContent).toBe('🥉');
      expect(within(rows[3]).getByRole('cell', { name: '4' })).toBeTruthy();
      expect(within(rows[0]).getByText('Example Place 1')).toBeTruthy();
      expect(within(rows[0]).getByText('23,-14')).toBeTruthy();
      expect(within(rows[0]).getByText('1,842.50 USDC')).toBeTruthy();
      expect(within(rows[1]).getByText('example-world.dcl.eth')).toBeTruthy();
    });

    it('should show a round amount whole and any other exactly', async () => {
      renderTab();

      await screen.findByText('Example Place 1');
      const rows = screen.getAllByRole('row').slice(1);
      expect(within(rows[0]).getByText('1,842.50 USDC')).toBeTruthy();
      expect(within(rows[1]).getByText('990 USDC')).toBeTruthy();
    });

    it('should jump in to a place through the deeplink', async () => {
      renderTab();

      fireEvent.click(await screen.findByRole('button', { name: 'Jump In to Example Place 1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Jump In to Example World 2' }));

      expect(misc.openExternal).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('position=23,-14'),
      );
      expect(misc.openExternal).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('example-world.dcl.eth'),
      );
    });
  });

  describe('when no cycle has closed yet', () => {
    beforeEach(() => {
      vi.mocked(api.getCycles).mockResolvedValue(
        ok({ cycles: CYCLES.cycles.filter(cycle => cycle.status !== 'closed') }),
      );
    });

    it('should show Get ready instead of the leaderboard, the news and the banner', async () => {
      renderTab();

      expect(await screen.findByRole('heading', { level: 2, name: 'Get ready!' })).toBeTruthy();
      expect(
        screen.getAllByRole('listitem').map(item => item.querySelector('span')?.textContent),
      ).toEqual([
        'Build your scenes',
        'Get a NAME and publish your scenes',
        'Get ready for the first cycle',
        'Join the community',
      ]);
      expect(screen.queryByRole('toolbar')).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByRole('complementary', { name: 'News' })).toBeNull();
      expect(api.getLeaderboard).not.toHaveBeenCalled();
    });

    it.each([
      ['Creator Docs', 'https://docs.decentraland.org/creator/'],
      ['References', 'https://github.com/decentraland/sdk7-test-scenes'],
      ['Get a NAME', 'https://decentraland.org/marketplace/names/claim'],
    ])('should open %s in the browser', async (name, url) => {
      renderTab();

      fireEvent.click(await screen.findByRole('link', { name }));

      expect(misc.openExternal).toHaveBeenCalledWith(url);
    });
  });

  describe('when a place is in a World of several scenes', () => {
    it('should label the row with the scene position and Jump In to that scene', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue({
        scenes: [],
        total: 3,
      } as any);
      vi.mocked(api.getLeaderboard).mockImplementation(async cycle => {
        const board = leaderboard(cycle, 2);
        board.entries[1].place = { ...board.entries[1].place, base_position: '2,1' };
        return ok(board);
      });
      renderTab();

      expect(await screen.findByText('example-world.dcl.eth - 2,1')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Jump In to Example World 2' }));

      expect(misc.openExternal).toHaveBeenCalledWith(
        expect.stringMatching(
          /^decentraland:\/\/\?realm=example-world\.dcl\.eth&position=2,1&dclenv=/,
        ),
      );
    });
  });

  describe('when a place has no title', () => {
    it('should name the row and its Jump In by the location', async () => {
      vi.mocked(api.getLeaderboard).mockImplementation(async cycle => {
        const board = leaderboard(cycle, 1);
        board.entries[0].place = { ...board.entries[0].place, title: null };
        return ok(board);
      });
      renderTab();

      expect(await screen.findByRole('button', { name: 'Jump In to 23,-14' })).toBeTruthy();
    });
  });

  describe('when the cycle has no payouts', () => {
    it('should say so', async () => {
      vi.mocked(api.getLeaderboard).mockImplementation(async cycle =>
        ok(leaderboard(cycle ?? '', 0)),
      );
      renderTab();

      expect((await screen.findByRole('status')).textContent).toBe(
        'No payouts for this cycle yet.',
      );
    });
  });

  describe('when the service answers with the cycle in another form', () => {
    it.each([
      ['a string id', '3'],
      ['no id', null],
    ])('should still show the board for %s', async (_, cycleId) => {
      vi.mocked(api.getLeaderboard).mockImplementation(async cycle =>
        ok({ ...leaderboard(cycle), cycle_id: cycleId as any }),
      );
      renderTab();

      expect(await screen.findByText('Example Place 1')).toBeTruthy();
    });
  });

  describe('when the leaderboard is loading', () => {
    it('should show the spinner', async () => {
      vi.mocked(api.getLeaderboard).mockReturnValue(new Promise(() => {}));
      renderTab();

      expect(await screen.findByRole('progressbar', { name: 'Loading' })).toBeTruthy();
    });
  });

  describe('when the leaderboard fails', () => {
    it('should say so and retry', async () => {
      vi.mocked(api.getLeaderboard).mockResolvedValueOnce(fail());
      renderTab();

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Something went wrong while loading the leaderboard.',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await screen.findByText('Example Place 1');
      expect(screen.getAllByRole('row')).toHaveLength(21);
    });
  });

  describe('when the first load ends with the leaderboard failed and the news loaded', () => {
    it('should show the error block beside the news, never a row', async () => {
      vi.mocked(api.getLeaderboard).mockResolvedValue(fail(404));
      const rows = watchFor(ROWS);

      try {
        renderTab();

        expect((await screen.findByRole('alert')).textContent).toBe(
          'Something went wrong while loading the leaderboard.',
        );
        expect(await screen.findByRole('complementary', { name: 'News' })).toBeTruthy();
        expect(rows.seen()).toBe(false);
      } finally {
        rows.stop();
      }
    });
  });

  describe('when the first load ends with the leaderboard loaded and the news failed', () => {
    it('should list the places across the width, never showing the news', async () => {
      vi.mocked(api.getNews).mockResolvedValue(fail(404));
      const news = watchFor(NEWS_ENTRY);

      try {
        const store = renderTab();

        await screen.findByText('Example Place 1');
        await waitFor(() => expect(store.getState().creatorFund.news.status).toBe('failed'));
        expect(screen.queryByRole('alert')).toBeNull();
        expect(news.seen()).toBe(false);
      } finally {
        news.stop();
      }
    });
  });

  describe('when the tab mounts again after its leaderboard failed', () => {
    it('should show only the spinner while it loads again, never the earlier error', async () => {
      vi.mocked(api.getLeaderboard).mockResolvedValue(fail(404));
      const store = renderTab();
      await screen.findByRole('alert');
      cleanup();
      vi.mocked(api.getLeaderboard).mockReturnValue(new Promise(() => {}));
      const error = watchFor(ALERT);

      try {
        mountTab(store);

        expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect(error.seen()).toBe(false);
      } finally {
        error.stop();
      }
    });

    it('should go from the spinner to the error block when it fails again', async () => {
      vi.mocked(api.getLeaderboard).mockResolvedValue(fail(404));
      const store = renderTab();
      await screen.findByRole('alert');
      cleanup();
      const rows = watchFor(ROWS);

      try {
        mountTab(store);

        expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect((await screen.findByRole('alert')).textContent).toBe(
          'Something went wrong while loading the leaderboard.',
        );
        expect(rows.seen()).toBe(false);
      } finally {
        rows.stop();
      }
    });
  });

  describe('when the tab mounts again after everything loaded', () => {
    it('should show the places at once and refetch them without the spinner', async () => {
      const store = renderTab();
      await screen.findByText('Example Place 1');
      cleanup();
      vi.mocked(api.getLeaderboard).mockClear();
      const spinner = watchFor(SPINNER);

      try {
        mountTab(store);

        expect(screen.getByText('Example Place 1')).toBeTruthy();
        await waitFor(() =>
          expect(store.getState().creatorFund.leaderboard.status).toBe('succeeded'),
        );
        expect(api.getLeaderboard).toHaveBeenCalledTimes(1);
        expect(spinner.seen()).toBe(false);
      } finally {
        spinner.stop();
      }
    });
  });

  describe('when the tab mounts again after the cycles failed', () => {
    it('should show the error block at once, never a spinner first', async () => {
      vi.mocked(api.getCycles).mockResolvedValue(fail(404));
      const store = renderTab();
      await screen.findByRole('alert');
      cleanup();
      const spinner = watchFor(SPINNER);

      try {
        mountTab(store);

        expect(screen.getByRole('alert').textContent).toBe(
          'Something went wrong while loading the leaderboard.',
        );
        expect(spinner.seen()).toBe(false);
      } finally {
        spinner.stop();
      }
    });
  });

  describe('when it opens in v0', () => {
    it('should neither fetch nor show the announcement banner', async () => {
      renderTab();
      await screen.findByText('Example Place 1');

      expect(api.getBanner).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: 'Announcement' })).toBeNull();
    });
  });

  describe('when the banner renders', () => {
    it('should show it as an announcement and open its https links externally', () => {
      render(
        <SnapshotBanner markdown="Read [the rules](https://example.com/rules) and [this](http://example.com)." />,
      );

      const region = screen.getByRole('region', { name: 'Announcement' });
      fireEvent.click(within(region).getByRole('link', { name: 'the rules' }));
      fireEvent.click(within(region).getByRole('link', { name: 'this' }));

      expect(misc.openExternal).toHaveBeenCalledTimes(1);
      expect(misc.openExternal).toHaveBeenCalledWith('https://example.com/rules');
    });
  });

  describe('when there is news', () => {
    it('should list the latest four in a side panel', async () => {
      renderTab();

      const news = await screen.findByRole('complementary', { name: 'News' });
      expect(within(news).getAllByRole('article')).toHaveLength(4);
      expect(within(news).getByText('Example news 6')).toBeTruthy();
      expect(within(news).queryByText('Example news 2')).toBeNull();
    });
  });

  describe.each([
    ['there is no news', () => ok({ news: [] })],
    ['the news fails to load', () => fail()],
  ])('when %s', (_name, answer) => {
    it('should leave the panel out', async () => {
      vi.mocked(api.getNews).mockResolvedValue(answer() as any);
      renderTab();
      await screen.findByText('Example Place 1');
      await waitFor(() => expect(api.getNews).toHaveBeenCalled());

      expect(screen.queryByRole('complementary', { name: 'News' })).toBeNull();
    });
  });

  describe('when the cycles fail to load', () => {
    beforeEach(() => {
      vi.mocked(api.getCycles).mockResolvedValueOnce(fail());
    });

    it('should fetch the cycles again on Retry', async () => {
      renderTab();

      expect(await screen.findByRole('alert')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(api.getCycles).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    });
  });

  describe('when the user acts on the leaderboard', () => {
    const tracked = (event: string) =>
      vi
        .mocked(analytics.track)
        .mock.calls.filter(([name]) => name === event)
        .map(([, properties]) => properties);

    it.each([
      ['Oct 1 - Oct 15, 2026', 1],
      ['All cycles', 'all'],
    ] as const)('should track choosing %s once', async (label, cycleId) => {
      renderTab();
      await screen.findByText('Example Place 1');

      await chooseCycle(label);

      expect(tracked('Creator Fund Cycle Changed')).toEqual([
        { tab: 'leaderboard', cycle_id: cycleId },
      ]);
    });

    it('should track a Jump In once with the rank and place id', async () => {
      renderTab();

      fireEvent.click(await screen.findByRole('button', { name: 'Jump In to Example Place 1' }));

      expect(tracked('Creator Fund Jump In')).toEqual([{ rank: 1, place_id: 'place-0' }]);
    });
  });
});
