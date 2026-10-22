import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { CreatorIneligibleReason, TERMS_VERSION, creatorFundApi } from '/@/lib/creatorFund';
import { TERMS_TITLE } from '/@/lib/creatorFund/terms';

import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';

import { JoinModal } from './component';

const ADDRESS = '0x1234567890123456789012345678901234567890';

vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

vi.mock('/@/hooks/useAuth', () => ({
  useAuth: () => ({ isSignedIn: true, wallet: ADDRESS }),
}));

/** The ui2 modal shell reads breakpoints this environment does not populate, and the
 * flow lives in the steps, not the chrome: render title, body and actions plainly. */
vi.mock('../../Modals', () => ({
  Modal: ({
    open,
    title,
    children,
    actions,
  }: {
    open: boolean;
    title?: string;
    children: ReactNode;
    actions?: ReactNode;
  }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        {children}
        <div role="group">{actions}</div>
      </div>
    ) : null,
}));

/** jsdom lays nothing out, so give the terms box a real overflow to scroll through. */
function giveTermsOverflow() {
  const sizes = { scrollHeight: 1000, clientHeight: 360 };
  for (const [prop, value] of Object.entries(sizes)) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('Terms') ? value : 0;
      },
    });
  }
}

function restoreLayout() {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
}

describe('JoinModal', () => {
  let store: TestStore;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <MemoryRouter>{children}</MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

  const renderModal = () => {
    render(
      <JoinModal
        open
        initialStep="checking"
        onClose={vi.fn()}
        onSetUpWallet={vi.fn()}
      />,
      { wrapper },
    );
  };

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(creatorFundApi, 'getEnrollment').mockResolvedValue(null);
    vi.spyOn(creatorFundApi, 'getPayoutWallet').mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the backoffice rejects the creator', () => {
    beforeEach(() => {
      vi.spyOn(creatorFundApi, 'getCreatorEligibility').mockResolvedValue({
        address: ADDRESS,
        eligible: false,
        reasons: [CreatorIneligibleReason.SUSPENDED],
      });
    });

    it('should show the spinner, then say they are not eligible', async () => {
      renderModal();

      expect(screen.getByRole('status').textContent).toContain('Checking your eligibility');
      expect(
        await screen.findByText('Sorry, you are not eligible to join the Creator Fund'),
      ).toBeDefined();
      expect(screen.queryByRole('document', { name: TERMS_TITLE })).toBeNull();
    });
  });

  describe('when the creator is eligible', () => {
    beforeEach(() => {
      giveTermsOverflow();
      vi.spyOn(creatorFundApi, 'getCreatorEligibility').mockResolvedValue({
        address: ADDRESS,
        eligible: true,
        reasons: [],
      });
      vi.spyOn(creatorFundApi, 'enroll').mockResolvedValue({
        address: ADDRESS,
        enrolled_at: '2026-10-22T00:00:00.000Z',
        terms_version: TERMS_VERSION,
      });
    });

    afterEach(() => {
      restoreLayout();
    });

    it('should lock acceptance until the terms are scrolled to the end, and join once accepted', async () => {
      renderModal();

      const terms = await screen.findByRole('document', { name: TERMS_TITLE });
      const accept = screen.getByRole('checkbox', {
        name: 'I have read and accept the Creator Fund Program Terms',
      }) as HTMLInputElement;
      const join = screen.getByRole('button', { name: 'Join Creator Fund' }) as HTMLButtonElement;
      expect(accept.disabled).toBe(true);
      expect(join.disabled).toBe(true);

      terms.scrollTop = 200;
      fireEvent.scroll(terms);
      expect(accept.disabled).toBe(true);

      terms.scrollTop = 640;
      fireEvent.scroll(terms);
      await waitFor(() => expect(accept.disabled).toBe(false));
      expect(join.disabled).toBe(true);

      fireEvent.click(accept);
      await waitFor(() => expect(join.disabled).toBe(false));
      fireEvent.click(join);

      expect(await screen.findByText('Welcome to the Creator Fund')).toBeDefined();
      expect(creatorFundApi.enroll).toHaveBeenCalledWith(ADDRESS, TERMS_VERSION);
    });
  });
});
