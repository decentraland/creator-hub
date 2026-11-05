import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Enrollment, PayoutWallet } from '/shared/types/creator-fund';

import { misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';
import { Worlds } from '/@/lib/worlds';

import { createTestStore } from '../../../../tests/utils/testStore';
import {
  CYCLES,
  LATEST_CLOSED,
  OLDEST_CLOSED,
  exampleWorld,
  fail,
  ok,
  payout,
  place,
} from './fixtures';
import { PayoutsTab } from './PayoutsTab';

vi.mock('/@/lib/creatorFundApi', () => ({
  getCycles: vi.fn(),
  getEnrollment: vi.fn(),
  getPayouts: vi.fn(),
  getPayoutWallet: vi.fn(),
  putPayoutWallet: vi.fn(),
  postEmailVerification: vi.fn(),
  putEmailVerification: vi.fn(),
}));
vi.mock('/@/lib/worlds', () => ({ Worlds: vi.fn() }));
Worlds.prototype.fetchWorldScenes = vi.fn();

const ENROLLMENT: Enrollment = {
  status: 'active',
  enrolled_at: '2026-10-30T14:02:11Z',
  terms_version: 1,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
};

const WALLET: PayoutWallet = {
  address: '0x000000000000000000000000000000000000dEaD',
  updated_at: '2026-10-21T09:00:00Z',
};

const NEW_ADDRESS = '0x0000000000000000000000000000000000000002';

const PAYOUTS = [
  payout(LATEST_CLOSED, 'pending', [
    [place('a', { title: 'Example Place A' }), 9],
    [exampleWorld('w', { title: 'Example Karaoke', base_position: '2,1' }), 13],
  ]),
  payout(OLDEST_CLOSED, 'paid', [[place('b', { title: 'Example Place B' }), 5]]),
];

async function renderTab() {
  const store = createTestStore();
  render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <PayoutsTab />
      </ThemeProvider>
    </Provider>,
  );
  return store;
}

const cycleButton = (name: string) => screen.getByRole('button', { name });

/*
 * Each case renders the tab and its modals and queries them by role and accessible name, which
 * takes seconds on a loaded CI runner; vitest's default 5 s cut cases off there while passing.
 */
vi.setConfig({ testTimeout: 15_000 });

