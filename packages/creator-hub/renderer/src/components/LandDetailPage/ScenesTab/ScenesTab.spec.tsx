import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc, sceneExport } from '#preload';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { LandType, RoleType, type Land, type LandDeployment } from '/@/lib/land';
import type * as LandModule from '/@/lib/land';
import { fetchLandProjects } from '/@/modules/store/management/slice';
import { fetchProfile } from '/@/modules/store/profiles/slice';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { ScenesTab } from '.';

vi.mock('/@/hooks/useSnackbar', () => ({ useSnackbar: vi.fn() }));

vi.mock('decentraland-ui2', async importOriginal => ({
  ...(await importOriginal<object>()),
  AvatarFace: () => null,
}));
vi.mock('/@/lib/profile', () => ({
  default: { fetchProfile: () => Promise.resolve(undefined) },
}));

const fetchDeployersMock = vi.fn();
vi.mock('/@/lib/land', async importOriginal => {
  const original = await importOriginal<typeof LandModule>();
  return {
    ...original,
    Lands: class extends original.Lands {
      fetchDeployers = (ids: string[]) => fetchDeployersMock(ids);
    },
  };
});

const land: Land = {
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: 96,
  y: 15,
  name: 'Land Name',
  description: null,
  owner: '0xme',
  operators: [],
  updateOperator: null,
};

const deployment = (id: string, title: string, timestamp: number): LandDeployment =>
  ({
    id,
    timestamp,
    pointers: ['96,15'],
    content: [],
    metadata: { display: { title }, scene: { base: '96,15', parcels: ['96,15'] } },
  }) as unknown as LandDeployment;

const pushGeneric = vi.fn();

function renderTab(
  mode: 'manage' | 'view',
  deployments: LandDeployment[],
  profiles: Record<string, string> = {},
) {
  vi.mocked(useSnackbar).mockReturnValue({ pushGeneric } as unknown as ReturnType<
    typeof useSnackbar
  >);
  const store = createTestStore();
  for (const [address, name] of Object.entries(profiles)) {
    store.dispatch(
      fetchProfile.fulfilled({ address, avatar: { name } as never }, 'r', { address }),
    );
  }
  store.dispatch(fetchLandProjects.pending('r'));
  store.dispatch(
    fetchLandProjects.fulfilled(
      {
        projects: [toLandProject(land, deployments, hash => hash)],
        deployments: { [land.id]: deployments },
      },
      'r',
    ),
  );
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <ScenesTab
            land={land}
            project={toLandProject(land, deployments, hash => hash)}
            mode={mode}
          />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
}

const twoScenes = [deployment('a', 'Scene A', 1000), deployment('b', 'Scene B', 2000)];

