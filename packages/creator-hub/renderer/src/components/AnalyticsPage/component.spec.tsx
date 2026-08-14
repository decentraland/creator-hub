import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthServerProvider } from '/@/lib/auth';
import { fetchAnalytics as fetchAnalyticsSnapshot } from '/@/lib/placeAnalytics';
import { useAuth } from '/@/hooks/useAuth';

import { createTestStore, type TestStore } from '../../../tests/utils/testStore';
import { AnalyticsPage } from './component';

/** The real store module boots the app on import; bind the hooks to the test store. */
vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

/** The navbar drags in the whole modal tree; none of it is what these tests exercise. */
vi.mock('../Navbar', () => ({ Navbar: () => null, NavbarItem: { ANALYTICS: 'analytics' } }));

vi.mock('/@/lib/placeAnalytics', () => ({ fetchAnalytics: vi.fn() }));
vi.mock('/@/lib/auth', () => ({ AuthServerProvider: { getAccount: vi.fn() } }));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

vi.mock('/@/modules/store/management', async () => {
  const actual = await import('/@/modules/store/management');
  return {
    ...actual,
    fetchAllManagedProjectsData: vi.fn(() => () => {
      const dispatched = Promise.resolve<unknown[]>([]) as Promise<unknown[]> & {
        unwrap: () => Promise<unknown[]>;
      };
      dispatched.unwrap = () => Promise.resolve([]);
      return dispatched;
    }),
  };
});

describe('AnalyticsPage', () => {
  let store: TestStore;
  const signIn = vi.fn();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store as never}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  );

  const setAuth = (isSignedIn: boolean, isSigningIn = false) =>
    vi.mocked(useAuth).mockReturnValue({ isSignedIn, isSigningIn, signIn } as any);

  beforeEach(() => {
    store = createTestStore();
    vi.mocked(AuthServerProvider.getAccount).mockReturnValue('0x123abc');
    vi.mocked(fetchAnalyticsSnapshot).mockResolvedValue({
      exportedAt: '2026-08-12T00:17:01.099Z',
      places: [],
      metricsByPlaceId: {},
    });
  });

  describe('when the creator is not signed in', () => {
    beforeEach(() => {
      setAuth(false);
    });

    /*
     * `idle` used to count as loading while the fetch waited on a sign-in that
     * never came, which left a spinner spinning forever.
     */
    it('should offer to sign in rather than spin forever', () => {
      render(<AnalyticsPage />, { wrapper });

      expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
    });

    it('should not ask the service for anything', () => {
      render(<AnalyticsPage />, { wrapper });

      expect(fetchAnalyticsSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('when a sign-in is in flight', () => {
    beforeEach(() => {
      setAuth(false, true);
    });

    it('should wait rather than prompt again', () => {
      render(<AnalyticsPage />, { wrapper });

      expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
    });
  });

  describe('when the creator is signed in', () => {
    beforeEach(() => {
      setAuth(true);
    });

    it('should load the snapshot', async () => {
      render(<AnalyticsPage />, { wrapper });

      await waitFor(() => expect(fetchAnalyticsSnapshot).toHaveBeenCalledTimes(1));
    });

    it('should not reload it when the page is revisited', async () => {
      const first = render(<AnalyticsPage />, { wrapper });
      await waitFor(() => expect(fetchAnalyticsSnapshot).toHaveBeenCalledTimes(1));
      first.unmount();

      render(<AnalyticsPage />, { wrapper });

      await waitFor(() => expect(store.getState().placeAnalytics.status).toBe('succeeded'));
      expect(fetchAnalyticsSnapshot).toHaveBeenCalledTimes(1);
    });
  });
});
