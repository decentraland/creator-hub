import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth as authPreload } from '#preload';
import { useAuth } from '/@/hooks/useAuth';
import * as api from '/@/lib/creatorFundApi';
import { initialState } from '/@/modules/store/creatorFund';

import { createTestStore } from '../../../tests/utils/testStore';
import { AuthProvider } from '.';

const { account } = vi.hoisted(() => ({ account: { current: '0xaaaa' as string | null } }));

vi.mock('/@/lib/auth', () => {
  class AuthServerProvider {
    static setAuthServerUrl = vi.fn();
    static setAuthDappUrl = vi.fn();
    static hasValidIdentity = () => account.current !== null;
    static getAccount = () => account.current;
    static deactivate = vi.fn(() => {
      account.current = null;
    });
    static createSignInRequest = vi.fn(async () => ({ requestId: 'req', verifier: 'ver' }));
    static applyDeepLinkIdentity = vi.fn(async () => {
      account.current = '0xbbbb';
      return '0xbbbb';
    });
    static openAuthDapp = vi.fn();
    request = vi.fn();
  }
  class SignInError extends Error {}
  return { AuthServerProvider, SignInError };
});
vi.mock('/@/lib/profile', () => ({
  Profiles: class {
    fetchProfile = vi.fn(async () => undefined);
  },
}));
vi.mock('/@/lib/connection', () => ({ isNavigatorOnline: () => true }));
vi.mock('/@/lib/creatorFundApi', () => ({ getEnrollment: vi.fn() }));
vi.mock('/@/modules/store/land', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchTiles: () => ({ type: 'test/noop' }),
}));
vi.mock('/@/modules/store/management', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchAllManagedProjectsData: () => ({ type: 'test/noop' }),
}));

const ENROLLED = {
  status: 'active' as const,
  enrolled_at: '2026-10-30T14:02:11Z',
  terms_version: 1,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
};

function Controls() {
  const { signOut, signIn } = useAuth();
  return (
    <>
      <button onClick={signOut}>sign out</button>
      <button onClick={() => void signIn()}>sign in</button>
    </>
  );
}

function renderWithFlagOn() {
  const store = createTestStore();
  store.dispatch({
    type: 'featureFlags/fetch/fulfilled',
    payload: { flags: { 'creatorhub-creator-fund': true }, variants: {} },
  });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AuthProvider>
          <Controls />
        </AuthProvider>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    account.current = '0xaaaa';
    vi.mocked(api.getEnrollment).mockResolvedValue({ ok: true, status: 200, data: ENROLLED });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when signed in with the Creator Fund flag on', () => {
    it('should load the enrollment for the account', async () => {
      const store = renderWithFlagOn();

      await waitFor(() => expect(store.getState().creatorFund.enrollment.data).toEqual(ENROLLED));
    });
  });

  describe('when signing out', () => {
    it("should clear the account's Creator Fund state", async () => {
      const store = renderWithFlagOn();
      await waitFor(() => expect(store.getState().creatorFund.enrollment.data).toEqual(ENROLLED));

      fireEvent.click(screen.getByRole('button', { name: 'sign out' }));

      expect(store.getState().creatorFund).toEqual(initialState);
    });
  });

  describe('when a different account signs in', () => {
    it("should drop the previous account's status before the new one loads", async () => {
      let deliver: (payload: { identityId: string; authRequestId: string }) => void = () => {};
      vi.mocked(authPreload.onDeepLinkSignIn).mockImplementation(callback => {
        deliver = callback as typeof deliver;
        return { cleanup: vi.fn() };
      });
      const store = renderWithFlagOn();
      await waitFor(() => expect(store.getState().creatorFund.enrollment.data).toEqual(ENROLLED));
      vi.mocked(api.getEnrollment).mockReturnValue(new Promise(() => {}));

      fireEvent.click(screen.getByRole('button', { name: 'sign in' }));
      await waitFor(() => expect(authPreload.onDeepLinkSignIn).toHaveBeenCalled());
      await act(async () => deliver({ identityId: 'id', authRequestId: 'req' }));

      await waitFor(() => expect(store.getState().creatorFund.enrollment.status).toBe('loading'));
      expect(store.getState().creatorFund.enrollment.data).toBeNull();
    });
  });
});