describe('ScenesTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    fetchDeployersMock.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    pushGeneric.mockReset();
    fetchDeployersMock.mockReset();
  });

  describe('when a manager-level role opens it', () => {
    beforeEach(() => renderTab('manage', twoScenes));

    it('should list the scenes, newest first, with a select-all', () => {
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.map(row => within(row).getByRole('checkbox').getAttribute('aria-label'))).toEqual(
        ['Select Scene B', 'Select Scene A'],
      );
      expect(screen.getByRole('checkbox', { name: 'Select all scenes' })).toBeTruthy();
    });

    it('should switch the stats to a bulk bar once a scene is selected', () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Scene A' }));

      expect(screen.getByText('1 selected')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Unpublish selected' })).toBeTruthy();
    });
  });

  describe('when the list is sorted', () => {
    beforeEach(() => renderTab('manage', twoScenes));

    const columnHeader = (name: string) => screen.getByRole('columnheader', { name });

    it('should mark Last Updated, newest first, by default', () => {
      expect(columnHeader('Last Updated').getAttribute('aria-sort')).toBe('descending');
      expect(columnHeader('Last Updated').querySelector('svg')).not.toBeNull();
      expect(columnHeader('Name').getAttribute('aria-sort')).toBeNull();
    });

    it('should move the mark to Name once sorted by Name', () => {
      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sort by' }));
      fireEvent.click(screen.getByRole('option', { name: 'Name' }));

      expect(columnHeader('Name').getAttribute('aria-sort')).toBe('ascending');
      expect(columnHeader('Name').querySelector('svg')).not.toBeNull();
      expect(columnHeader('Last Updated').getAttribute('aria-sort')).toBeNull();
    });
  });

  describe('when a scene was deployed on a known date by a known account', () => {
    const NOON_27_OCT_2026 = Date.UTC(2026, 9, 27, 12);
    const ANA = '0x00000000000000000000000000000000000000a1';
    const BEN = '0x00000000000000000000000000000000000000b2';
    const scenes = [
      deployment('a', 'Scene A', NOON_27_OCT_2026),
      deployment('b', 'Scene B', NOON_27_OCT_2026 - 1000),
    ];
    const row = (title: string) => within(screen.getByRole('row', { name: new RegExp(title) }));

    it('should show the date medium-style, and the long date and time in a tooltip', async () => {
      renderTab('manage', scenes);
      const date = row('Scene A').getByText('Oct 27, 2026');

      expect(date.tagName).toBe('TIME');
      fireEvent.mouseOver(date);
      expect((await screen.findByRole('tooltip', {}, { timeout: 3000 })).textContent).toContain(
        'October 27, 2026',
      );
    }, 15_000);

    it('should name the deployer by profile, else by short address', async () => {
      fetchDeployersMock.mockResolvedValue({ a: ANA, b: BEN });
      renderTab('manage', scenes, { [ANA]: 'Fixture Ana' });

      expect(await row('Scene A').findByText('Fixture Ana', {}, { timeout: 3000 })).toBeTruthy();
      expect(await row('Scene B').findByText('0x0000…00b2', {}, { timeout: 3000 })).toBeTruthy();
      expect(fetchDeployersMock).toHaveBeenCalledWith(['a', 'b']);
    }, 15_000);

    it('should show a dash when the deployers cannot be read, and still list the scenes', async () => {
      fetchDeployersMock.mockRejectedValue(new Error('catalyst down'));
      renderTab('manage', scenes);

      await act(async () => {});
      expect(row('Scene A').getAllByText('—')).toHaveLength(1);
      expect(row('Scene B').getAllByText('—')).toHaveLength(1);
    }, 15_000);
  });

  describe('when a lessor opens it', () => {
    it('should offer neither checkboxes nor unpublish', () => {
      renderTab('view', twoScenes);

      expect(screen.queryAllByRole('checkbox')).toEqual([]);
      expect(screen.queryByRole('button', { name: 'Unpublish Scene A' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Download Scene A' })).toBeTruthy();
    });
  });

  describe('when a scene is downloaded', () => {
    beforeEach(async () => {
      vi.mocked(misc.showSaveDialog).mockResolvedValue('/tmp/scene-a.zip');
      vi.mocked(sceneExport.subscribeProgress).mockReturnValue({ cleanup: () => {} });
      renderTab('manage', twoScenes);
      fireEvent.click(screen.getByRole('button', { name: 'Download Scene A' }));
    });

    it('should warn first, then save where the user picks and report the recovery', async () => {
      vi.mocked(sceneExport.exportScene).mockResolvedValue({
        files: 1,
        bytes: 1,
        recoveredSources: 0,
        recovered: 'partial',
        skipped: [],
      });
      expect(screen.getByRole('dialog', { name: 'Download Scene A?' })).toBeTruthy();

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download' })));

      expect(misc.showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'scene-a.zip' }),
      );
      expect(sceneExport.exportScene).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'a', outputPath: '/tmp/scene-a.zip' }),
      );
      expect(pushGeneric).toHaveBeenCalledWith(
        'warning',
        "Scene downloaded. Some code couldn't be recovered; see RECOVERY.md.",
      );
    });

    it('should only offer to cancel while downloading, and say nothing once cancelled', async () => {
      let reject: (error: Error) => void = () => {};
      vi.mocked(sceneExport.exportScene).mockReturnValue(
        new Promise((_, fail) => {
          reject = fail;
        }),
      );
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download' })));

      const checkbox = await screen.findByRole(
        'checkbox',
        { name: 'Select Scene A' },
        { timeout: 3000 },
      );
      const row = within(checkbox.closest('tr')!);
      expect(row.queryByRole('button', { name: 'Unpublish Scene A' })).toBeNull();
      await act(async () => {
        fireEvent.click(row.getByRole('button', { name: 'Cancel download Scene A' }));
        reject(new Error('AbortError'));
      });

      expect(sceneExport.cancel).toHaveBeenCalledWith('a');
      expect(pushGeneric).not.toHaveBeenCalled();
    }, 15_000);
  });

  describe('when nothing is published on the LAND', () => {
    it('should say so and point to the Scenes page', () => {
      renderTab('manage', []);

      expect(
        screen.getByRole('heading', { name: 'No scenes published on this LAND.' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'View Scenes' })).toBeTruthy();
    });
  });
});
