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

  describe.each([
    ['has not started', [cycle(2, '2026-12-01', 'upcoming'), cycle(1, '2026-11-15', 'upcoming')]],
    ['is not listed', []],
  ])('when the first cycle %s', (_state, cycles) => {
    it('should say Cycle 1 starts November 15th', async () => {
      const view = await renderGetReady(cycles);

      expect(view.getByText('Your first reward cycle starts November 15th.')).toBeTruthy();
      expect(view.getByText('Cycle 1 Starts November 15th.')).toBeTruthy();
    });
  });

  describe('when the first cycle is running', () => {
    it('should say Cycle 1 started November 15th, in the past tense', async () => {
      const view = await renderGetReady([
        cycle(2, '2026-12-01', 'upcoming'),
        cycle(1, '2026-11-15', 'running'),
      ]);

      expect(view.getByText('Your first reward cycle started November 15th.')).toBeTruthy();
      expect(view.getByText('Cycle 1 Started November 15th.')).toBeTruthy();
      expect(view.queryByText(/starts November/i)).toBeNull();
    });
  });

  describe('when the backend lists another start date', () => {
    it('should keep the program date, November 15th', async () => {
      const view = await renderGetReady([cycle(4, '2026-11-02', 'running')]);

      expect(view.getByText('Cycle 1 Started November 15th.')).toBeTruthy();
      expect(view.queryByText(/November 2nd/)).toBeNull();
    });
  });
});
