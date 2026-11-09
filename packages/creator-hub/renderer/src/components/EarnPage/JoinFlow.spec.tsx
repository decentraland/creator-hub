import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';

import { tracked, trackedAnyOf } from '../../../tests/utils/analytics';
import { createTestStore } from '../../../tests/utils/testStore';
import { JoinFlow } from './JoinFlow';

vi.mock('/@/lib/creatorFundApi', () => ({
  getTerms: vi.fn(),
  getEligibility: vi.fn(),
  putEnrollment: vi.fn(),
}));
vi.mock('../Modals', async importOriginal => ({
  ...((await importOriginal()) as object),
  Modal: ({
    open,
    children,
    className,
  }: {
    open: boolean;
    children: React.ReactNode;
    className?: string;
  }) => (open ? <div className={className}>{children}</div> : null),
}));

const TERMS = {
  version: 1,
  published_at: '2026-11-03T00:00:00Z',
  title: 'Example Program Terms (Beta)',
  content: '## 1. About the Program\n\nPlaceholder.',
};

const ok = <T,>(data: T, status = 200) => ({ ok: true as const, status, data });
const fail = (status: number, body?: object) => ({
  ok: false as const,
  status,
  error: (body as { message?: string })?.message ?? 'boom',
  body: body as any,
});

const ENROLLMENT = {
  status: 'active' as const,
  enrolled_at: '2026-11-03T10:00:00Z',
  terms_version: 1,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
};

const renderFlow = () => {
  const onExit = vi.fn();
  const store = createTestStore();
  render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <JoinFlow onExit={onExit} />
      </ThemeProvider>
    </Provider>,
  );
  return { onExit, store };
};

/*
 * The steps below find their controls by label and text, not by role and name: computing every
 * accessible name in the modal made each full flow take over 5 s on a loaded CI runner.
 */
async function acceptTerms() {
  fireEvent.click(await screen.findByLabelText(/I have read/));
  fireEvent.click(screen.getByText('Accept & Join'));
}

