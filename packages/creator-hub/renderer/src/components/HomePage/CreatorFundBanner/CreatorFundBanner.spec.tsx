import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { FeatureFlag } from '/@/modules/store/featureFlags';

import { tracked } from '../../../../tests/utils/analytics';

import { BANNER_DISMISSED_KEY, CreatorFundBanner } from './CreatorFundBanner';

const { isEnabled } = vi.hoisted(() => ({
  isEnabled: vi.fn((_flag: string) => true),
}));

vi.mock('/@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ isEnabled }) }));

const TITLE = 'Creator Fund: Earn in Decentraland';

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route
          path="/home"
          element={<CreatorFundBanner />}
        />
        <Route
          path="/earn"
          element={<p>Earn page</p>}
        />
      </Routes>
    </MemoryRouter>,
  );

const queryBanner = () => screen.queryByRole('region', { name: TITLE });

describe('CreatorFundBanner', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    isEnabled.mockImplementation(() => true);
  });

  describe('when the Creator Fund flag is off', () => {
    beforeEach(() => {
      isEnabled.mockImplementation(flag => flag !== FeatureFlag.CREATOR_FUND);
    });

    it('should not render', () => {
      renderHome();
      expect(queryBanner()).toBeNull();
    });
  });

  describe('when the Creator Fund flag is on', () => {
    it('should pitch the Creator Fund', () => {
      renderHome();
      expect(queryBanner()).not.toBeNull();
      expect(screen.getByRole('heading', { name: TITLE })).toBeDefined();
      expect(screen.getByText('Bring players in, keep them playing, get paid.')).toBeDefined();
    });

    it('should open the Earn page from Learn more', () => {
      renderHome();
      fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
      expect(screen.getByText('Earn page')).toBeDefined();
      expect(tracked('Creator Fund Banner Clicked')).toEqual([undefined]);
    });

    it('should hide the artwork from assistive technology', () => {
      renderHome();
      expect(screen.queryByRole('img')).toBeNull();
    });
  });

  describe('when the creator closes it', () => {
    it('should go away', () => {
      renderHome();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(queryBanner()).toBeNull();
      expect(tracked('Creator Fund Banner Dismissed')).toEqual([undefined]);
    });

    it('should stay closed the next time Home opens', () => {
      renderHome();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      cleanup();

      renderHome();
      expect(queryBanner()).toBeNull();
      expect(localStorage.getItem(BANNER_DISMISSED_KEY)).toBe('true');
    });
  });

  describe('when storage is unavailable', () => {
    const denied = () => {
      throw new Error('denied');
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should still show, and still close', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);

      renderHome();
      expect(getItem).toHaveBeenCalledWith(BANNER_DISMISSED_KEY);
      expect(queryBanner()).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(setItem).toHaveBeenCalledWith(BANNER_DISMISSED_KEY, 'true');
      expect(queryBanner()).toBeNull();
    });
  });
});
