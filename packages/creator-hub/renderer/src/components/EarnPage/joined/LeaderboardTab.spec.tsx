import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';

import { createTestStore } from '../../../../tests/utils/testStore';
import { CYCLES, fail, ok } from './fixtures';
import { LeaderboardTab } from './LeaderboardTab';

vi.mock('/@/lib/creatorFundApi', () => ({
  getCycles: vi.fn(),
}));

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

    it('should show Get ready', async () => {
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

  describe('when a cycle has closed', () => {
    it('should render nothing once the cycles load', async () => {
      const { container } = renderTab();

      expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
      await waitFor(() => expect(container.innerHTML).toBe(''));
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
});
