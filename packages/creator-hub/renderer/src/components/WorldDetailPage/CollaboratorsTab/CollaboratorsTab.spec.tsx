import type { ButtonHTMLAttributes } from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import type * as WorldsModule from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { CollaboratorsTab } from '.';

vi.mock('../../Button', async importOriginal => ({
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

const OWNER = '0x00000000000000000000000000000000000000a1';
const ANA = '0x00000000000000000000000000000000000000b2';
const BEN = '0x00000000000000000000000000000000000000c3';
const CAL = '0x00000000000000000000000000000000000000d4';
const NEWCOMER = '0x00000000000000000000000000000000000000e5';
const WORLD = 'plaza.dcl.eth';

const api = {
  getPermissions: vi.fn(),
  putPermissionType: vi.fn(),
  deletePermissionType: vi.fn(),
  fetchParcelsPermission: vi.fn(),
  postParcelsPermission: vi.fn(),
  deleteParcelsPermission: vi.fn(),
  fetchWorldScenes: vi.fn(),
};

vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      getPermissions = (...args: unknown[]) => api.getPermissions(...args);
      putPermissionType = (...args: unknown[]) => api.putPermissionType(...args);
      deletePermissionType = (...args: unknown[]) => api.deletePermissionType(...args);
      fetchParcelsPermission = (...args: unknown[]) => api.fetchParcelsPermission(...args);
      postParcelsPermission = (...args: unknown[]) => api.postParcelsPermission(...args);
      deleteParcelsPermission = (...args: unknown[]) => api.deleteParcelsPermission(...args);
      fetchWorldScenes = (...args: unknown[]) => api.fetchWorldScenes(...args);
      getContentSrcUrl = (hash: string) => hash;
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
vi.mock('../../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));
let clickParcel: (x: number, y: number) => void = () => {};
vi.mock('/@/components/WorldAtlas', async importOriginal => ({
  ...(await importOriginal<object>()),
  WorldAtlas: ({ onClick }: { onClick: (x: number, y: number) => void }) => {
    clickParcel = onClick;
    return null;
  },
}));

type Setup = {
  deployers?: string[];
  streamers?: string[] | 'open';
  summary?: Record<string, unknown[]>;
  scenes?: string[][];
};

const MIXED: Setup = {
  deployers: [OWNER, ANA],
  streamers: [ANA, CAL],
  summary: {
    [ANA]: [
      { permission: 'deployment', worldWide: true },
      { permission: 'streaming', worldWide: true },
    ],
    [BEN]: [{ permission: 'deployment', worldWide: false, parcelCount: 3 }],
    [CAL]: [{ permission: 'streaming', worldWide: true }],
  },
};

async function renderTab({
  deployers = [OWNER],
  streamers = [],
  summary = {},
  scenes = [['0,0', '1,0']],
}: Setup = MIXED) {
  vi.mocked(useAuth).mockReturnValue({ wallet: OWNER } as unknown as ReturnType<typeof useAuth>);
  api.getPermissions.mockResolvedValue({
    owner: OWNER,
    permissions: {
      deployment: { type: 'allow-list', wallets: deployers },
      access: { type: 'unrestricted' },
      streaming:
        streamers === 'open'
          ? { type: 'unrestricted' }
          : { type: 'allow-list', wallets: streamers },
    },
    summary,
  });
  api.putPermissionType.mockResolvedValue(true);
  api.deletePermissionType.mockResolvedValue(true);
  api.postParcelsPermission.mockResolvedValue(true);
  api.deleteParcelsPermission.mockResolvedValue(true);
  api.fetchParcelsPermission.mockResolvedValue({ parcels: [], total: 0 });
  api.fetchWorldScenes.mockResolvedValue({
    scenes: scenes.map((parcels, index) => ({
      entityId: `scene-${index}`,
      parcels,
      entity: { content: [] },
    })),
    total: scenes.length,
  });
  const store = createTestStore();
  render(
    <Provider store={store as never}>
      <ThemeProvider theme={dark}>
        <CollaboratorsTab worldName={WORLD} />
      </ThemeProvider>
    </Provider>,
  );
  await screen.findByRole('textbox', { name: 'Wallet address or NAME' });
  await act(async () => {});
  return store;
}

const notices = (store: ReturnType<typeof createTestStore>) =>
  store
    .getState()
    .snackbar.notifications.map(notice =>
      notice.type === 'generic' ? `${notice.severity}: ${notice.message}` : notice.type,
    );
const deploy = (name: string) => screen.getByRole('combobox', { name: `Parcels for ${name}` });
const pick = (name: string, option: string) => {
  fireEvent.mouseDown(deploy(name));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
};
const stream = (name: string) =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: `Stream permission for ${name}` });
const dialog = (name: string) => screen.getByRole('dialog', { name });
const select = (name: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: `Select ${name}` }));

