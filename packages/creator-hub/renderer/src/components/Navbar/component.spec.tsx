import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { FeatureFlag } from '/@/modules/store/featureFlags';
import { actions as creatorFundActions } from '/@/modules/store/creatorFund';
import * as api from '/@/lib/creatorFundApi';
import { createTestStore } from '../../../tests/utils/testStore';

import { Navbar, NavbarItem } from '.';

const { isEnabled, auth } = vi.hoisted(() => ({
  isEnabled: vi.fn((_flag: string) => true),
  auth: { isSignedIn: true },
}));

vi.mock('/@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('/@/lib/creatorFundApi', () => ({ getEnrollment: vi.fn() }));

vi.mock('/@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ isEnabled }) }));
vi.mock('/@/hooks/useEditor', () => ({ useEditor: () => ({ version: '0.0.0' }) }));
vi.mock('../Header', () => ({
  Header: ({ children }: { children: React.ReactNode[] }) => <nav>{children}</nav>,
}));
vi.mock('../CreateButton', () => ({ CreateButton: () => null }));
vi.mock('../Modals/AppSettings', () => ({ AppSettings: () => null, SettingsTab: {} }));
vi.mock('../Modals/About', () => ({ About: () => null }));
vi.mock('./LogoMenu', () => ({ LogoMenu: () => null }));

const renderNavbar = (active: NavbarItem, store = createTestStore()) =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Navbar active={active} />
      </MemoryRouter>
    </Provider>,
  );

describe('Navbar', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    isEnabled.mockImplementation(() => true);
  });

  describe('when it renders', () => {
    it('should list the eight sections in order', () => {
      renderNavbar(NavbarItem.HOME);
      expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
        'Home',
        'Scenes',
        'Templates',
        'Analytics',
        'Manage',
        'Earn',
        'Learn',
        'More',
      ]);
    });

    it('should link Earn to the earn page', () => {
      renderNavbar(NavbarItem.HOME);
      expect(screen.getByRole('link', { name: 'Earn' }).getAttribute('href')).toBe('/earn');
    });

    it('should link Templates to the templates page', () => {
      renderNavbar(NavbarItem.HOME);
      expect(screen.getByRole('link', { name: 'Templates' }).getAttribute('href')).toBe(
        '/templates',
      );
    });
  });

  describe('when the Creator Fund flag is off', () => {
    it('should leave Earn out', () => {
      isEnabled.mockImplementation(flag => flag !== FeatureFlag.CREATOR_FUND);
      renderNavbar(NavbarItem.HOME);
      expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
        'Home',
        'Scenes',
        'Templates',
        'Analytics',
        'Manage',
        'Learn',
        'More',
      ]);
    });
  });

  describe('when showing the EARN notification dot', () => {
    const NOT_ENROLLED = {
      ok: false,
      status: 404,
      error: 'Not Found',
      body: { error: 'Not Found', message: 'not enrolled' },
    };
    const ENROLLED = {
      ok: true,
      status: 200,
      data: {
        status: 'active' as const,
        enrolled_at: '2026-10-30T14:02:11Z',
        terms_version: 1,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        email_verified_at: null,
      },
    };

    async function storeWithEnrollment(answer: Promise<unknown>) {
      vi.mocked(api.getEnrollment).mockReturnValue(answer as any);
      const store = createTestStore();
      await act(async () => {
        void store.dispatch(creatorFundActions.fetchEnrollment());
        await Promise.resolve();
      });
      return store;
    }

    const dot = () => document.querySelector('.notification-dot');

    afterEach(() => {
      auth.isSignedIn = true;
    });

    it('should show it on EARN when signed in and not enrolled', async () => {
      renderNavbar(NavbarItem.HOME, await storeWithEnrollment(Promise.resolve(NOT_ENROLLED)));

      const earn = screen.getByRole('link', { name: 'EARN, not joined yet' });
      expect(earn.contains(dot())).toBe(true);
      expect(dot()!.getAttribute('aria-hidden')).toBe('true');
    });

    it.each([
      ['enrolled', () => Promise.resolve(ENROLLED)],
      ['the status is loading', () => new Promise(() => {})],
      ['the status failed', () => Promise.resolve({ ok: false, status: 500, error: 'boom' })],
    ])('should hide it when %s', async (_name, answer) => {
      renderNavbar(NavbarItem.HOME, await storeWithEnrollment(answer()));
      expect(dot()).toBeNull();
    });

    it('should hide it when signed out', async () => {
      auth.isSignedIn = false;
      renderNavbar(NavbarItem.HOME, await storeWithEnrollment(Promise.resolve(NOT_ENROLLED)));
      expect(dot()).toBeNull();
    });

    it('should hide it when the Creator Fund flag is off', async () => {
      isEnabled.mockImplementation(flag => flag !== FeatureFlag.CREATOR_FUND);
      renderNavbar(NavbarItem.HOME, await storeWithEnrollment(Promise.resolve(NOT_ENROLLED)));
      expect(dot()).toBeNull();
    });

    it('should hide it while EARN is the active tab', async () => {
      renderNavbar(NavbarItem.EARN, await storeWithEnrollment(Promise.resolve(NOT_ENROLLED)));
      expect(dot()).toBeNull();
    });
  });

  describe('when a section is active', () => {
    it('should mark only that section as the current page', () => {
      renderNavbar(NavbarItem.TEMPLATES);
      const current = screen
        .getAllByRole('link')
        .filter(link => link.getAttribute('aria-current') === 'page');
      expect(current.map(link => link.textContent)).toEqual(['Templates']);
    });
  });
});
