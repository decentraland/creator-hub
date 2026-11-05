import type { ButtonHTMLAttributes } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import type { WorldSettings } from '/@/lib/worlds';
import type * as WorldsModule from '/@/lib/worlds';
import { fetchWorldSettings as refetchWorldSettings } from '/@/modules/store/management/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DetailShell } from '../../DetailShell';
import { SettingsTab } from '.';

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
const COLLABORATOR = '0x00000000000000000000000000000000000000b2';
const signer = vi.hoisted(() => ({ address: '0x00000000000000000000000000000000000000a1' }));

const api = {
  fetchWorldSettings: vi.fn(),
  putWorldSettings: vi.fn(),
  getPermissions: vi.fn(),
  postPermissionType: vi.fn(),
};

vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      fetchWorldSettings = (...args: unknown[]) => api.fetchWorldSettings(...args);
      putWorldSettings = (...args: unknown[]) => api.putWorldSettings(...args);
      getPermissions = (...args: unknown[]) => api.getPermissions(...args);
      postPermissionType = (...args: unknown[]) => api.postPermissionType(...args);
      fetchWorlds = async () => ({ worlds: [], total: 0 });
    },
  };
});
vi.mock('/@/lib/auth', async importOriginal => ({
  ...(await importOriginal<object>()),
  AuthServerProvider: { getAccount: () => signer.address },
}));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const saved: WorldSettings = {
  spawnCoordinates: '3,-4',
  skyboxTime: null,
  singlePlayer: false,
  showInPlaces: true,
};

async function renderTab(
  settings: WorldSettings = saved,
  { wallet = OWNER, access = 'manage' }: { wallet?: string; access?: 'manage' | 'hidden' } = {},
) {
  signer.address = wallet;
  vi.mocked(useAuth).mockReturnValue({ wallet } as unknown as ReturnType<typeof useAuth>);
  api.fetchWorldSettings.mockResolvedValue(settings);
  api.putWorldSettings.mockResolvedValue({ success: true });
  api.postPermissionType.mockResolvedValue(true);
  api.getPermissions.mockResolvedValue({
    owner: OWNER,
    permissions: {
      deployment: { type: 'allow-list', wallets: [] },
      access: { type: 'unrestricted' },
      streaming: { type: 'allow-list', wallets: [] },
    },
    summary: {},
  });
  const store = createTestStore();
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <DetailShell
            title="Manage - Plaza"
            basePath="/manage/world/plaza.dcl.eth"
            menu={null}
            tabs={[{ value: 'settings', label: 'Settings' }]}
            activeTab="settings"
          >
            <SettingsTab
              worldName="plaza.dcl.eth"
              access={access}
            />
          </DetailShell>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  await screen.findByRole('textbox', { name: 'X' });
  await act(async () => {});
  return store;
}

const slider = () => screen.getByRole('slider', { name: 'Night/Day Time' });
const time = () => screen.getByRole('textbox', { name: 'Night/Day Time (skybox)' });
const auto = () => screen.getByRole('checkbox', { name: 'Auto (Decentraland Time)' });
const save = () => screen.queryByRole('button', { name: 'Save' });