const ANA_NAME = '0x0000…00b2';
const BEN_NAME = '0x0000…00c3';
const CAL_NAME = '0x0000…00d4';

describe('World CollaboratorsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    Object.values(api).forEach(fn => fn.mockReset());
  });

  describe('when the World has collaborators', () => {
    it('should list each with its deploy scope and stream permission, out of 100', async () => {
      await renderTab();

      expect(
        screen.getByText(
          'Add up to 100 collaborators and manage their permission to deploy or stream into your world.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Collaborators: 3/100')).toBeTruthy();
      expect(screen.getByText('Stream')).toBeTruthy();
      expect(deploy(ANA_NAME).textContent).toBe('All Parcels');
      expect(deploy(BEN_NAME).textContent).toBe('3 Parcels');
      expect(deploy(CAL_NAME).textContent).toBe('None');
      expect([ANA_NAME, BEN_NAME, CAL_NAME].map(name => stream(name).checked)).toEqual([
        true,
        false,
        true,
      ]);
    });
  });

  describe('when a wallet is added', () => {
    it('should give it deploy permission on every parcel', async () => {
      await renderTab();

      fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
        target: { value: NEWCOMER },
      });
      const add = screen.getByRole('button', { name: 'Add' });
      await waitFor(() => expect(add).toHaveProperty('disabled', false), { timeout: 3000 });
      await act(async () => fireEvent.click(add));

      expect(api.putPermissionType).toHaveBeenCalledWith(OWNER, WORLD, 'deployment', NEWCOMER);
    });
  });

  describe('when a streamer is set to deploy nowhere', () => {
    it('should drop the deploy permission at once', async () => {
      await renderTab();

      pick(ANA_NAME, 'None');
      await act(async () => {});

      expect(api.deletePermissionType).toHaveBeenCalledWith(OWNER, WORLD, 'deployment', ANA);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('when a collaborator who does not stream is set to deploy nowhere', () => {
    it('should ask to remove them, and remove them on REMOVE', async () => {
      await renderTab();

      pick(BEN_NAME, 'None');
      expect(
        dialog(`Are you sure you want to remove '${BEN_NAME}' as a collaborator?`),
      ).toBeTruthy();
      expect(api.deletePermissionType).not.toHaveBeenCalled();

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove' })));

      expect(api.deletePermissionType).toHaveBeenCalledWith(OWNER, WORLD, 'deployment', BEN);
    });
  });

  describe('when Stream is toggled', () => {
    it('should grant and revoke the streaming permission', async () => {
      await renderTab();

      await act(async () => fireEvent.click(stream(BEN_NAME)));
      expect(api.putPermissionType).toHaveBeenCalledWith(OWNER, WORLD, 'streaming', BEN);

      await act(async () => fireEvent.click(stream(ANA_NAME)));
      expect(api.deletePermissionType).toHaveBeenCalledWith(OWNER, WORLD, 'streaming', ANA);
    });
  });

  describe('when Custom parcels… is picked', () => {
    it("should pick on the World's parcels and save them, with a snackbar", async () => {
      const store = await renderTab();

      pick(CAL_NAME, 'Custom parcels…');
      await screen.findByRole('dialog', { name: 'Update parcels' });
      act(() => clickParcel(0, 0));
      act(() => clickParcel(5, 5));
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' })));

      expect(api.postParcelsPermission).toHaveBeenCalledWith(OWNER, WORLD, 'deployment', CAL, [
        '0,0',
        '5,5',
      ]);
      expect(notices(store)).toContain('success: Parcels updated.');
    });

    it('should let a World with no scenes pick any parcel in its bounds', async () => {
      await renderTab({ ...MIXED, scenes: [] });

      pick(CAL_NAME, 'Custom parcels…');
      await screen.findByRole('dialog', { name: 'Update parcels' });
      act(() => clickParcel(3, 3));
      act(() => clickParcel(151, 0));
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' })));

      expect(api.postParcelsPermission).toHaveBeenCalledWith(OWNER, WORLD, 'deployment', CAL, [
        '3,3',
      ]);
    });
  });

  describe('when collaborators are removed', () => {
    it('should confirm one by name', async () => {
      await renderTab();

      fireEvent.click(screen.getByRole('button', { name: `Remove ${ANA_NAME}` }));

      expect(
        dialog(`Are you sure you want to remove '${ANA_NAME}' as a collaborator?`).textContent,
      ).toContain('They will no longer be able to deploy or stream in this World.');
    });

    it('should offer the header trash only with a selection, as an icon named Remove selected', async () => {
      await renderTab();
      expect(screen.queryByRole('button', { name: 'Remove selected' })).toBeNull();

      select(ANA_NAME);

      expect(screen.getByRole('button', { name: 'Remove selected' }).textContent).toBe('');
      expect(screen.getAllByRole('status').map(region => region.textContent)).toContain(
        '1 selected',
      );
      expect(
        screen
          .getByRole('checkbox', { name: 'Select all collaborators' })
          .getAttribute('data-indeterminate'),
      ).toBe('true');
    });

    it('should confirm several, then drop both permissions of each', async () => {
      await renderTab();

      select(ANA_NAME);
      select(CAL_NAME);
      fireEvent.click(screen.getByRole('button', { name: 'Remove selected' }));
      expect(dialog('Are you sure you want to remove all those collaborators?')).toBeTruthy();

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove' })));

      expect(api.deletePermissionType.mock.calls).toEqual(
        expect.arrayContaining([
          [OWNER, WORLD, 'deployment', ANA],
          [OWNER, WORLD, 'streaming', ANA],
          [OWNER, WORLD, 'streaming', CAL],
        ]),
      );
      expect(api.deletePermissionType).toHaveBeenCalledTimes(3);
    });

    it('should confirm all when every row is selected', async () => {
      await renderTab();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all collaborators' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove selected' }));

      expect(dialog('Are you sure you want to remove all the collaborators?')).toBeTruthy();
    });
  });

  describe('when streaming is open to everyone', () => {
    it('should say so, and show every Stream box checked and fixed', async () => {
      await renderTab({ ...MIXED, streamers: 'open' });

      const note = screen.getByText('Streaming is open to everyone in this World.');
      for (const name of [ANA_NAME, BEN_NAME]) {
        expect(stream(name).checked).toBe(true);
        expect(stream(name).disabled).toBe(true);
        expect(stream(name).getAttribute('aria-describedby')).toBe(note.id);
      }
      expect(note.id).not.toBe('');
    });
  });

  describe('when the World has 100 collaborators', () => {
    it('should say so and block ADD', async () => {
      const many = Array.from(
        { length: 100 },
        (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
      );
      await renderTab({ deployers: many });

      expect(screen.getByText("You've reached 100 collaborators.")).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', true);
    });
  });

  describe('when the World has no collaborators', () => {
    it('should say so', async () => {
      await renderTab({});

      expect(screen.getByRole('heading', { name: 'No collaborators yet' })).toBeTruthy();
    });
  });
});
