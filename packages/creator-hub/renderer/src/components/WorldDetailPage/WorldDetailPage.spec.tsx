import type { ButtonHTMLAttributes } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      fetchWorldScenes = async () => ({ scenes: [], total: 1 });
      fetchWorldSettings = async () => ({ title: 'Deep World' });
      getContentSrcUrl = (hash: string) => hash;
    },
  };
});
vi.mock('decentraland-ui2', async importOriginal => ({
  ...(await importOriginal<object>()),
  AvatarFace: () => null,
}));

const WALLET = '0x00000000000000000000000000000000000000c3';
const OTHER = '0x00000000000000000000000000000000000000d4';

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
  store.dispatch(
    fetchWorlds.fulfilled({ worlds: [owned, untitled, shared], total: 3 }, 'r', { address: '' }),
  );
  store.dispatch(fetchStreamOnlyWorlds.fulfilled([streamed], 'r', { address: '' }));
  store.dispatch({
    type: 'ens/fetchENSList/fulfilled',
    payload: [{ subdomain: 'deep.dcl.eth', nftOwnerAddress: WALLET }],
  });
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
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
}

const tabs = () => screen.getAllByRole('tab').map(tab => tab.textContent);
const selectedTab = () =>
  within(screen.getByRole('tablist')).getByRole('tab', { selected: true }).textContent;
const terms = () => screen.queryAllByRole('term').map(term => term.textContent);

describe('WorldDetailPage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

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
  });

  describe('when a collaborator who can deploy opens a World', () => {
    it('should show only Scenes, even when the URL asks for Details', () => {
      renderPage('/manage/world/team.dcl.eth/details');

      expect(tabs()).toEqual(['Scenes']);
      expect(selectedTab()).toBe('Scenes');
    });

    it('should show the role and the owner, as on a LAND', () => {
      renderPage('/manage/world/team.dcl.eth/scenes');

      expect(terms()).toEqual(['Role', 'Owner']);
      expect(screen.getByText('Collaborator')).toBeTruthy();
      expect(screen.getByText(OTHER)).toBeTruthy();
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
