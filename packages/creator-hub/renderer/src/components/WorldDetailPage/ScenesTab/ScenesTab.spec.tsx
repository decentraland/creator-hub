import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import type { WorldScene } from '/@/lib/worlds';
import type * as WorldsModule from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { ScenesTab } from '.';

const OWNER = '0x00000000000000000000000000000000000000a1';
const COLLABORATOR = '0x00000000000000000000000000000000000000b2';

const api = {
  fetchWorldScenes: vi.fn(),
  getPermissions: vi.fn(),
  fetchParcelsPermission: vi.fn(),
  unpublishWorldScene: vi.fn(),
};

vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      fetchWorldScenes = (...args: unknown[]) => api.fetchWorldScenes(...args);
      getPermissions = (...args: unknown[]) => api.getPermissions(...args);
      fetchParcelsPermission = (...args: unknown[]) => api.fetchParcelsPermission(...args);
      unpublishWorldScene = (...args: unknown[]) => api.unpublishWorldScene(...args);
      fetchWorlds = async () => ({ worlds: [], total: 0 });
      getContentSrcUrl = (hash: string) => `https://content.example/${hash}`;
    },
  };
});
vi.mock('/@/lib/auth', async importOriginal => ({
  ...(await importOriginal<object>()),
  AuthServerProvider: { getAccount: () => OWNER },
}));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/profile', () => ({
  default: { fetchProfile: () => Promise.resolve(undefined) },
}));
vi.mock('decentraland-ui2', async importOriginal => ({
  ...(await importOriginal<object>()),
  AvatarFace: () => null,
}));
vi.mock('/@/components/WorldAtlas', async importOriginal => ({
  ...(await importOriginal<object>()),
  WorldAtlas: () => <p>world atlas</p>,
}));
vi.mock('../../Modals/WorldsYourStorageModal', () => ({
  WorldsYourStorageModal: ({ open }: { open: boolean }) =>
    open ? (
      <div
        role="dialog"
        aria-label="Your storage"
      />
    ) : null,
}));

const worldScene = (
  entityId: string,
  title: string,
  parcels: string[],
  createdAt: string,
  size: string,
): WorldScene =>
  ({
    worldName: 'plaza.dcl.eth',
    deployer: OWNER,
    entityId,
    parcels,
    size,
    createdAt,
    entity: { content: [], metadata: { display: { title }, scene: { base: parcels[0] } } },
  }) as unknown as WorldScene;

const PLAZA = worldScene('bafa', 'Plaza', ['0,0', '1,0'], '2026-10-27T12:00:00Z', '1048576');
const STAGE = worldScene('bafb', 'Stage', ['2,0'], '2026-10-20T12:00:00Z', '524288');

type Access = 'owner' | { worldWide: true } | { parcels: string[] };

async function renderTab(scenes: WorldScene[], access: Access = 'owner') {
  const wallet = access === 'owner' ? OWNER : COLLABORATOR;
  vi.mocked(useAuth).mockReturnValue({ wallet } as unknown as ReturnType<typeof useAuth>);
  api.fetchWorldScenes.mockResolvedValue({ scenes, total: scenes.length });
  api.unpublishWorldScene.mockResolvedValue(true);
  api.getPermissions.mockResolvedValue({
    owner: OWNER,
    permissions: {
      deployment: { type: 'allow-list', wallets: [COLLABORATOR] },
      access: { type: 'unrestricted' },
      streaming: { type: 'allow-list', wallets: [] },
    },
    summary:
      access === 'owner'
        ? {}
        : {
            [COLLABORATOR]: [
              'worldWide' in access
                ? { permission: 'deployment', worldWide: true }
                : {
                    permission: 'deployment',
                    worldWide: false,
                    parcelCount: access.parcels.length,
                  },
            ],
          },
  });
  api.fetchParcelsPermission.mockResolvedValue({
    parcels: access !== 'owner' && 'parcels' in access ? access.parcels : [],
    total: access !== 'owner' && 'parcels' in access ? access.parcels.length : 0,
  });
  const store = createTestStore();
  store.dispatch({
    type: 'management/fetchStorageStats/fulfilled',
    payload: { wallet: OWNER, dclNames: [], ensNames: [], usedSpace: '0', maxAllowedSpace: '0' },
  });
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <ScenesTab
            worldName="plaza.dcl.eth"
            mode={access === 'owner' ? 'manage' : 'view'}
          />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  await act(async () => {});
  await act(async () => {});
}

const rows = () => screen.getAllByRole('row').slice(1);
const rowNames = () =>
  rows().map(
    row => within(row).getAllByRole('cell')[row.querySelector('.Select') ? 1 : 0].textContent,
  );

