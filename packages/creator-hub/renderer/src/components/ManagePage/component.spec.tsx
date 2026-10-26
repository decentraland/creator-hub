import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { actions as managementActions } from '/@/modules/store/management';
import { fetchManagedProjectsFiltered, fetchStorageStats } from '/@/modules/store/management/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../tests/utils/testStore';
import { ManagePage } from '.';

vi.mock('../Navbar', () => ({ Navbar: () => null, NavbarItem: { MANAGE: 'manage' } }));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/auth', () => ({ AuthServerProvider: { getAccount: vi.fn(() => null) } }));

function renderPage(auth: { isSignedIn: boolean }, store = createTestStore()) {
  vi.mocked(useAuth).mockReturnValue({
    isSignedIn: auth.isSignedIn,
    isSigningIn: false,
    signIn: vi.fn(),
    wallet: undefined,
  } as unknown as ReturnType<typeof useAuth>);
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <ManagePage />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

describe('ManagePage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when signed out', () => {
    it('should greet and offer to sign in, with no view bar', () => {
      renderPage({ isSignedIn: false });

      expect(screen.getByRole('heading', { level: 1, name: 'Manage' })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: 'Hi there!' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
      expect(screen.queryByRole('tablist')).toBeNull();
    });
  });

  describe('when signed in', () => {
    it('should offer no Refresh button beside the title', () => {
      renderPage({ isSignedIn: true });

      expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
    });
  });

  describe('when the signed-in account has no Worlds at all', () => {
    it('should show the empty Worlds view without the Space Used bar', () => {
      const store = createTestStore();
      store.dispatch({
        type: fetchStorageStats.fulfilled.type,
        payload: { usedSpace: '0', maxAllowedSpace: String(100 * 1024 * 1024) },
      });
      store.dispatch({ type: fetchManagedProjectsFiltered.fulfilled.type });

      renderPage({ isSignedIn: true }, store);

      expect(screen.getByRole('heading', { name: 'No Worlds to manage yet' })).toBeTruthy();
      expect(screen.queryByRole('progressbar', { name: 'Space Used' })).toBeNull();
    });
  });

  describe('when the LANDS tab opens and the LAND fetch fails', () => {
    it('should fetch on activation, then offer to try again', async () => {
      const store = createTestStore();
      store.dispatch(managementActions.setTab('lands'));

      renderPage({ isSignedIn: true }, store);

      expect(await screen.findByRole('heading', { name: 'Something went wrong.' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
      expect(screen.getByRole('tabpanel', { name: 'LANDs' })).toBeTruthy();
    });
  });
});
