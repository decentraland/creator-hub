import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { fetchLandList } from '/@/modules/store/land/slice';
import { actions as managementActions } from '/@/modules/store/management';
import {
  fetchLandProjects,
  fetchManagedProjectsFiltered,
  fetchStorageStats,
} from '/@/modules/store/management/slice';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../tests/utils/testStore';
import { ManagePage } from '.';

vi.mock('../Navbar', () => ({ Navbar: () => null, NavbarItem: { MANAGE: 'manage' } }));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/auth', () => ({ AuthServerProvider: { getAccount: vi.fn(() => null) } }));
vi.mock('../Modals/TransferLandModal', () => ({
  TransferLandModal: ({
    open,
    name,
    onClose,
  }: {
    open: boolean;
    name: string;
    onClose: () => void;
  }) =>
    open ? (
      <div role="dialog">
        transferring {name}
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const ownedParcel: Land = {
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: 96,
  y: 15,
  name: 'Land Name',
  description: null,
  owner: '0x1234567890123456789012345678901234567890',
  operators: [],
  updateOperator: null,
};

const landList = (land: Land[]) =>
  fetchLandList.fulfilled({ land, authorizations: [], rentals: [] }, 'r', { address: '' });

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

  describe('when the account manages a LAND through UpdateManager', () => {
    it('should tag its card Collaborator', () => {
      const managed: Land = { ...ownedParcel, roles: [RoleType.MANAGER], role: RoleType.MANAGER };
      const store = createTestStore();
      store.dispatch(managementActions.setTab('lands'));
      store.dispatch(landList([managed]));
      store.dispatch(fetchLandProjects.pending('r'));
      store.dispatch(
        fetchLandProjects.fulfilled(
          { projects: [toLandProject(managed, [], hash => hash)], deployments: {} },
          'r',
        ),
      );
      renderPage({ isSignedIn: true }, store);

      const card = screen.getByRole('article');
      expect(within(card).getByText('Collaborator')).toBeTruthy();
      expect(within(card).queryByText('Manager')).toBeNull();
    });
  });

  describe('when the owner transfers a LAND from its card and it leaves the list', () => {
    it('should keep the transfer dialog open', () => {
      const store = createTestStore();
      store.dispatch(managementActions.setTab('lands'));
      store.dispatch(landList([ownedParcel]));
      store.dispatch(fetchLandProjects.pending('r'));
      store.dispatch(
        fetchLandProjects.fulfilled(
          { projects: [toLandProject(ownedParcel, [], hash => hash)], deployments: {} },
          'r',
        ),
      );
      renderPage({ isSignedIn: true }, store);

      fireEvent.click(
        within(screen.getByRole('article')).getByRole('button', { name: 'Options for Land Name' }),
      );
      fireEvent.click(screen.getByRole('menuitem', { name: 'Transfer' }));
      act(() => {
        store.dispatch(landList([]));
      });

      expect(screen.getByRole('dialog').textContent).toContain('transferring Land Name');
    });

    it('should move focus to the page heading on Close, since the card that opened it is gone', () => {
      const store = createTestStore();
      store.dispatch(managementActions.setTab('lands'));
      store.dispatch(landList([ownedParcel]));
      store.dispatch(fetchLandProjects.pending('r'));
      store.dispatch(
        fetchLandProjects.fulfilled(
          { projects: [toLandProject(ownedParcel, [], hash => hash)], deployments: {} },
          'r',
        ),
      );
      renderPage({ isSignedIn: true }, store);
      fireEvent.click(
        within(screen.getByRole('article')).getByRole('button', { name: 'Options for Land Name' }),
      );
      fireEvent.click(screen.getByRole('menuitem', { name: 'Transfer' }));
      act(() => {
        store.dispatch(landList([]));
        store.dispatch(fetchLandProjects.pending('r'));
        store.dispatch(fetchLandProjects.fulfilled({ projects: [], deployments: {} }, 'r'));
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Manage' }),
      );
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
