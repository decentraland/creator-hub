import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import type { WorldSettings } from '/@/lib/worlds';
import type * as WorldsModule from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DetailShell } from '../../DetailShell';
import { SettingsTab } from '.';

const OWNER = '0x00000000000000000000000000000000000000a1';

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
  AuthServerProvider: { getAccount: () => OWNER },
}));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const saved: WorldSettings = {
  spawnCoordinates: '3,-4',
  skyboxTime: null,
  singlePlayer: false,
  showInPlaces: true,
};

async function renderTab(settings: WorldSettings = saved) {
  vi.mocked(useAuth).mockReturnValue({ wallet: OWNER } as unknown as ReturnType<typeof useAuth>);
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
  render(
    <Provider store={createTestStore() as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <DetailShell
            title="Manage - Plaza"
            basePath="/manage/world/plaza.dcl.eth"
            menu={null}
            tabs={[{ value: 'settings', label: 'Settings' }]}
            activeTab="settings"
          >
            <SettingsTab worldName="plaza.dcl.eth" />
          </DetailShell>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  await screen.findByRole('textbox', { name: 'X' });
  await act(async () => {});
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
});
