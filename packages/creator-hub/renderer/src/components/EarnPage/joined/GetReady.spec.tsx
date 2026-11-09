import { Provider } from 'react-redux';
import { act, cleanup, render, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Cycle } from '/shared/types/creator-fund';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { actions } from '/@/modules/store/creatorFund';
import * as api from '/@/lib/creatorFundApi';

import { createTestStore } from '../../../../tests/utils/testStore';
import { ok } from './fixtures';
import { GetReady } from './GetReady';

vi.mock('/@/lib/creatorFundApi', () => ({ getCycles: vi.fn() }));

const cycle = (id: number, start: string, status: Cycle['status']): Cycle => ({
  id,
  start_at: `${start}T00:00:00Z`,
  end_at: '2027-01-01T00:00:00Z',
  pool_usdc: 10000,
  status,
});

async function renderGetReady(cycles: Cycle[]) {
  vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles }));
  const store = createTestStore();
  await act(async () => {
    await store.dispatch(actions.fetchCycles());
  });
  const { container } = render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <GetReady />
      </ThemeProvider>
    </Provider>,
  );
  return within(container);
}

describe('GetReady', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when the first cycle has not started', () => {
    it('should date the first cycle from its start, the earliest in the list', async () => {
      const view = await renderGetReady([
        cycle(2, '2026-12-01', 'upcoming'),
        cycle(1, '2026-11-15', 'upcoming'),
      ]);

      expect(view.getByText('Your first reward cycle starts November 15th.')).toBeTruthy();
      expect(view.getByText('Cycle #1 Begins November 15th.')).toBeTruthy();
    });
  });

  describe('when the first cycle is running', () => {
    it('should say it started, in the past tense', async () => {
      const view = await renderGetReady([
        cycle(2, '2026-11-16', 'upcoming'),
        cycle(1, '2026-11-01', 'running'),
      ]);

      expect(view.getByText('Your first reward cycle started November 1st.')).toBeTruthy();
      expect(view.getByText('Cycle #1 Began November 1st.')).toBeTruthy();
    });
  });

  describe('when no cycle is listed', () => {
    it('should keep the undated lines', async () => {
      const view = await renderGetReady([]);

      expect(
        view.getByText(
          'Your first reward cycle is coming up. Here are a few things you can do to get started.',
        ),
      ).toBeTruthy();
      expect(view.getByText('Your first reward cycle begins!')).toBeTruthy();
    });
  });
});
