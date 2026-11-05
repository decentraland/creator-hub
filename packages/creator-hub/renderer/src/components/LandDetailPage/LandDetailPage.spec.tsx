import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dispatch } from '@reduxjs/toolkit';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { fetchLandList } from '/@/modules/store/land/slice';
import { actions as managementActions } from '/@/modules/store/management';
import { fetchLandProjects } from '/@/modules/store/management/slice';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../tests/utils/testStore';
import { LandDetailPage } from '.';

vi.mock('../Navbar', () => ({ Navbar: () => null, NavbarItem: { MANAGE: 'manage' } }));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));
vi.mock('./DetailsTab', () => ({ DetailsTab: () => <p>details panel</p> }));
vi.mock('./ScenesTab', () => ({ ScenesTab: () => <p>scenes panel</p> }));
vi.mock('./CollaboratorsTab', () => ({ CollaboratorsTab: () => <p>collaborators panel</p> }));
vi.mock('./ManagersTab', () => ({ ManagersTab: () => <p>managers panel</p> }));
vi.mock('../Modals/TransferLandModal', () => ({
  TransferLandModal: ({ open, name }: { open: boolean; name: string }) =>
    open ? <div role="dialog">transferring {name}</div> : null,
}));

const OWNER = '0x00000000000000000000000000000000000000a1';

const parcel = (role: RoleType): Land => ({
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [role],
  role,
  x: 96,
  y: 15,
  name: 'Land Name',
  description: null,
  owner: OWNER,
  operators: [],
  deployable: true,
  updateOperator: null,
});

function renderPage(path: string, lands: Land[]) {
  vi.mocked(useAuth).mockReturnValue({
    isSignedIn: true,
    wallet: '0x1234567890123456789012345678901234567890',
  } as unknown as ReturnType<typeof useAuth>);
  const store = createTestStore();
  store.dispatch(fetchLandList.pending('r', { address: '' }));
  store.dispatch(
    fetchLandList.fulfilled({ land: lands, authorizations: [], rentals: [] }, 'r', { address: '' }),
  );
  store.dispatch(fetchLandProjects.pending('r'));
  store.dispatch(
    fetchLandProjects.fulfilled(
      { projects: lands.map(land => toLandProject(land, [], hash => hash)), deployments: {} },
      'r',
    ),
  );
  render(
    <Provider store={store as never}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider theme={dark}>
          <Routes>
            <Route
              path="/manage/land/:id/:tab?"
              element={<LandDetailPage />}
            />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

describe('LandDetailPage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.spyOn(managementActions, 'fetchLandProjects').mockImplementation((() => () => {}) as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the owner opens a LAND', () => {
    beforeEach(() => {
      renderPage('/manage/land/96%2C15/details', [parcel(RoleType.OWNER)]);
    });

    it('should title the page after the LAND, with all four tabs and no role row', () => {
      expect(screen.getByRole('heading', { level: 1, name: 'Manage - Land Name' })).toBeTruthy();
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Details',
        'Scenes',
        'Collaborators',
        'Managers',
      ]);
      expect(screen.queryByText('Role')).toBeNull();
      expect(screen.getByRole('tabpanel').textContent).toBe('details panel');
    });
  });

  describe('when the owner transfers the LAND and it leaves the list', () => {
    it('should keep the transfer dialog open over the empty state', async () => {
      const store = renderPage('/manage/land/96%2C15/details', [parcel(RoleType.OWNER)]);
      fireEvent.click(screen.getByRole('button', { name: 'Options for Land Name' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Transfer' }));

      act(() => {
        store.dispatch(fetchLandList.pending('r', { address: '' }));
        store.dispatch(
          fetchLandList.fulfilled({ land: [], authorizations: [], rentals: [] }, 'r', {
            address: '',
          }),
        );
      });

      expect(screen.getByRole('dialog').textContent).toBe('transferring Land Name');
      expect(await screen.findByText('This LAND is no longer in your list.')).toBeTruthy();
    });
  });

  describe('when a LAND is opened again with its list already loaded', () => {
    it('should refetch the list while keeping the LAND on screen', () => {
      const refetch = vi
        .spyOn(managementActions, 'fetchLandProjects')
        .mockImplementation(
          (() => (dispatch: Dispatch) => dispatch(fetchLandProjects.pending('refetch'))) as never,
        );

      const store = renderPage('/manage/land/96%2C15/details', [parcel(RoleType.OWNER)]);

      expect(refetch).toHaveBeenCalledTimes(1);
      expect(store.getState().management.lands.status).toBe('loading');
      expect(screen.getByRole('heading', { level: 1, name: 'Manage - Land Name' })).toBeTruthy();
    });
  });

  describe('when a manager opens a LAND', () => {
    it('should show the role as Collaborator', () => {
      renderPage('/manage/land/96%2C15/details', [parcel(RoleType.MANAGER)]);

      expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual(['Role', 'Owner']);
      expect(screen.getByText('Collaborator')).toBeTruthy();
      expect(screen.queryByText('Manager')).toBeNull();
    });
  });

  describe('when a collaborator opens a LAND', () => {
    beforeEach(() => {
      renderPage('/manage/land/96%2C15/managers', [parcel(RoleType.OPERATOR)]);
    });

    it('should show the role and the owner, and only Details and Scenes', () => {
      expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual(['Role', 'Owner']);
      expect(screen.getByText('Collaborator')).toBeTruthy();
      expect(screen.getByText(OWNER)).toBeTruthy();
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Details', 'Scenes']);
    });

    it('should fall back to Details for a tab the role cannot see', () => {
      expect(
        within(screen.getByRole('tablist')).getByRole('tab', { selected: true }).textContent,
      ).toBe('Details');
    });
  });

  describe('when the LAND is no longer in the list', () => {
    it('should say so once the refetch settles, and offer the way back', async () => {
      renderPage('/manage/land/unknown/details', [parcel(RoleType.OWNER)]);

      expect(
        await screen.findByRole('heading', { name: 'This LAND is no longer in your list.' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Back to Manage' })).toBeTruthy();
    });
  });

  describe('when the LAND projects list the LAND but the LAND list does not', () => {
    const listInProjects = (store: ReturnType<typeof renderPage>) => {
      store.dispatch(fetchLandProjects.pending('projects'));
      store.dispatch(
        fetchLandProjects.fulfilled(
          { projects: [toLandProject(parcel(RoleType.OWNER), [], hash => hash)], deployments: {} },
          'projects',
        ),
      );
    };

    describe('and the LAND list is still loading', () => {
      beforeEach(() => {
        const store = renderPage('/manage/land/96%2C15/details', []);
        act(() => {
          listInProjects(store);
          store.dispatch(fetchLandList.pending('list', { address: '' }));
        });
      });

      it('should keep loading instead of saying the LAND left the list', () => {
        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.queryByText('This LAND is no longer in your list.')).toBeNull();
      });
    });

    describe('and the LAND list failed', () => {
      beforeEach(() => {
        const store = renderPage('/manage/land/96%2C15/details', []);
        act(() => {
          listInProjects(store);
          store.dispatch(fetchLandList.pending('list', { address: '' }));
          store.dispatch(fetchLandList.rejected(new Error('boom'), 'list', { address: '' }));
        });
      });

      it('should ask to try again instead of saying the LAND left the list', () => {
        expect(screen.getByRole('heading', { name: 'Something went wrong.' })).toBeTruthy();
        expect(screen.getByText('Please, try again.')).toBeTruthy();
        expect(screen.queryByText('This LAND is no longer in your list.')).toBeNull();
      });
    });
  });
});
