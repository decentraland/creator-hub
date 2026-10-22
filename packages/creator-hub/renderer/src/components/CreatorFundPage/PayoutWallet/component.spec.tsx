import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { creatorFundApi } from '/@/lib/creatorFund';
import { actions } from '/@/modules/store/creatorFund';

import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';

import { PayoutWallet } from './component';

const ADDRESS = '0x1234567890123456789012345678901234567890';
const SAVED = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const NEW_WALLET = '0x9999999999999999999999999999999999999999';

vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

vi.mock('/@/hooks/useAuth', () => ({
  useAuth: () => ({ isSignedIn: true, wallet: ADDRESS }),
}));

const getInput = () => screen.getByRole('textbox', { name: 'Payout wallet' }) as HTMLInputElement;

describe('PayoutWallet', () => {
  let store: TestStore;

  /** Keyed on the saved record, as the page does, so a save starts a fresh draft. */
  const renderWallet = () => {
    const view = () => (
      <Provider store={store}>
        <ThemeProvider theme={dark}>
          <PayoutWallet key={store.getState().creatorFund.payoutWallet?.updated_at ?? 'none'} />
        </ThemeProvider>
      </Provider>
    );
    const { rerender } = render(view());
    return () => rerender(view());
  };

  beforeEach(async () => {
    store = createTestStore();
    vi.spyOn(creatorFundApi, 'getEnrollment').mockResolvedValue(null);
    vi.spyOn(creatorFundApi, 'getPayoutWallet').mockResolvedValue({
      address: SAVED,
      updated_at: '2026-10-22T00:00:00.000Z',
    });
    vi.spyOn(creatorFundApi, 'setPayoutWallet').mockImplementation(async (_address, wallet) => ({
      address: wallet,
      updated_at: '2026-10-22T01:00:00.000Z',
    }));
    await store.dispatch(actions.loadCreatorFund({ address: ADDRESS }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when a wallet is saved', () => {
    it('should show it locked, so it cannot be edited by accident', () => {
      renderWallet();

      expect(getInput().value).toBe(SAVED);
      expect(getInput().disabled).toBe(true);
    });
  });

  describe('when the lock is toggled open', () => {
    it('should make the field editable and put the cursor in it', async () => {
      renderWallet();

      fireEvent.click(screen.getByRole('button', { name: 'Unlock to edit' }));

      await waitFor(() => expect(getInput().disabled).toBe(false));
      expect(document.activeElement).toBe(getInput());
      expect(creatorFundApi.setPayoutWallet).not.toHaveBeenCalled();
    });
  });

  describe('when an invalid address is locked', () => {
    it('should refuse to save it and say why', async () => {
      renderWallet();
      fireEvent.click(screen.getByRole('button', { name: 'Unlock to edit' }));
      fireEvent.change(getInput(), { target: { value: 'not-a-wallet' } });

      fireEvent.click(screen.getByRole('button', { name: 'Lock payout wallet' }));

      expect(await screen.findByText('Enter a valid wallet address')).toBeDefined();
      expect(getInput().disabled).toBe(false);
      expect(creatorFundApi.setPayoutWallet).not.toHaveBeenCalled();
    });
  });

  describe('when a new valid address is locked', () => {
    it('should save it and lock the field again', async () => {
      const rerender = renderWallet();
      fireEvent.click(screen.getByRole('button', { name: 'Unlock to edit' }));
      fireEvent.change(getInput(), { target: { value: NEW_WALLET } });

      fireEvent.click(screen.getByRole('button', { name: 'Lock payout wallet' }));

      await waitFor(() =>
        expect(store.getState().creatorFund.payoutWallet?.address).toBe(NEW_WALLET),
      );
      rerender();
      expect(creatorFundApi.setPayoutWallet).toHaveBeenCalledWith(ADDRESS, NEW_WALLET);
      expect(getInput().value).toBe(NEW_WALLET);
      expect(getInput().disabled).toBe(true);
    });
  });
});