describe('World ScenesTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    Object.values(api).forEach(fn => fn.mockReset());
  });

  describe('when the owner opens it', () => {
    it('should list the scenes newest first, under the LAND columns', async () => {
      await renderTab([STAGE, PLAZA]);

      expect(
        screen
          .getAllByRole('columnheader')
          .map(header => header.textContent)
          .filter(Boolean),
      ).toEqual(['Name', 'Parcels', 'Location', 'Last Updated', 'Published by']);
      expect(rowNames()).toEqual(['Plaza', 'Stage']);
      expect(rows()[0].textContent).toContain('0,0');
      expect(rows()[0].textContent).toContain('Oct 27, 2026');
    });

    it("should count the scenes, give the World's shape and its used space", async () => {
      await renderTab([PLAZA, STAGE]);

      const stats = screen.getByText('2 Scenes').parentElement!;
      expect(stats.textContent).toContain('3×1 Parcels');
      expect(stats.textContent).toContain('1.50 MB used');
    });

    it('should open the storage details from Manage Storage', async () => {
      await renderTab([PLAZA, STAGE]);

      fireEvent.click(screen.getByRole('button', { name: 'Manage Storage' }));

      expect(screen.getByRole('dialog', { name: 'Your storage' })).toBeTruthy();
    });

    it('should show Multi-Scene World as on, read-only, for a World with several scenes', async () => {
      await renderTab([PLAZA, STAGE]);

      const toggle = screen.getByRole('checkbox', { name: 'Multi-Scene World' });
      expect(toggle).toHaveProperty('checked', true);
      expect(toggle).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'About Multi-Scene World' })).toBeTruthy();
    });

    it('should show Multi-Scene World as off, still read-only, for a World with one scene', async () => {
      await renderTab([PLAZA]);

      const toggle = screen.getByRole('checkbox', { name: 'Multi-Scene World' });
      expect(toggle).toHaveProperty('checked', false);
      expect(toggle).toHaveProperty('disabled', true);
    });

    it('should swap the table for the World Map and back', async () => {
      await renderTab([PLAZA, STAGE]);

      fireEvent.click(screen.getByRole('button', { name: 'World Map' }));
      expect(screen.getByText('world atlas')).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'World Map' }));
      expect(screen.getByRole('table')).toBeTruthy();
    });

    it('should unpublish a scene through the World by one of its parcels', async () => {
      await renderTab([PLAZA, STAGE]);
      fireEvent.click(screen.getByRole('button', { name: 'Unpublish Stage' }));

      expect(screen.getByRole('dialog').textContent).not.toContain('This is the last scene');
      await act(async () =>
        fireEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Unpublish' }),
        ),
      );

      expect(api.unpublishWorldScene).toHaveBeenCalledWith(OWNER, 'plaza.dcl.eth', '2,0');
    });
  });

  describe('when the unpublish would remove the last scene', () => {
    it('should warn that the World goes offline and loses its settings', async () => {
      await renderTab([PLAZA]);

      fireEvent.click(screen.getByRole('button', { name: 'Unpublish Plaza' }));

      expect(screen.getByRole('dialog').textContent).toContain(
        'This is the last scene in plaza.dcl.eth. Unpublishing it takes the World offline and deletes its title, description, thumbnail and settings.',
      );
    });

    it('should warn when every scene is selected too', async () => {
      await renderTab([PLAZA, STAGE]);

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all scenes' }));
      fireEvent.click(screen.getByRole('button', { name: 'Unpublish selected' }));

      expect(screen.getByRole('dialog').textContent).toContain(
        'This is the last scene in plaza.dcl.eth.',
      );
    });
  });

  describe('when a collaborator may deploy to some parcels', () => {
    it('should list only the scenes on them, counted, with the World shape and no unpublish', async () => {
      await renderTab([PLAZA, STAGE], { parcels: ['2,0'] });

      expect(rowNames()).toEqual(['Stage']);
      const stats = screen.getByText('1 Scene').parentElement!;
      expect(stats.textContent).toContain('3×1 Parcels');
      expect(stats.textContent).not.toContain('used');
      expect(screen.queryByRole('button', { name: 'Manage Storage' })).toBeNull();
      expect(screen.queryByRole('checkbox', { name: 'Multi-Scene World' })).toBeNull();
      expect(screen.queryByRole('checkbox', { name: 'Select all scenes' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Unpublish Stage' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Download Stage' })).toBeTruthy();
    });
  });

  describe('when a collaborator may deploy to every parcel', () => {
    it('should list every scene', async () => {
      await renderTab([PLAZA, STAGE], { worldWide: true });

      expect(rowNames()).toEqual(['Plaza', 'Stage']);
    });
  });

  describe("when no scene sits on the collaborator's parcels", () => {
    it('should say so, with no button', async () => {
      await renderTab([PLAZA, STAGE], { parcels: ['9,9'] });

      expect(screen.getByRole('heading', { name: 'No scenes on your parcels yet.' })).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when the owner has no scenes in the World', () => {
    it('should say so and point to the Scenes page', async () => {
      await renderTab([]);

      expect(
        screen.getByRole('heading', { name: 'No scenes published in this World.' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'View Scenes' })).toBeTruthy();
    });
  });
});