describe('World SettingsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    Object.values(api).forEach(fn => fn.mockReset());
  });

  describe('when the owner opens it', () => {
    it('should fill the spawn, keep the skybox on Auto with the slider off, and show neither CANCEL nor SAVE', async () => {
      await renderTab();

      expect(screen.getByRole('textbox', { name: 'X' })).toHaveProperty('value', '3');
      expect(screen.getByRole('textbox', { name: 'Y' })).toHaveProperty('value', '-4');
      expect(auto()).toHaveProperty('checked', true);
      expect(slider()).toHaveProperty('disabled', true);
      expect(screen.getByRole('checkbox', { name: 'Discoverable in Places' })).toHaveProperty(
        'checked',
        true,
      );
      expect(
        screen.getByText('Live streaming is not supported in single player mode.'),
      ).toBeTruthy();
      expect(save()).toBeNull();
    });
  });

  describe('when Auto is turned off', () => {
    it('should start at 12:00 and save that time', async () => {
      await renderTab();
      fireEvent.click(auto());

      expect(slider()).toHaveProperty('disabled', false);
      expect(time()).toHaveProperty('value', '12:00');
      await act(async () => fireEvent.click(save()!));

      expect(api.putWorldSettings).toHaveBeenCalledWith(OWNER, 'plaza.dcl.eth', {
        skyboxTime: 43200,
      });
    });
  });

  describe('when a time is set', () => {
    it('should move the slider to a typed HH:MM, and step it 15 minutes with the arrow keys', async () => {
      await renderTab({ ...saved, skyboxTime: 3600 });

      fireEvent.change(time(), { target: { value: '04:00' } });
      expect(slider().getAttribute('aria-valuetext')).toBe('04:00');

      fireEvent.keyDown(slider(), { key: 'ArrowRight' });
      expect(time()).toHaveProperty('value', '04:15');

      fireEvent.keyDown(slider(), { key: 'End' });
      expect(time()).toHaveProperty('value', '23:59');
    });
  });

  describe('when Auto is turned back on', () => {
    it('should save Auto as null', async () => {
      await renderTab({ ...saved, skyboxTime: 3600 });
      fireEvent.click(auto());

      await act(async () => fireEvent.click(save()!));

      expect(api.putWorldSettings).toHaveBeenCalledWith(OWNER, 'plaza.dcl.eth', {
        skyboxTime: null,
      });
    });
  });

  describe('when a General checkbox changes', () => {
    it('should save it alone', async () => {
      await renderTab();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Single Player' }));

      await act(async () => fireEvent.click(save()!));

      expect(api.putWorldSettings).toHaveBeenCalledWith(OWNER, 'plaza.dcl.eth', {
        singlePlayer: true,
      });
    });
  });

  describe('when the spawn coordinate is not a whole number', () => {
    it('should block SAVE', async () => {
      await renderTab();

      fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '1.5' } });

      expect(save()).toHaveProperty('disabled', true);
    });
  });

  describe('when both spawn coordinates are cleared', () => {
    it('should offer CANCEL but block SAVE on an unsupported clear', async () => {
      await renderTab();
      fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Y' }), { target: { value: '' } });

      expect(save()).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });
  });

  describe('when one spawn coordinate is cleared', () => {
    it('should offer CANCEL but block SAVE', async () => {
      await renderTab();
      fireEvent.change(screen.getByRole('textbox', { name: 'Y' }), { target: { value: '' } });

      expect(save()).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });
  });

  describe('when settings are edited', () => {
    it('should keep the form and draft after a failed save', async () => {
      await renderTab();
      api.putWorldSettings.mockResolvedValue({ success: false, error: 'Fixture failure' });
      fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '5' } });

      await act(async () => fireEvent.click(save()!));

      expect(screen.getByRole('textbox', { name: 'X' })).toHaveProperty('value', '5');
      expect(screen.getByRole('combobox', { name: 'Access' })).toBeTruthy();
      expect(save()).toBeTruthy();
    });

    it('should preserve edits when a refetch finishes', async () => {
      const store = await renderTab();
      let resolve!: (value: WorldSettings) => void;
      api.fetchWorldSettings.mockReturnValueOnce(
        new Promise<WorldSettings>(done => (resolve = done)),
      );
      const request = store.dispatch(refetchWorldSettings({ worldName: 'plaza.dcl.eth' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '5' } });

      await act(async () => {
        resolve({ ...saved });
        await request;
      });

      expect(screen.getByRole('textbox', { name: 'X' })).toHaveProperty('value', '5');
      expect(save()).toBeTruthy();
    });

    it('should keep a half-typed spawn when a refetch finishes', async () => {
      const store = await renderTab({ ...saved, spawnCoordinates: undefined });
      let resolve!: (value: WorldSettings) => void;
      api.fetchWorldSettings.mockReturnValueOnce(
        new Promise<WorldSettings>(done => (resolve = done)),
      );
      const request = store.dispatch(refetchWorldSettings({ worldName: 'plaza.dcl.eth' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '7' } });

      await act(async () => {
        resolve({ ...saved, spawnCoordinates: undefined });
        await request;
      });

      expect(screen.getByRole('textbox', { name: 'X' })).toHaveProperty('value', '7');
    });

    it('should take a refetched value for a field left alone', async () => {
      const store = await renderTab();
      let resolve!: (value: WorldSettings) => void;
      api.fetchWorldSettings.mockReturnValueOnce(
        new Promise<WorldSettings>(done => (resolve = done)),
      );
      const request = store.dispatch(refetchWorldSettings({ worldName: 'plaza.dcl.eth' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '5' } });

      await act(async () => {
        resolve({ ...saved, spawnCoordinates: '3,9' });
        await request;
      });

      expect(screen.getByRole('textbox', { name: 'X' })).toHaveProperty('value', '5');
      expect(screen.getByRole('textbox', { name: 'Y' })).toHaveProperty('value', '9');
    });
  });

  describe('when the access type changes', () => {
    it('should write it at once and leave CANCEL and SAVE hidden', async () => {
      await renderTab();

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Access' }));
      fireEvent.click(
        within(screen.getByRole('listbox')).getByRole('option', { name: /^Invitation Only/ }),
      );
      await act(async () => {});

      expect(api.postPermissionType).toHaveBeenCalled();
      expect(save()).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });
  });

  describe('when a world-wide collaborator opens it', () => {
    it('should leave out Access, which only the owner may change', async () => {
      await renderTab(saved, { wallet: COLLABORATOR, access: 'hidden' });

      expect(screen.queryByRole('combobox', { name: 'Access' })).toBeNull();
      expect(api.getPermissions).not.toHaveBeenCalled();
    });

    it('should save the General settings signed as the collaborator', async () => {
      await renderTab(saved, { wallet: COLLABORATOR, access: 'hidden' });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Single Player' }));

      await act(async () => fireEvent.click(save()!));

      expect(api.putWorldSettings).toHaveBeenCalledWith(COLLABORATOR, 'plaza.dcl.eth', {
        singlePlayer: true,
      });
    });
  });
});
