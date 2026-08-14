import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthServerProvider } from '/@/lib/auth';
import { fetchAnalytics as fetchAnalyticsSnapshot } from '/@/lib/placeAnalytics';
import { useAuth } from '/@/hooks/useAuth';

import { createTestStore, type TestStore } from '../../../tests/utils/testStore';
import { AnalyticsDetailPage } from './component';

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

describe('AnalyticsDetailPage', () => {
  let store: TestStore;
  const signIn = vi.fn();

  /** Deep-linked, the way the router reaches this page. */
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store as never}>
      <MemoryRouter initialEntries={['/analytics/world:bananarama.dcl.eth@0,0']}>
        <Routes>
          <Route
            path="/analytics/:placeId"
            element={children}
          />
        </Routes>
      </MemoryRouter>
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

  describe('when a deep link is opened while not signed in', () => {
    beforeEach(() => {
      setAuth(false);
    });

    it('should offer to sign in rather than spin forever', () => {
      render(<AnalyticsDetailPage />, { wrapper });

      expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
    });

    it('should not ask the service for anything', () => {
      render(<AnalyticsDetailPage />, { wrapper });

      expect(fetchAnalyticsSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('when a deep link is opened while signed in', () => {
    beforeEach(() => {
      setAuth(true);
    });

    it('should load the snapshot once', async () => {
      render(<AnalyticsDetailPage />, { wrapper });

      await waitFor(() => expect(fetchAnalyticsSnapshot).toHaveBeenCalledTimes(1));
    });

    it('should report a scene that is not in the snapshot as not found', async () => {
      render(<AnalyticsDetailPage />, { wrapper });

      await waitFor(() => expect(screen.getByText('Scene not found')).toBeTruthy());
    });
  });
});
