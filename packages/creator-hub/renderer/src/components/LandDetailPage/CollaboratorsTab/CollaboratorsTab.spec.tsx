import type { ButtonHTMLAttributes } from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { buildSetLandOperator, sendLandTransaction } from '/@/lib/landTransactions';
import { resolveNameOwner } from '/@/modules/store/ens/names';
import { fetchProfile } from '/@/modules/store/profiles/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { CollaboratorsTab } from '.';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
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
vi.mock('/@/lib/landTransactions', async importOriginal => ({
  ...(await importOriginal<object>()),
  sendLandTransaction: vi.fn(() => new Promise(() => {})),
}));
vi.mock('/@/modules/store/ens/names', async importOriginal => ({
  ...(await importOriginal<object>()),
  resolveNameOwner: vi.fn(),
}));
let clickParcel: (x: number, y: number) => void = () => {};
vi.mock('/@/components/WorldAtlas', async importOriginal => ({
  ...(await importOriginal<object>()),
  WorldAtlas: ({ onClick }: { onClick: (x: number, y: number) => void }) => {
    clickParcel = onClick;
    return null;
  },
}));
vi.mock('../../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));

const SELF = '0x1234567890123456789012345678901234567890';
const ANA = '0x00000000000000000000000000000000000000a1';
const BEN = '0x00000000000000000000000000000000000000b2';

const base = {
  tokenId: '1',
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  name: 'Land Name',
  description: null,
  owner: SELF,
  operators: [],
};

const parcel = (updateOperator: string | null): Land => ({
  ...base,
  id: '96,15',
  type: LandType.PARCEL,
  x: 96,
  y: 15,
  updateOperator,
});

const withProfile = (address: string, name: string, store = createTestStore()) => {
  store.dispatch(fetchProfile.fulfilled({ address, avatar: { name } as never }, 'r', { address }));
  return store;
};

function renderTab(land: Land, store = createTestStore()) {
  vi.mocked(useAuth).mockReturnValue({ wallet: SELF } as unknown as ReturnType<typeof useAuth>);
  render(
    <Provider store={store as never}>
      <ThemeProvider theme={dark}>
        <CollaboratorsTab
          land={land}
          landName="Land Name"
        />
      </ThemeProvider>
    </Provider>,
  );
}

describe('CollaboratorsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when the parcel has a collaborator', () => {
    it('should count and list it, and revoke it after confirming', async () => {
      const land = parcel(ANA);
      renderTab(land);

      expect(screen.getByText('Collaborators: 1')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Remove 0x0000…00a1' }));
      expect(screen.getByRole('dialog', { name: 'Remove 0x0000…00a1?' })).toBeTruthy();
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove' })));

      expect(vi.mocked(sendLandTransaction).mock.calls.at(-1)?.[0]).toEqual(
        buildSetLandOperator(land, null),
      );
    });

    it('should warn, by display name, that adding someone replaces the current collaborator', async () => {
      vi.mocked(resolveNameOwner).mockResolvedValueOnce(BEN);
      const store = createTestStore();
      store.dispatch(
        fetchProfile.fulfilled({ address: BEN, avatar: { name: 'Fixture Ben' } as never }, 'r', {
          address: BEN,
        }),
      );
      renderTab(parcel(ANA), store);

      fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
        target: { value: 'fixtureben' },
      });
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', false),
        { timeout: 3000 },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(screen.getByRole('dialog', { name: 'Replace collaborator' }).textContent).toContain(
        "Fixture Ben will replace 0x0000…00a1 as this LAND's collaborator.",
      );
    }, 15_000);
  });

  describe('when the parcel has none', () => {
    it('should say so, keeping the Add row', () => {
      renderTab(parcel(null));

      expect(screen.getByRole('heading', { name: 'No collaborators yet' })).toBeTruthy();
      expect(screen.getByRole('textbox', { name: 'Wallet address or NAME' })).toBeTruthy();
    });
  });

  describe('when the collaborator has a profile name', () => {
    it('should name them by it on the remove button and in its confirm', () => {
      renderTab(parcel(ANA), withProfile(ANA, 'Fixture Ana'));

      fireEvent.click(screen.getByRole('button', { name: 'Remove Fixture Ana' }));

      expect(screen.getByRole('dialog', { name: 'Remove Fixture Ana?' })).toBeTruthy();
    });
  });

  describe('when a per-parcel collaborator with a profile name gets custom parcels', () => {
    it('should name them by it on the parcel select and in the confirm', () => {
      renderTab(
        {
          ...base,
          id: '501',
          type: LandType.ESTATE,
          parcels: [
            { x: 0, y: 0, id: '0,0', updateOperator: BEN },
            { x: 1, y: 0, id: '1,0', updateOperator: BEN },
          ],
          updateOperator: null,
        },
        withProfile(BEN, 'Fixture Ben'),
      );

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Parcels for Fixture Ben' }));
      fireEvent.click(screen.getByRole('option', { name: 'Custom parcels…' }));
      act(() => clickParcel(0, 0));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: 'Update parcels' }).textContent).toContain(
        'Fixture Ben will publish on 1 parcel.',
      );
    });
  });

  describe('when Custom parcels… is chosen for an estate-wide collaborator', () => {
    const estate: Land = {
      ...base,
      id: '501',
      type: LandType.ESTATE,
      parcels: [
        { x: 0, y: 0, id: '0,0', updateOperator: null },
        { x: 1, y: 0, id: '1,0', updateOperator: null },
      ],
      updateOperator: ANA,
    };

    beforeEach(() => {
      renderTab(estate);
      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Parcels for 0x0000…00a1' }));
      fireEvent.click(screen.getByRole('option', { name: 'Custom parcels…' }));
    });

    it('should open the picker as a dialog over the list, with CONFIRM blocked until a parcel is picked', () => {
      expect(screen.getByRole('dialog', { name: 'Update parcels' })).toBeTruthy();
      expect(screen.getByText('Deploy Permissions in')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', true);
    });

    it('should close on CANCEL and keep the row on All Parcels', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.getByRole('combobox', { name: 'Parcels for 0x0000…00a1' }).textContent).toBe(
        'All Parcels',
      );
    });
  });

  describe('when the estate has an estate-wide and a per-parcel collaborator', () => {
    it('should show which parcels each covers', () => {
      renderTab({
        ...base,
        id: '501',
        type: LandType.ESTATE,
        parcels: [
          { x: 0, y: 0, id: '0,0', updateOperator: BEN },
          { x: 1, y: 0, id: '1,0', updateOperator: BEN },
        ],
        updateOperator: ANA,
      });

      expect(screen.getByText('Deploy Permissions in')).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Parcels for 0x0000…00a1' }).textContent).toBe(
        'All Parcels',
      );
      expect(screen.getByRole('combobox', { name: 'Parcels for 0x0000…00b2' }).textContent).toBe(
        '2 Parcels',
      );
    });
  });

  describe('when collaborators are selected', () => {
    it('should offer the header trash only then, named Remove selected, opening the confirm', () => {
      renderTab({
        ...base,
        id: '501',
        type: LandType.ESTATE,
        parcels: [
          { x: 0, y: 0, id: '0,0', updateOperator: BEN },
          { x: 1, y: 0, id: '1,0', updateOperator: BEN },
        ],
        updateOperator: ANA,
      });
      expect(screen.queryByRole('button', { name: 'Remove selected' })).toBeNull();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select 0x0000…00a1' }));
      expect(
        screen
          .getByRole('checkbox', { name: 'Select all collaborators' })
          .getAttribute('data-indeterminate'),
      ).toBe('true');
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all collaborators' }));
      const trash = screen.getByRole('button', { name: 'Remove selected' });

      expect(trash.textContent).toBe('');
      fireEvent.click(trash);
      expect(screen.getByRole('dialog', { name: 'Remove 2 collaborators?' })).toBeTruthy();
    });
  });

  describe('when a single parcel has a collaborator', () => {
    it('should show no permissions column and no parcel select', () => {
      renderTab(parcel(ANA));

      expect(screen.getByText(ANA)).toBeTruthy();
      expect(screen.queryByText('Deploy Permissions in')).toBeNull();
      expect(screen.queryByRole('combobox', { name: /^Parcels for/ })).toBeNull();
    });

    it('should hide the remove button at rest while keeping it reachable by keyboard', () => {
      renderTab(parcel(ANA));
      const trash = screen.getByRole('button', { name: 'Remove 0x0000…00a1' });

      expect(getComputedStyle(trash).opacity).toBe('0');
      expect(trash.tabIndex).toBe(0);

      act(() => trash.focus());

      expect(document.activeElement).toBe(trash);
    });
  });
});
