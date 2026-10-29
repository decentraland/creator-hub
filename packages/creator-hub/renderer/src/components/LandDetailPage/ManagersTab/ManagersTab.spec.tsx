import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, type Authorization } from '/@/lib/land';
import { buildSetUpdateManager, sendLandTransaction } from '/@/lib/landTransactions';
import { resolveNameOwner } from '/@/modules/store/ens/names';
import { fetchLandList } from '/@/modules/store/land/slice';
import { fetchProfile } from '/@/modules/store/profiles/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { ManagersTab } from '.';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/landTransactions', async importOriginal => ({
  ...(await importOriginal<object>()),
  sendLandTransaction: vi.fn(() => new Promise(() => {})),
}));
vi.mock('/@/modules/store/ens/names', async importOriginal => ({
  ...(await importOriginal<object>()),
  resolveNameOwner: vi.fn(),
}));
vi.mock('../../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));

const SELF = '0x1234567890123456789012345678901234567890';
const D1 = '0x00000000000000000000000000000000000000d1';
const D2 = '0x00000000000000000000000000000000000000d2';
const BEN = '0x00000000000000000000000000000000000000b2';

function renderTab(authorizations: Authorization[], profiles: Record<string, string> = {}) {
  vi.mocked(useAuth).mockReturnValue({ wallet: SELF } as unknown as ReturnType<typeof useAuth>);
  const store = createTestStore();
  for (const [address, name] of Object.entries(profiles)) {
    store.dispatch(
      fetchProfile.fulfilled({ address, avatar: { name } as never }, 'r', { address }),
    );
  }
  store.dispatch(
    fetchLandList.fulfilled({ land: [], authorizations, rentals: [] }, 'r', { address: SELF }),
  );
  render(
    <Provider store={store as never}>
      <ThemeProvider theme={dark}>
        <ManagersTab />
      </ThemeProvider>
    </Provider>,
  );
}

describe('ManagersTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when the account has two managers, one on the LAND registry only', () => {
    it('should list both and flag the partial one', () => {
      renderTab([
        { address: D1, type: LandType.PARCEL },
        { address: D1, type: LandType.ESTATE },
        { address: D2, type: LandType.PARCEL },
      ]);

      expect(screen.getByText('Managers: 2')).toBeTruthy();
      expect(
        screen.getAllByRole('button', {
          name: 'Can manage your LANDs only. Add them again to include your Estates.',
        }),
      ).toHaveLength(1);
    });
  });

  describe('when a manager with a profile name is removed', () => {
    it('should name them by it on the remove button and in its confirm', () => {
      renderTab(
        [
          { address: D1, type: LandType.PARCEL },
          { address: D1, type: LandType.ESTATE },
        ],
        { [D1]: 'Fixture Dee' },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Remove Fixture Dee' }));

      expect(screen.getByRole('dialog', { name: 'Remove Fixture Dee?' })).toBeTruthy();
    });
  });

  describe('when a manager is added', () => {
    it('should sign the LAND registry first, as step 1 of 2', async () => {
      vi.mocked(resolveNameOwner).mockResolvedValueOnce(BEN);
      renderTab([]);
      fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
        target: { value: 'fixtureben' },
      });
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', false),
        { timeout: 3000 },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect(screen.getByRole('dialog', { name: 'Add manager' })).toBeTruthy();

      await act(async () =>
        fireEvent.click(screen.getAllByRole('button', { name: 'Add' }).at(-1)!),
      );

      expect(vi.mocked(sendLandTransaction).mock.calls.at(-1)?.[0]).toEqual(
        buildSetUpdateManager(SELF, BEN, true)[0],
      );
      expect(screen.getByText('Step 1 of 2 · LAND')).toBeTruthy();
    }, 15_000);
  });

  describe.each([
    [
      'the Estate',
      LandType.ESTATE,
      'Can manage your Estates only. Add them again to include your LANDs.',
    ],
    [
      'the LAND',
      LandType.PARCEL,
      'Can manage your LANDs only. Add them again to include your Estates.',
    ],
  ])('when a manager approved only on %s registry is added again', (_, registry, note) => {
    it('should say how to include the other registry, then sign both, LAND first', async () => {
      vi.mocked(resolveNameOwner).mockResolvedValueOnce(BEN);
      vi.mocked(sendLandTransaction).mockResolvedValueOnce({
        hash: `0x${'ab'.repeat(32)}`,
        status: 'confirmed',
      });
      renderTab([{ address: BEN, type: registry }]);
      expect(screen.getByRole('button', { name: note })).toBeTruthy();

      fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
        target: { value: 'fixtureben' },
      });
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', false),
        { timeout: 3000 },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      await act(async () =>
        fireEvent.click(screen.getAllByRole('button', { name: 'Add' }).at(-1)!),
      );

      const [land, estate] = buildSetUpdateManager(SELF, BEN, true);
      const signed = vi
        .mocked(sendLandTransaction)
        .mock.calls.slice(-2)
        .map(([tx]) => tx);
      expect(signed).toEqual([land, estate]);
      expect(await screen.findByText('Step 2 of 2 · Estates')).toBeTruthy();
    }, 15_000);
  });

  describe('when the account has no managers', () => {
    it('should say so', () => {
      renderTab([]);

      expect(screen.getByRole('heading', { name: 'No managers yet' })).toBeTruthy();
    });
  });
});
