import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { sendLandTransaction } from '/@/lib/landTransactions';
import { resolveNameOwner } from '/@/modules/store/ens/names';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { TransferLandModal } from '.';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/landTransactions', async importOriginal => ({
  ...(await importOriginal<object>()),
  sendLandTransaction: vi.fn(() => new Promise(() => {})),
}));
vi.mock('/@/modules/store/ens/names', async importOriginal => ({
  ...(await importOriginal<object>()),
  resolveNameOwner: vi.fn(),
}));
vi.mock('../WorldPermissionsModal/WorldPermissionsAvatarWithInfo', () => ({
  WorldPermissionsAvatarWithInfo: () => null,
}));

const SELF = '0x1234567890123456789012345678901234567890';
const BEN = '0x00000000000000000000000000000000000000b2';

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
  owner: SELF,
  operators: [],
  updateOperator: null,
};

async function confirmTransferToBen() {
  vi.mocked(resolveNameOwner).mockResolvedValueOnce(BEN);
  fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
    target: { value: 'fixtureben' },
  });
  await waitFor(
    () =>
      expect(screen.getByRole('button', { name: 'Transfer LAND' })).toHaveProperty(
        'disabled',
        false,
      ),
    { timeout: 3000 },
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Transfer LAND' }));
  });
}

describe('TransferLandModal', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ wallet: SELF } as unknown as ReturnType<typeof useAuth>);
    render(
      <Provider store={createTestStore() as never}>
        <ThemeProvider theme={dark}>
          <TransferLandModal
            open
            land={land}
            name="Land Name"
            onClose={() => {}}
          />
        </ThemeProvider>
      </Provider>,
    );
  });

  afterEach(cleanup);

  describe('when it opens', () => {
    it('should name the recipient field by its placeholder, with no visible label', () => {
      const field = screen.getByRole('textbox', { name: 'Wallet address or NAME' });

      expect(field.getAttribute('placeholder')).toBe('Wallet address or NAME');
      expect(document.querySelector('label')).toBeNull();
    });

    it('should block the transfer until a recipient resolves', () => {
      expect(screen.getByRole('dialog', { name: 'Transfer LAND' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Transfer LAND' })).toHaveProperty(
        'disabled',
        true,
      );
    });
  });

  describe('when a NAME resolves and the transfer is confirmed', () => {
    beforeEach(confirmTransferToBen);

    it('should send the transfer to the NAME owner and wait for the signature', () => {
      expect(vi.mocked(sendLandTransaction).mock.calls[0][0].data).toContain(BEN.slice(2));
      expect(screen.getByRole('status').textContent).toBe(
        'Confirm this transaction in your browser.',
      );
    }, 15_000);

    it('should keep the corner close while waiting', () => {
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    }, 15_000);
  });

  describe.each([
    ['done', 'confirmed', 'LAND transferred.'],
    ['unconfirmed', 'timeout', 'Not confirmed yet.'],
  ])('when the transfer ends %s', (_phase, status, text) => {
    beforeEach(async () => {
      vi.mocked(sendLandTransaction).mockResolvedValueOnce({
        hash: `0x${'1'.padStart(64, '0')}`,
        status,
      } as never);
      await confirmTransferToBen();
      await screen.findByText(text, { exact: false });
    });

    it('should offer exactly one Close', () => {
      expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    }, 15_000);
  });
});