describe('PayoutsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getCycles).mockResolvedValue(ok(CYCLES));
    vi.mocked(api.getEnrollment).mockResolvedValue(ok(ENROLLMENT));
    vi.mocked(api.getPayouts).mockResolvedValue(ok({ payouts: PAYOUTS }));
    vi.mocked(api.getPayoutWallet).mockResolvedValue(ok(WALLET));
    vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue({ scenes: [], total: 3 } as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when there are payouts', () => {
    it('should list them in a table with the newest cycle open and the others closed', async () => {
      await renderTab();

      const table = await screen.findByRole('table', { name: 'Payouts' });
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map(header => header.textContent),
      ).toEqual(['Cycle', 'Status', 'Paid Places', 'Amount', 'Transaction']);
      expect(cycleButton('Oct 16 - Oct 31, 2026').getAttribute('aria-expanded')).toBe('true');
      expect(cycleButton('Oct 1 - Oct 15, 2026').getAttribute('aria-expanded')).toBe('false');
      expect(within(table).getByText('22 USDC')).toBeTruthy();
      expect(within(table).getByText('9 USDC')).toBeTruthy();
      expect(within(table).getByText('Example Place A')).toBeTruthy();
      expect(within(table).queryByText('Example Place B')).toBeNull();
    });

    it('should show a payout with cents to the cent, never rounded to whole USDC', async () => {
      vi.mocked(api.getPayouts).mockResolvedValue(
        ok({
          payouts: [
            payout(LATEST_CLOSED, 'paid', [
              [place('a', { title: 'Example Place A' }), 1842.5],
              [place('c', { title: 'Example Place C' }), 0.49],
            ]),
          ],
        }),
      );
      await renderTab();

      const table = await screen.findByRole('table', { name: 'Payouts' });
      expect(within(table).getByText('1,842.99 USDC')).toBeTruthy();
      expect(within(table).getByText('1,842.50 USDC')).toBeTruthy();
      expect(within(table).getByText('0.49 USDC')).toBeTruthy();
    });

    it('should open a second row while the first stays open', async () => {
      await renderTab();
      await screen.findByRole('table', { name: 'Payouts' });

      fireEvent.click(cycleButton('Oct 1 - Oct 15, 2026'));

      expect(cycleButton('Oct 1 - Oct 15, 2026').getAttribute('aria-expanded')).toBe('true');
      expect(cycleButton('Oct 16 - Oct 31, 2026').getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Example Place B')).toBeTruthy();
    });

    it('should name a scene in a World of several scenes by its parcel', async () => {
      await renderTab();

      expect(await screen.findByText('example-world.dcl.eth - 2,1')).toBeTruthy();
    });

    it('should show each status and open a paid transaction on Etherscan, with no button on a pending one', async () => {
      await renderTab();
      const table = await screen.findByRole('table', { name: 'Payouts' });
      const rowOf = (status: string) =>
        within(within(table).getByText(status).closest('[role="row"]') as HTMLElement);
      const etherscan = { name: 'View transaction on Etherscan' };

      expect(within(table).getAllByRole('button', etherscan)).toHaveLength(1);
      expect(rowOf('Pending').queryByRole('button', etherscan)).toBeNull();
      expect(rowOf('Pending').getAllByRole('cell')).toHaveLength(5);

      fireEvent.click(rowOf('Paid').getByRole('button', etherscan));

      expect(misc.openExternal).toHaveBeenCalledTimes(1);
      expect(misc.openExternal).toHaveBeenCalledWith(
        `https://etherscan.io/tx/0x${'1'.padStart(64, '0')}`,
      );
    });
  });

  describe('when there are no payouts yet', () => {
    it('should say the first one comes after the running cycle', async () => {
      vi.mocked(api.getPayouts).mockResolvedValue(ok({ payouts: [] }));

      await renderTab();

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Your rewards journey starts here!' }),
      ).toBeTruthy();
      expect(
        screen.getByText('Your first payout is coming after the Nov 1 - Nov 15 cycle ends.'),
      ).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
    });
  });

  describe('when the payouts fail to load', () => {
    it('should offer a retry', async () => {
      vi.mocked(api.getPayouts).mockResolvedValueOnce(fail(500));

      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('table', { name: 'Payouts' })).toBeTruthy();
    });
  });

  describe('when the payout wallet is set', () => {
    it('should show it short, with the whole address as its title, a copy button and EDIT', async () => {
      await renderTab();

      const address = await screen.findByText('0x00000...00dEaD');
      expect(address.getAttribute('title')).toBe(WALLET.address);
      expect(screen.getByRole('button', { name: 'Copy wallet address' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Add wallet' })).toBeNull();
    });

    it('should copy the whole address from a real button, not one nested in another', async () => {
      await renderTab();
      const copy = await screen.findByRole('button', { name: 'Copy wallet address' });

      fireEvent.click(copy);

      expect(copy.tagName).toBe('BUTTON');
      expect(copy.parentElement?.closest('[role="button"], button')).toBeNull();
      expect(misc.copyToClipboard).toHaveBeenCalledWith(WALLET.address);
    });

    it('should keep focus on EDIT after the change', async () => {
      vi.mocked(api.putPayoutWallet).mockResolvedValue(
        ok({ address: NEW_ADDRESS, updated_at: '2026-11-04T10:00:00Z' }),
      );
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      const dialog = await screen.findByRole('dialog', { name: 'Change payout wallet' });
      fireEvent.change(within(dialog).getByLabelText('Wallet address'), {
        target: { value: NEW_ADDRESS },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit' })),
      );
    });

    it('should change it and say so', async () => {
      vi.mocked(api.putPayoutWallet).mockResolvedValue(
        ok({ address: NEW_ADDRESS, updated_at: '2026-11-04T10:00:00Z' }),
      );
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      const dialog = await screen.findByRole('dialog', { name: 'Change payout wallet' });

      fireEvent.change(within(dialog).getByLabelText('Wallet address'), {
        target: { value: NEW_ADDRESS },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect((await screen.findByRole('status')).textContent).toBe('Payout wallet updated');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('0x00000...000002')).toBeTruthy();
      expect(api.getPayoutWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe('when there is no payout wallet', () => {
    beforeEach(() => {
      vi.mocked(api.getPayoutWallet).mockResolvedValue(fail(404));
    });

    it('should offer only ADD WALLET', async () => {
      await renderTab();

      expect(await screen.findByRole('button', { name: 'Add wallet' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Copy wallet address' })).toBeNull();
    });

    it('should hold the submit until the address is valid and flag a bad one on blur', async () => {
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Add wallet' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add payout wallet' });
      const field = within(dialog).getByLabelText('Wallet address');
      const submit = within(dialog).getByRole('button', { name: 'Add wallet' });

      fireEvent.change(field, { target: { value: '0x123' } });
      fireEvent.blur(field);

      expect(submit.hasAttribute('disabled')).toBe(true);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(
        within(dialog).getByText(
          'Invalid wallet address. It should start with 0x and be 42 characters long.',
        ),
      ).toBeTruthy();
      expect(within(dialog).getByRole('note').textContent).toMatch(/ERC-20/);

      fireEvent.change(field, { target: { value: NEW_ADDRESS } });

      expect(submit.hasAttribute('disabled')).toBe(false);
    });

    it('should add one and say so', async () => {
      vi.mocked(api.putPayoutWallet).mockResolvedValue(
        ok({ address: NEW_ADDRESS, updated_at: '2026-11-04T10:00:00Z' }, 201),
      );
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Add wallet' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add payout wallet' });

      fireEvent.change(within(dialog).getByLabelText('Wallet address'), {
        target: { value: NEW_ADDRESS },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add wallet' }));

      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe('Payout wallet added'),
      );
      expect(api.putPayoutWallet).toHaveBeenCalledWith({ address: NEW_ADDRESS });
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit' })),
      );
    });

    it('should show the refusal of an address on the field', async () => {
      vi.mocked(api.putPayoutWallet).mockResolvedValue({
        ...fail(400),
        body: { error: 'invalid_address' },
      });
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Add wallet' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add payout wallet' });

      fireEvent.change(within(dialog).getByLabelText('Wallet address'), {
        target: { value: NEW_ADDRESS },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add wallet' }));

      const field = within(dialog).getByLabelText('Wallet address');
      await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
      const line = document.getElementById(field.getAttribute('aria-describedby')!)!;
      expect(line.getAttribute('aria-live')).toBe('polite');
      expect(line.textContent).toBe(
        'Invalid wallet address. It should start with 0x and be 42 characters long.',
      );
      expect(document.activeElement).toBe(field);
    });

    it('should close on Escape', async () => {
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Add wallet' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add payout wallet' });

      fireEvent.keyDown(dialog, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  describe('when the email is not verified', () => {
    beforeEach(() => {
      vi.mocked(api.postEmailVerification).mockResolvedValue(
        ok(
          {
            sent_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 600e3).toISOString(),
            resend_available_at: new Date(Date.now() + 60e3).toISOString(),
          },
          202,
        ),
      );
    });

    async function openVerify() {
      await renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Verify email' }));
      return screen.findByRole('dialog', { name: 'Verify your email' });
    }

    const typeCode = (dialog: HTMLElement, code: string) =>
      fireEvent.paste(within(dialog).getByRole('textbox', { name: 'Digit 1 of 6' }), {
        clipboardData: { getData: () => code },
      });

    it('should show the contact values with the Unverified badge', async () => {
      await renderTab();

      expect(await screen.findByText('Jane Doe')).toBeTruthy();
      expect(screen.getByText('jane.doe@example.com')).toBeTruthy();
      expect(screen.getByText('Unverified')).toBeTruthy();
    });

    it('should send a code on open and hold Resend Code', async () => {
      const dialog = await openVerify();

      expect(api.postEmailVerification).toHaveBeenCalledTimes(1);
      expect(within(dialog).getByText('jane.doe@example.com').tagName).toBe('B');
      expect(document.activeElement).toBe(
        within(dialog).getByRole('textbox', { name: 'Digit 1 of 6' }),
      );
      await waitFor(() =>
        expect(
          within(dialog).getByRole('button', { name: 'Resend Code' }).getAttribute('aria-disabled'),
        ).toBe('true'),
      );
      expect(within(dialog).getByRole('button', { name: 'Verify' }).hasAttribute('disabled')).toBe(
        true,
      );
    });

    it('should verify the code, say so and drop the badge and VERIFY EMAIL', async () => {
      vi.mocked(api.putEmailVerification).mockResolvedValue(
        ok({ ...ENROLLMENT, email_verified_at: '2026-11-04T10:02:00Z' }),
      );
      const dialog = await openVerify();

      typeCode(dialog, '000000');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));

      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Email verified'));
      expect(api.putEmailVerification).toHaveBeenCalledWith({ code: '000000' });
      expect(screen.queryByText('Unverified')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Verify email' })).toBeNull();
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { level: 2, name: 'Contact Information' }),
        ),
      );
    });

    it('should keep Resend Code under an expired code and let it send a new one', async () => {
      vi.mocked(api.putEmailVerification).mockResolvedValue({
        ...fail(410),
        body: { error: 'code_expired' },
      });
      vi.mocked(api.postEmailVerification)
        .mockResolvedValueOnce(
          ok(
            {
              sent_at: '2026-11-04T09:00:00Z',
              expires_at: '2026-11-04T09:10:00Z',
              resend_available_at: '2026-11-04T09:01:00Z',
            },
            202,
          ),
        )
        .mockResolvedValue(
          ok(
            {
              sent_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 600e3).toISOString(),
              resend_available_at: new Date(Date.now() + 60e3).toISOString(),
            },
            202,
          ),
        );
      const dialog = await openVerify();
      typeCode(dialog, '123456');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));
      await within(dialog).findByRole('alert');

      const resend = within(dialog).getByRole('button', { name: 'Resend Code' });
      expect(resend.getAttribute('aria-disabled')).toBeNull();
      fireEvent.click(resend);

      await waitFor(() => expect(api.postEmailVerification).toHaveBeenCalledTimes(2));
      expect(within(dialog).queryByRole('alert')).toBeNull();
    });

    it('should say a failed send on the error line and keep Resend Code to try again', async () => {
      vi.mocked(api.postEmailVerification)
        .mockResolvedValueOnce(fail(500))
        .mockResolvedValue(
          ok(
            {
              sent_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 600e3).toISOString(),
              resend_available_at: new Date(Date.now() + 60e3).toISOString(),
            },
            202,
          ),
        );
      const dialog = await openVerify();

      expect((await within(dialog).findByRole('alert')).textContent).toBe(
        'Something went wrong. Please try again.',
      );
      const resend = within(dialog).getByRole('button', { name: 'Resend Code' });
      expect(resend.getAttribute('aria-disabled')).toBeNull();
      fireEvent.click(resend);

      await waitFor(() => expect(api.postEmailVerification).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull());
    });

    it.each([
      [400, 'invalid_code', 'Incorrect Code. Check the email and try again.'],
      [429, 'too_many_attempts', 'Something went wrong. Please try again.'],
    ])('should explain a %s %s', async (status, error, message) => {
      vi.mocked(api.putEmailVerification).mockResolvedValue({ ...fail(status), body: { error } });
      const dialog = await openVerify();

      typeCode(dialog, '123456');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));

      expect((await within(dialog).findByRole('alert')).textContent).toBe(message);
      expect(
        within(dialog).getByRole('textbox', { name: 'Digit 1 of 6' }).getAttribute('aria-invalid'),
      ).toBe('true');
      expect(within(dialog).queryByRole('button', { name: 'Resend Code' })).toBeNull();
    });
  });

  describe.each([
    ['payout wallet', () => vi.mocked(api.getPayoutWallet)],
    ['enrollment', () => vi.mocked(api.getEnrollment)],
  ])('when the %s fails to load', (_name, mocked) => {
    it('should show the tab error instead of empty cards, and retry', async () => {
      mocked().mockResolvedValueOnce(fail(500));

      await renderTab();

      expect((await screen.findByRole('alert')).textContent).toBe("Couldn't load your payouts.");
      expect(screen.queryByRole('heading', { name: 'Payout Wallet' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('heading', { name: 'Payout Wallet' })).toBeTruthy();
    });
  });

  describe('when a cycle row is closed', () => {
    it('should point its disclosure at no rows, and span the place cell over three columns', async () => {
      await renderTab();
      await screen.findByRole('table', { name: 'Payouts' });

      expect(cycleButton('Oct 1 - Oct 15, 2026').hasAttribute('aria-controls')).toBe(false);
      const controls = cycleButton('Oct 16 - Oct 31, 2026').getAttribute('aria-controls')!;
      expect(controls.split(' ').every(id => document.getElementById(id))).toBe(true);
      expect(
        within(document.getElementById(controls.split(' ')[0])!)
          .getAllByRole('cell')[0]
          .getAttribute('aria-colspan'),
      ).toBe('3');
    });
  });

  describe('when the email is verified', () => {
    it('should hide the badge and VERIFY EMAIL', async () => {
      vi.mocked(api.getEnrollment).mockResolvedValue(
        ok({ ...ENROLLMENT, email_verified_at: '2026-10-30T15:00:00Z' }),
      );

      await renderTab();

      expect(await screen.findByText('Jane Doe')).toBeTruthy();
      expect(screen.queryByText('Unverified')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Verify email' })).toBeNull();
    });
  });
});
