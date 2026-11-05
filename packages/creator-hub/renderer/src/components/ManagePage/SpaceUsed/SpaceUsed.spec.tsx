import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { fetchStorageStats } from '/@/modules/store/management/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { SpaceUsed } from '.';

vi.mock('../../Modals/WorldsYourStorageModal', () => ({ WorldsYourStorageModal: () => null }));

const MB = 1024 * 1024;

describe('SpaceUsed', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when the account has used part of its storage', () => {
    beforeEach(() => {
      const store = createTestStore();
      store.dispatch({
        type: fetchStorageStats.fulfilled.type,
        payload: { usedSpace: String(20.02 * MB), maxAllowedSpace: String(900 * MB) },
      });
      render(
        <Provider store={store as never}>
          <ThemeProvider theme={dark}>
            <SpaceUsed />
          </ThemeProvider>
        </Provider>,
      );
    });

    it('should show a progressbar named Space Used with the used and allowed MB', () => {
      const bar = screen.getByRole('progressbar', { name: 'Space Used' });

      expect(bar.getAttribute('aria-valuetext')).toBe('20.02 / 900 MB');
      expect(bar.getAttribute('aria-valuemax')).toBe('900');
    });

    it('should fill the bar in proportion', () => {
      const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement;

      expect(parseFloat(fill.style.width)).toBeCloseTo(2.22, 2);
    });

    it('should name its info button', () => {
      expect(screen.getByRole('button', { name: 'About Space Used' })).toBeTruthy();
    });

    describe('and View Details opens the storage details', () => {
      beforeEach(() => {
        act(() => screen.getByRole('button', { name: 'About Space Used' }).focus());
        fireEvent.click(screen.getByRole('button', { name: /View Details/ }));
      });

      it('should close the tip first, so it never sits over the modal', () => {
        expect(
          screen.getByRole('button', { name: 'About Space Used' }).getAttribute('aria-expanded'),
        ).toBe('false');
      });
    });
  });
});
