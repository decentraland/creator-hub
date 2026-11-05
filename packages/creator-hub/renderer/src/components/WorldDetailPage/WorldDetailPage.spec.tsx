import type { ButtonHTMLAttributes } from 'react';
import { Provider } from 'react-redux';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { WorldRoleType } from '/@/lib/worlds';
import type * as WorldsModule from '/@/lib/worlds';
import {
  fetchAllManagedProjectsData,
  fetchStreamOnlyWorlds,
  fetchWorlds,
} from '/@/modules/store/management/slice';
import { fetchProfile } from '/@/modules/store/profiles/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { ManagedProjectType, type ManagedProject } from '/shared/types/manage';

import { createTestStore } from '../../../tests/utils/testStore';
import { WorldDetailPage } from '.';

vi.mock('../Button', async importOriginal => ({
  ...(await importOriginal<object>()),
  Button: ({
    variant: _variant,
    color: _color,
    startIcon: _startIcon,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    color?: string;
    startIcon?: unknown;
  }) => (
    <button
      type="button"
      {...props}
    />
  ),
}));

vi.mock('../Navbar', () => ({ Navbar: () => null, NavbarItem: { MANAGE: 'manage' } }));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));
const fetchWorldScenes = vi.fn(async () => ({ scenes: [], total: 1 }));
const fetchWorldSettings = vi.fn(async () => ({ title: 'Deep World' }));
const getContentSrcUrl = vi.fn((hash: string) => hash);
const getPermissions = vi.fn(async (): Promise<unknown> => permissionsWith({}));
vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      fetchWorldScenes = fetchWorldScenes;
      fetchWorldSettings = fetchWorldSettings;
      getContentSrcUrl = getContentSrcUrl;
      getPermissions = getPermissions;
    },
  };
});
vi.mock('decentraland-ui2', async importOriginal => ({
  ...(await importOriginal<object>()),
  AvatarFace: () => null,
}));

const WALLET = '0x00000000000000000000000000000000000000c3';
const OTHER = '0x00000000000000000000000000000000000000d4';

function permissionsWith(summary: Record<string, unknown>) {
  return {
    owner: OTHER,
    permissions: {
      deployment: { type: 'allow-list', wallets: Object.keys(summary) },
      access: { type: 'unrestricted' },
      streaming: { type: 'allow-list', wallets: [] },
    },
    summary,
  };
}
const parcelGrant = { [WALLET]: [{ permission: 'deployment', worldWide: false, parcelCount: 2 }] };
const worldWideGrant = { [WALLET]: [{ permission: 'deployment', worldWide: true }] };

const deployment = {
  title: 'Scene X',
  description: '',
  thumbnail: '',
  lastPublishedAt: 0,
  scenesCount: 1,
};

const world = (overrides: Partial<ManagedProject>): ManagedProject => ({
  id: 'plaza.dcl.eth',
  displayName: 'plaza.dcl.eth',
  type: ManagedProjectType.WORLD,
  role: WorldRoleType.OWNER,
  owner: WALLET,
  title: 'Fixture Plaza',
  deployment,
  ...overrides,
});

const owned = world({});
const untitled = world({ id: 'bare.dcl.eth', displayName: 'bare.dcl.eth', title: undefined });
const shared = world({
  id: 'team.dcl.eth',
  displayName: 'team.dcl.eth',
  role: WorldRoleType.COLLABORATOR,
  owner: OTHER,
  title: 'Team World',
});
const streamed = world({
  id: 'stream.dcl.eth',
  displayName: 'stream.dcl.eth',
  role: WorldRoleType.COLLABORATOR,
  access: 'stream',
  owner: undefined,
});

