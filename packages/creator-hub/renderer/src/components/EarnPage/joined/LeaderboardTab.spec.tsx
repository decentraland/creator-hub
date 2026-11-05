import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';

import { createTestStore } from '../../../../tests/utils/testStore';
import { CYCLES, ok } from './fixtures';
import { LeaderboardTab } from './LeaderboardTab';

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

const renderTab = () =>
  render(
    <Provider store={createTestStore()}>
      <ThemeProvider theme={dark}>
        <LeaderboardTab />
      </ThemeProvider>
    </Provider>,
  );

describe('LeaderboardTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getCycles).mockResolvedValue(ok(CYCLES));
    vi.mocked(api.getNews).mockResolvedValue(ok(NEWS));
    vi.mocked(api.getBanner).mockResolvedValue(
      ok({ markdown: '**Cycle Nov 1 - Nov 15** is live.' }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
});