function fillContact() {
  const type = (label: RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type(/First Name/, 'Jane');
  type(/Last Name/, 'Doe');
  type(/Email/, 'jane.doe@example.com');
  fireEvent.click(screen.getByText('Submit'));
}

describe('JoinFlow', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getTerms).mockResolvedValue(ok(TERMS));
    vi.mocked(api.getEligibility).mockResolvedValue(ok({ eligible: true, reasons: [] }));
    vi.mocked(api.putEnrollment).mockResolvedValue(ok(ENROLLMENT, 201));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when it starts', () => {
    it('should check eligibility behind a single labelled spinner', async () => {
      vi.mocked(api.getEligibility).mockReturnValue(new Promise(() => {}));
      renderFlow();

      const progressbar = screen.getByRole('progressbar', { name: 'Checking eligibility' });
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
      expect(progressbar.querySelector('svg')?.closest('[aria-hidden="true"]')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Decentraland Creator Fund' })).toBeTruthy();
      expect(api.getEligibility).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user closes the check', () => {
    it('should cancel and ignore the answer', async () => {
      let answer: (value: unknown) => void = () => {};
      vi.mocked(api.getEligibility).mockReturnValue(new Promise(r => (answer = r)) as any);
      const { onExit } = renderFlow();

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await act(async () => answer(ok({ eligible: true, reasons: [] })));

      expect(onExit).toHaveBeenCalledWith('cancelled');
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('region', { name: 'Program Terms' })).toBeNull();
    });
  });

  describe('when the check fails', () => {
    const CHECK_FAILED = 'Something went wrong while checking your account';

    beforeEach(() => {
      vi.mocked(api.getEligibility).mockResolvedValue(fail(500));
    });

    it('should say so in a modal with the support address', async () => {
      const { onExit } = renderFlow();

      const dialog = await screen.findByRole('alertdialog', { name: CHECK_FAILED });
      const description = document.getElementById(dialog.getAttribute('aria-describedby')!);
      expect(description?.textContent).toBe(
        'If the issue persists, contact our support team at creatorfund@decentraland.org',
      );
      expect(screen.getByText('creatorfund@decentraland.org').getAttribute('href')).toBe(
        'mailto:creatorfund@decentraland.org',
      );
      expect(onExit).not.toHaveBeenCalled();
    });

    it('should check again from RETRY', async () => {
      renderFlow();
      await screen.findByRole('alertdialog', { name: CHECK_FAILED });
      vi.mocked(api.getEligibility).mockReturnValue(new Promise(() => {}));

      fireEvent.click(screen.getByText('Retry'));

      expect(await screen.findByRole('progressbar', { name: 'Checking eligibility' })).toBeTruthy();
      expect(api.getEligibility).toHaveBeenCalledTimes(2);
    });

    it('should open the terms when the retried check passes', async () => {
      renderFlow();
      await screen.findByRole('alertdialog', { name: CHECK_FAILED });
      vi.mocked(api.getEligibility).mockResolvedValue(ok({ eligible: true, reasons: [] }));

      fireEvent.click(screen.getByText('Retry'));

      expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
    });

    it.each([
      ['CLOSE', () => fireEvent.click(screen.getByText('Close'))],
      ['the X', () => fireEvent.click(screen.getByLabelText('Close'))],
      ['Escape', () => fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })],
    ])('should exit as cancelled from %s', async (_, dismiss) => {
      const { onExit } = renderFlow();
      await screen.findByRole('alertdialog', { name: CHECK_FAILED });

      dismiss();

      expect(onExit).toHaveBeenCalledWith('cancelled');
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user is not eligible', () => {
    it.each([
      ['internal', "Foundation and Regenesis Labs accounts can't join the Creator Fund."],
      ['suspended', 'Your account is suspended from the Creator Fund.'],
      ['excluded', "Your account isn't eligible for the Creator Fund."],
      ['a_new_code', "Your account can't join the Creator Fund right now."],
    ])('should explain %s', async (reason, copy) => {
      vi.mocked(api.getEligibility).mockResolvedValue(ok({ eligible: false, reasons: [reason] }));
      const { onExit } = renderFlow();

      const dialog = await screen.findByRole('alertdialog', { name: "You can't join yet" });
      const description = document.getElementById(dialog.getAttribute('aria-describedby')!);
      expect(description?.textContent).toBe(copy);

      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
      expect(onExit).toHaveBeenCalledWith('cancelled');
    });

    it('should exit as cancelled from the X, as from GOT IT', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue(
        ok({ eligible: false, reasons: ['internal'] }),
      );
      const { onExit } = renderFlow();
      await screen.findByRole('alertdialog', { name: "You can't join yet" });

      fireEvent.click(screen.getByLabelText('Close'));

      expect(onExit).toHaveBeenCalledWith('cancelled');
    });

    it('should list every reason', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue(
        ok({ eligible: false, reasons: ['internal', 'excluded'] }),
      );
      renderFlow();

      await screen.findByRole('alertdialog', { name: "You can't join yet" });
      expect(
        screen.getByText("Foundation and Regenesis Labs accounts can't join the Creator Fund."),
      ).toBeTruthy();
      expect(screen.getByText("Your account isn't eligible for the Creator Fund.")).toBeTruthy();
    });
  });

  describe('when the user is eligible', () => {
    it('should ask to accept the terms', async () => {
      renderFlow();

      expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Accept & Join' })).toBeTruthy();
    });

    it('should exit as cancelled from NOT NOW', async () => {
      const { onExit } = renderFlow();
      fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
      expect(onExit).toHaveBeenCalledWith('cancelled');
    });
  });

  describe('when the terms are accepted and the contact info sent', () => {
    it('should PUT the enrollment once on the accepted version and welcome the user', async () => {
      renderFlow();
      await acceptTerms();
      fillContact();

      expect(
        await screen.findByRole('heading', { name: 'Welcome to the Creator Fund' }),
      ).toBeTruthy();
      expect(api.putEnrollment).toHaveBeenCalledTimes(1);
      expect(api.putEnrollment).toHaveBeenCalledWith({
        terms_version: 1,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
      });
    });

    it.each([["Let's go"], ['Close']])('should land on My Places from %s', async name => {
      const { onExit } = renderFlow();
      await acceptTerms();
      fillContact();
      await screen.findByRole('heading', { name: 'Welcome to the Creator Fund' });

      fireEvent.click(screen.getByRole('button', { name }));

      expect(onExit).toHaveBeenCalledWith('joined');
    });
  });

  describe('when SUBMIT is pressed twice while the enrollment runs', () => {
    it('should PUT only once', async () => {
      vi.mocked(api.putEnrollment).mockReturnValue(new Promise(() => {}));
      renderFlow();
      await acceptTerms();
      fillContact();
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      expect(api.putEnrollment).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Submit' }).getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('when the enrollment is refused as a bad request', () => {
    it("should show only the generic line, never the service's message", async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue(
        fail(400, { error: 'Bad Request', message: 'email must be a valid address' }),
      );
      renderFlow();
      await acceptTerms();
      fillContact();

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Something went wrong. Please try again.',
      );
      expect(screen.queryByText('email must be a valid address')).toBeNull();
    });
  });

  describe('when the terms changed while the user filled the contact info', () => {
    it('should load the new terms and go back to accept them', async () => {
      vi.mocked(api.putEnrollment)
        .mockResolvedValueOnce(
          fail(400, { error: 'Bad Request', message: 'terms_version must be 2' }),
        )
        .mockResolvedValue(ok(ENROLLMENT, 201));
      renderFlow();
      await acceptTerms();
      vi.mocked(api.getTerms).mockResolvedValue(ok({ ...TERMS, version: 2 }));
      fillContact();

      expect(
        await screen.findByRole('button', { name: 'Accept & Join' }, { timeout: 5000 }),
      ).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      await acceptTerms();
      fillContact();

      await screen.findByRole(
        'heading',
        { name: 'Welcome to the Creator Fund' },
        { timeout: 5000 },
      );
      expect(vi.mocked(api.putEnrollment).mock.calls.map(([body]) => body.terms_version)).toEqual([
        1, 2,
      ]);
    }, 15_000);
  });

  describe('when the flow goes back to the terms', () => {
    it('should keep the contact details the user already typed', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValueOnce(
        fail(400, { error: 'Bad Request', message: 'terms_version must be 2' }),
      );
      renderFlow();
      await acceptTerms();
      vi.mocked(api.getTerms).mockResolvedValue(ok({ ...TERMS, version: 2 }));
      fillContact();
      await screen.findByRole('button', { name: 'Accept & Join' }, { timeout: 5000 });

      await acceptTerms();

      const value = (label: RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;
      expect(value(/First Name/)).toBe('Jane');
      expect(value(/Last Name/)).toBe('Doe');
      expect(value(/Email/)).toBe('jane.doe@example.com');
    }, 15_000);
  });

  describe('when the user leaves while the enrollment is saved', () => {
    it('should exit once, as cancelled, whatever the answer', async () => {
      let answer: (value: unknown) => void = () => {};
      vi.mocked(api.putEnrollment).mockReturnValue(new Promise(r => (answer = r)) as any);
      const { onExit } = renderFlow();
      await acceptTerms();
      fillContact();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await act(async () => answer(fail(409, { error: 'Conflict', message: 'already enrolled' })));

      expect(onExit).toHaveBeenCalledTimes(1);
      expect(onExit).toHaveBeenCalledWith('cancelled');
    });
  });

  describe('when the enrollment fails otherwise', () => {
    it('should show the generic line', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue(fail(500));
      renderFlow();
      await acceptTerms();
      fillContact();

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Something went wrong. Please try again.',
      );
    });
  });

  describe('when the enrollment finds the user ineligible', () => {
    it('should show the reasons', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue(
        fail(403, { error: 'Forbidden', message: 'Not eligible', reasons: ['excluded'] }),
      );
      renderFlow();
      await acceptTerms();
      fillContact();

      expect(await screen.findByRole('alertdialog', { name: "You can't join yet" })).toBeTruthy();
      expect(screen.getByText("Your account isn't eligible for the Creator Fund.")).toBeTruthy();
    });
  });

  describe('when the enrollment is suspended or left', () => {
    it('should exit as a conflict so the page can show the status', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue(
        fail(409, { error: 'Conflict', message: 'x' }),
      );
      const { onExit } = renderFlow();
      await acceptTerms();
      fillContact();

      await waitFor(() => expect(onExit).toHaveBeenCalledWith('conflict'));
    });
  });

  describe('analytics', () => {
    const PII = ['Jane', 'Doe', 'jane.doe@example.com'];

    it('should report an eligible check once, with no reasons', async () => {
      renderFlow();
      await screen.findByRole('region', { name: 'Program Terms' });

      expect(tracked('Creator Fund Eligibility Checked')).toEqual([{ result: 'eligible' }]);
    });

    it('should report an ineligible check with its reason codes', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue(
        ok({ eligible: false, reasons: ['internal', 'excluded'] }),
      );
      renderFlow();
      await screen.findByRole('alertdialog', { name: "You can't join yet" });

      expect(tracked('Creator Fund Eligibility Checked')).toEqual([
        { result: 'ineligible', reasons: ['internal', 'excluded'] },
      ]);
    });

    it('should report a failed check as an error, and support from its email link', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue(fail(500));
      renderFlow();
      await screen.findByRole('alertdialog', {
        name: 'Something went wrong while checking your account',
      });

      fireEvent.click(screen.getByText('creatorfund@decentraland.org'));

      expect(tracked('Creator Fund Eligibility Checked')).toEqual([{ result: 'error' }]);
      expect(tracked('Creator Fund Contact Support')).toEqual([{ source: 'check_failed' }]);
    });

    it('should report a cancelled check as nothing', async () => {
      vi.mocked(api.getEligibility).mockReturnValue(new Promise(() => {}));
      renderFlow();

      fireEvent.click(screen.getByLabelText('Close'));
      await act(async () => {});

      expect(tracked('Creator Fund Eligibility Checked')).toEqual([]);
    });

    it('should report the accepted terms, the sent contact and the join, and no personal data', async () => {
      renderFlow();
      await acceptTerms();
      fillContact();

      await screen.findByRole('heading', { name: /welcome/i });
      expect(tracked('Creator Fund Terms Accepted')).toEqual([{ terms_version: 1, flow: 'join' }]);
      expect(tracked('Creator Fund Contact Submitted')).toEqual([{ ok: true }]);
      expect(tracked('Creator Fund Joined')).toEqual([{ terms_version: 1 }]);
      expect(trackedAnyOf(PII)).toBe(false);
    });

    it('should report a failed contact submission with its status and no join', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue(fail(500));
      renderFlow();
      await acceptTerms();
      fillContact();

      await screen.findByText('Something went wrong. Please try again.');
      expect(tracked('Creator Fund Contact Submitted')).toEqual([{ ok: false, status: 500 }]);
      expect(tracked('Creator Fund Joined')).toEqual([]);
      expect(trackedAnyOf(PII)).toBe(false);
    });
  });
});