function renderPage(path: string) {
  vi.mocked(useAuth).mockReturnValue({
    isSignedIn: true,
    wallet: WALLET,
  } as unknown as ReturnType<typeof useAuth>);
  const store = createTestStore();
  store.dispatch(
    fetchProfile.fulfilled({ address: WALLET, avatar: { name: 'Fixture Owner' } as never }, 'r', {
      address: WALLET,
    }),
  );
  store.dispatch(fetchWorlds.pending('r', { address: '' }));
  store.dispatch(
    fetchWorlds.fulfilled({ worlds: [owned, untitled, shared], total: 3 }, 'r', { address: '' }),
  );
  store.dispatch(fetchStreamOnlyWorlds.pending('r', { address: '', names: [] }));
  store.dispatch(fetchStreamOnlyWorlds.fulfilled([streamed], 'r', { address: '', names: [] }));
  store.dispatch({ type: 'ens/fetchENSList/pending', meta: { requestId: 'r' } });
  store.dispatch({
    type: 'ens/fetchENSList/fulfilled',
    payload: [{ subdomain: 'deep.dcl.eth', nftOwnerAddress: WALLET }],
    meta: { requestId: 'r' },
  });
  store.dispatch(fetchAllManagedProjectsData.pending('r', { address: '' }));
  store.dispatch(fetchAllManagedProjectsData.fulfilled(undefined, 'r', { address: '' }));
  render(
    <Provider store={store as never}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider theme={dark}>
          <Routes>
            <Route
              path="/manage/world/:name/:tab?"
              element={<WorldDetailPage />}
            />
          </Routes>
          <Link to="/manage/world/plaza.dcl.eth/details">Go to plaza</Link>
          <Link to="/manage/world/deep.dcl.eth/details">Go to deep</Link>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

const tabs = () => screen.getAllByRole('tab').map(tab => tab.textContent);
const selectedTab = () =>
  within(screen.getByRole('tablist')).getByRole('tab', { selected: true }).textContent;
const terms = () => screen.queryAllByRole('term').map(term => term.textContent);

describe('WorldDetailPage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    fetchWorldScenes.mockReset();
    fetchWorldScenes.mockResolvedValue({ scenes: [], total: 1 });
    fetchWorldSettings.mockReset();
    fetchWorldSettings.mockResolvedValue({ title: 'Deep World' });
    getContentSrcUrl.mockReset();
    getContentSrcUrl.mockImplementation((hash: string) => hash);
    getPermissions.mockReset();
    getPermissions.mockResolvedValue(permissionsWith(parcelGrant));
  });

  describe('when the owner opens a World', () => {
    it('should title it by its World Name, with the four tabs in order and Details open', async () => {
      renderPage('/manage/world/plaza.dcl.eth/details');

      expect(
        screen.getByRole('heading', { level: 1, name: 'Manage - Fixture Plaza' }),
      ).toBeTruthy();
      expect(tabs()).toEqual(['Details', 'Scenes', 'Settings', 'Collaborators']);
      expect(selectedTab()).toBe('Details');
      expect(
        await within(screen.getByRole('tabpanel')).findByRole('textbox', { name: 'World Name' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Options for Fixture Plaza' })).toBeTruthy();
    });

    it('should name the owner as the account itself, with no role', () => {
      renderPage('/manage/world/plaza.dcl.eth/details');

      expect(terms()).toEqual(['Owner']);
      expect(screen.getByText('Fixture Owner (You)')).toBeTruthy();
    });

    it('should open on Details when the URL names no tab', () => {
      renderPage('/manage/world/plaza.dcl.eth');

      expect(selectedTab()).toBe('Details');
    });

    it('should fall back to the domain when the World has no name', () => {
      renderPage('/manage/world/bare.dcl.eth/details');

      expect(screen.getByRole('heading', { level: 1, name: 'Manage - bare.dcl.eth' })).toBeTruthy();
    });

    it('should stay mounted when a list refresh removes this World from page zero', async () => {
      const store = renderPage('/manage/world/plaza.dcl.eth/details');
      const input = await screen.findByRole('textbox', { name: 'World Name' });
      act(() => {
        store.dispatch(fetchWorlds.pending('r2', { address: '' }));
        store.dispatch(fetchWorlds.fulfilled({ worlds: [], total: 1 }, 'r2', { address: '' }));
      });

      expect(
        screen.getByRole('heading', { level: 1, name: 'Manage - Fixture Plaza' }),
      ).toBeTruthy();
      expect(screen.getByRole('textbox', { name: 'World Name' })).toBe(input);
    });
  });

  describe('when a collaborator who can deploy to some parcels opens a World', () => {
    beforeEach(() => {
      getPermissions.mockResolvedValue(permissionsWith(parcelGrant));
    });

    it('should show only Scenes, even when the URL asks for Details', async () => {
      renderPage('/manage/world/team.dcl.eth/details');

      await screen.findByRole('tablist');
      expect(tabs()).toEqual(['Scenes']);
      expect(selectedTab()).toBe('Scenes');
    });

    it('should show the role and the owner, as on a LAND', async () => {
      renderPage('/manage/world/team.dcl.eth/scenes');

      await screen.findByRole('tablist');
      expect(terms()).toEqual(['Role', 'Owner']);
      expect(screen.getByText('Collaborator')).toBeTruthy();
      expect(screen.getByText(OTHER)).toBeTruthy();
    });
  });

  describe('when a collaborator who can deploy anywhere in the World opens it', () => {
    beforeEach(() => {
      getPermissions.mockResolvedValue(permissionsWith(worldWideGrant));
    });

    it('should show Details, Scenes and Settings, opening the Details the URL asks for', async () => {
      renderPage('/manage/world/team.dcl.eth/details');

      await screen.findByRole('tablist');
      expect(tabs()).toEqual(['Details', 'Scenes', 'Settings']);
      expect(selectedTab()).toBe('Details');
      expect(
        await within(screen.getByRole('tabpanel')).findByRole('textbox', { name: 'World Name' }),
      ).toBeTruthy();
    });

    it('should keep the role and the owner in the header', async () => {
      renderPage('/manage/world/team.dcl.eth/settings');

      await screen.findByRole('tablist');
      expect(selectedTab()).toBe('Settings');
      expect(terms()).toEqual(['Role', 'Owner']);
    });
  });

  describe("when reading a collaborator's permissions fails", () => {
    it('should fall back to Scenes only', async () => {
      getPermissions.mockResolvedValue(null);
      renderPage('/manage/world/team.dcl.eth/details');

      await screen.findByRole('tablist');
      expect(tabs()).toEqual(['Scenes']);
    });
  });

  describe('when the account can only stream to the World', () => {
    it('should show the not-found state', () => {
      renderPage('/manage/world/stream.dcl.eth/details');

      expect(
        screen.getByRole('heading', { name: 'This World is no longer in your list.' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Back to Manage' })).toBeTruthy();
    });
  });

  describe('when the account holds the World but the loaded Manage lists miss it', () => {
    it('should resolve it by name instead of showing not-found', async () => {
      renderPage('/manage/world/deep.dcl.eth/details');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Manage - Deep World' }),
      ).toBeTruthy();
      expect(tabs()).toEqual(['Details', 'Scenes', 'Settings', 'Collaborators']);
    });

    it('should stop loading when resolving the World fails', async () => {
      fetchWorldSettings.mockResolvedValueOnce({
        title: 'Deep World',
        thumbnailHash: 'QmThumbnail',
      } as never);
      getContentSrcUrl.mockImplementationOnce(() => {
        throw new Error('Unavailable');
      });
      renderPage('/manage/world/deep.dcl.eth/details');

      expect(
        await screen.findByRole('heading', { name: 'This World is no longer in your list.' }),
      ).toBeTruthy();
    });

    it('should try resolving it again after visiting another World', async () => {
      getContentSrcUrl.mockImplementationOnce(() => {
        throw new Error('Unavailable');
      });
      fetchWorldSettings.mockResolvedValueOnce({
        title: 'Deep World',
        thumbnailHash: 'QmThumbnail',
      } as never);
      renderPage('/manage/world/deep.dcl.eth/details');
      await screen.findByRole('heading', { name: 'This World is no longer in your list.' });

      fireEvent.click(screen.getByRole('link', { name: 'Go to plaza' }));
      await screen.findByRole('heading', { level: 1, name: 'Manage - Fixture Plaza' });
      fireEvent.click(screen.getByRole('link', { name: 'Go to deep' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Manage - Deep World' }),
      ).toBeTruthy();
    });
  });

  describe('when the World is not in the list', () => {
    it('should show the not-found state', () => {
      renderPage('/manage/world/unknown.dcl.eth/details');

      expect(
        screen.getByRole('heading', { name: 'This World is no longer in your list.' }),
      ).toBeTruthy();
    });
  });
});
