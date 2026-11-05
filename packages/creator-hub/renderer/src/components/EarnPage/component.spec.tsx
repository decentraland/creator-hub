import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';
import { actions } from '/@/modules/store/creatorFund';

import { createTestStore } from '../../../tests/utils/testStore';
import { EarnPage } from '.';

const { isEnabled, auth } = vi.hoisted(() => ({
  isEnabled: vi.fn((_flag: string) => true),
  auth: {
    isSignedIn: false,
    isSigningIn: false,
    signIn: vi.fn(async () => {
      auth.isSigningIn = true;
    }),
  },
}));

vi.mock('/@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ isEnabled }) }));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../Navbar', async importOriginal => ({
  ...((await importOriginal()) as object),
  Navbar: () => null,
}));
vi.mock('/@/lib/creatorFundApi', () => ({
  getEnrollment: vi.fn(),
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
  version: 2,
  published_at: '2026-11-03T00:00:00Z',
  title: 'Example Program Terms (Beta)',
  content: '## 1. About the Program\n\nPlaceholder.',
};

const ok = <T,>(data: T, status = 200) => ({ ok: true as const, status, data });

const enrollment = (termsVersion: number, status: 'active' | 'suspended' = 'active') => ({
  status,
  enrolled_at: '2026-10-30T14:02:11Z',
  terms_version: termsVersion,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  email_verified_at: null,
});

const ACCEPT_LABEL = 'I have read and accept the Creator Fund Program Terms';

type Entry = string | { pathname: string; state: unknown };

function page(entry: Entry = '/earn') {
  const store = createTestStore();
  const tree = () => (
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route
              path="/earn"
              element={<EarnPage />}
            />
            <Route
              path="/home"
              element={<p>home page</p>}
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  const view = render(tree());
  return { ...view, store, rerenderPage: () => view.rerender(tree()) };
}

/*
 * Each case renders MUI modals and queries them by role and accessible name, which takes seconds
 * on a loaded CI runner; vitest's default 5 s cut cases off there while they were passing.
 */
vi.setConfig({ testTimeout: 15_000 });

async function acceptUpdatedTerms(view: ReturnType<typeof within>) {
  const checkbox = await view.findByLabelText(ACCEPT_LABEL);
  const accept = view.getByRole('button', { name: 'Accept' });
  fireEvent.click(checkbox);
  fireEvent.click(accept);
  return accept;
}

describe('EarnPage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    auth.isSignedIn = false;
    auth.isSigningIn = false;
    [api.getEnrollment, api.getTerms, api.getEligibility, api.putEnrollment].forEach(mock =>
      vi.mocked(mock).mockReset(),
    );
    vi.mocked(api.getEnrollment).mockResolvedValue({
      ok: false as const,
      status: 404,
      error: 'Not Found',
      body: { error: 'Not Found', message: 'not enrolled' },
    });
    vi.mocked(api.getTerms).mockResolvedValue(ok(TERMS));
    vi.mocked(api.getEligibility).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.putEnrollment).mockResolvedValue(ok(enrollment(2)));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    isEnabled.mockImplementation(() => true);
  });

  describe('when the Creator Fund flag is off', () => {
    it('should redirect to home', () => {
      isEnabled.mockImplementation(() => false);
      page();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
      expect(screen.getByText('home page')).toBeTruthy();
    });
  });

  describe('when signed out', () => {
    it('should not add a second main landmark', () => {
      page();
      expect(screen.queryByRole('main')).toBeNull();
    });

    it('should pitch money and ask to sign in to join', () => {
      page();

      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
        'Decentraland Creator Fund',
      );
      expect(screen.getByText(/Earn money\.$/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Sign in to join Creators Fund' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Read Terms' })).toBeTruthy();
      expect(api.getEnrollment).not.toHaveBeenCalled();
    });

    it('should sign in, then start the join once signed in back on the page', async () => {
      const { rerenderPage } = page();

      fireEvent.click(screen.getByRole('button', { name: 'Sign in to join Creators Fund' }));
      expect(auth.signIn).toHaveBeenCalled();

      auth.isSigningIn = false;
      auth.isSignedIn = true;
      rerenderPage();

      expect(await screen.findByRole('progressbar', { name: 'Checking eligibility' })).toBeTruthy();
      expect(api.getEligibility).toHaveBeenCalledTimes(1);
    });

    it('should open the read-only terms', async () => {
      page();
      fireEvent.click(screen.getByRole('button', { name: 'Read Terms' }));
      expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
      expect(screen.queryByRole('checkbox')).toBeNull();
    });
  });

  describe('when back from sign in and the status requests settle out of order', () => {
    it('should start the join once the latest status arrives', async () => {
      auth.isSignedIn = true;
      let answerLatest: (value: unknown) => void = () => {};
      vi.mocked(api.getEnrollment)
        .mockResolvedValueOnce({
          ok: false as const,
          status: 404,
          error: 'Not Found',
          body: { error: 'Not Found', message: 'not enrolled' },
        })
        .mockReturnValueOnce(new Promise(resolve => (answerLatest = resolve)) as any);

      render(
        <StrictMode>
          <Provider store={createTestStore()}>
            <ThemeProvider theme={dark}>
              <MemoryRouter
                initialEntries={[{ pathname: '/earn', state: { joinAfterSignIn: true } }]}
              >
                <Routes>
                  <Route
                    path="/earn"
                    element={<EarnPage />}
                  />
                </Routes>
              </MemoryRouter>
            </ThemeProvider>
          </Provider>
        </StrictMode>,
      );
      await act(async () => {});
      await act(async () =>
        answerLatest({
          ok: false as const,
          status: 404,
          error: 'Not Found',
          body: { error: 'Not Found', message: 'not enrolled' },
        }),
      );

      expect(await screen.findByRole('progressbar', { name: 'Checking eligibility' })).toBeTruthy();
    });

    it('should not start the join when a later status request finds an active enrollment', async () => {
      auth.isSignedIn = true;
      let answerLatest: (value: unknown) => void = () => {};
      vi.mocked(api.getEnrollment)
        .mockResolvedValueOnce({
          ok: false as const,
          status: 404,
          error: 'Not Found',
          body: { error: 'Not Found', message: 'not enrolled' },
        })
        .mockReturnValueOnce(new Promise(resolve => (answerLatest = resolve)) as any);
      const { container, store } = page({ pathname: '/earn', state: { joinAfterSignIn: true } });
      const view = within(container);

      void store.dispatch(actions.fetchEnrollment());
      await act(async () => {});
      await act(async () => answerLatest(ok(enrollment(2))));

      expect(view.queryByRole('progressbar', { name: 'Checking eligibility' })).toBeNull();
      expect(api.getEligibility).not.toHaveBeenCalled();
    });
  });

  describe('when back from a sign in that did not complete', () => {
    it('should not start the join', async () => {
      page({ pathname: '/earn', state: { joinAfterSignIn: true } });
      await screen.findByRole('button', { name: 'Sign in to join Creators Fund' });
      expect(api.getEligibility).not.toHaveBeenCalled();
    });
  });

  describe('when signed in and the status fails to load', () => {
    beforeEach(() => {
      auth.isSignedIn = true;
      vi.mocked(api.getEnrollment).mockResolvedValueOnce({ ok: false, status: 500, error: 'boom' });
    });

    it('should say so in place of the CTAs and offer a retry', async () => {
      page();

      expect(await screen.findByText("Couldn't load the Creator Fund.")).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Join Creators Fund' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Read Terms' })).toBeNull();
      expect(screen.queryByRole('tab', { name: 'Leaderboard' })).toBeNull();
    });

    it('should load the status again from RETRY', async () => {
      page();

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('button', { name: 'Join Creators Fund' })).toBeTruthy();
      expect(api.getEnrollment).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Couldn't load the Creator Fund.")).toBeNull();
    });
  });

  describe('when signed in and not joined', () => {
    beforeEach(() => {
      auth.isSignedIn = true;
    });

    it('should pitch USDC and start the join from JOIN', async () => {
      page();

      fireEvent.click(await screen.findByRole('button', { name: 'Join Creators Fund' }));

      expect(screen.getByText(/Earn USDC\.$/)).toBeTruthy();
      expect(await screen.findByRole('progressbar', { name: 'Checking eligibility' })).toBeTruthy();
    });

    it('should show the failure line above the CTAs when the check fails', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue({ ok: false, status: 500, error: 'x' });
      page();

      fireEvent.click(await screen.findByRole('button', { name: 'Join Creators Fund' }));

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Something went wrong. Please try again.',
      );
      expect(screen.queryByRole('progressbar', { name: 'Checking eligibility' })).toBeNull();
    });
  });

  describe.each([['suspended', 'Your Creator Fund participation is suspended.']] as const)(
    'when the enrollment is %s',
    (status, copy) => {
      it('should say so in place of the CTAs', async () => {
        auth.isSignedIn = true;
        vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(2, status)));
        page();

        expect((await screen.findByRole('status')).textContent).toBe(copy);
        expect(screen.queryByRole('button', { name: 'Join Creators Fund' })).toBeNull();
        expect(screen.queryByRole('tab', { name: 'Leaderboard' })).toBeNull();
      });

      it('should keep the ⋮ menu: the terms read-only and Contact Support', async () => {
        auth.isSignedIn = true;
        vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(2, status)));
        page();

        fireEvent.click(await screen.findByRole('button', { name: 'More options' }));
        const items = await screen.findAllByRole('menuitem');
        expect(items.map(item => item.textContent)).toEqual(['Read Terms', 'Contact Support']);

        fireEvent.click(items[1]);
        expect(misc.openExternal).toHaveBeenCalledWith('https://decentraland.org/help/');

        fireEvent.click(screen.getByRole('button', { name: 'More options' }));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Read Terms' }));
        expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
        expect(screen.queryByRole('checkbox')).toBeNull();
      });
    },
  );

  describe('when joined on the current terms', () => {
    beforeEach(() => {
      auth.isSignedIn = true;
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(2)));
    });

    it('should show the joined page instead of the landing', async () => {
      page();

      expect(await screen.findByRole('tab', { name: 'Leaderboard' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'My Places' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Join Creators Fund' })).toBeNull();
    });
  });

  describe('when joined on an older terms version', () => {
    beforeEach(() => {
      auth.isSignedIn = true;
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(1)));
    });

    it('should block the page behind the re-accept modal', async () => {
      const view = within(page().container);

      expect(await view.findByRole('heading', { name: 'Program Terms updated' })).toBeTruthy();
      expect(view.queryByRole('tab', { name: 'My Places' })).toBeNull();
      expect(view.queryByRole('button', { name: 'Close' })).toBeNull();

      fireEvent.keyDown(view.getByRole('region', { name: 'Program Terms' }), { key: 'Escape' });
      expect(view.getByRole('heading', { name: 'Program Terms updated' })).toBeTruthy();
    });

    it('should go home from NOT NOW', async () => {
      const view = within(page().container);

      fireEvent.click(await view.findByRole('button', { name: 'Not now' }));

      expect(view.getByText('home page')).toBeTruthy();
    });

    it('should accept the current version and show the joined page', async () => {
      const view = within(page().container);
      await acceptUpdatedTerms(view);

      expect(await view.findByRole('tab', { name: 'Leaderboard' })).toBeTruthy();
      expect(api.putEnrollment).toHaveBeenCalledWith({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        terms_version: 2,
      });
    });

    it('should accept only once when ACCEPT is pressed twice', async () => {
      vi.mocked(api.putEnrollment).mockReturnValue(new Promise(() => {}));
      const view = within(page().container);
      const accept = await acceptUpdatedTerms(view);
      fireEvent.click(accept);

      expect(api.putEnrollment).toHaveBeenCalledTimes(1);
      expect(accept.getAttribute('aria-busy')).toBe('true');
    });

    it("should say only the generic line on a 400, never the service's message", async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue({
        ok: false,
        status: 400,
        error: 'x',
        body: { error: 'Bad Request', message: 'email must be a valid address' },
      });
      const view = within(page().container);
      await acceptUpdatedTerms(view);

      expect((await view.findByRole('alert')).textContent).toBe(
        'Something went wrong. Please try again.',
      );
    });

    it('should load newer terms and ask again when the accepted version went stale', async () => {
      vi.mocked(api.putEnrollment)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          error: 'x',
          body: { error: 'Bad Request', message: 'terms_version must be 3' },
        })
        .mockResolvedValue(ok(enrollment(3)));
      const view = within(page().container);
      const checkbox = await view.findByLabelText(ACCEPT_LABEL);
      const accept = view.getByRole('button', { name: 'Accept' });
      fireEvent.click(checkbox);
      vi.mocked(api.getTerms).mockResolvedValue(ok({ ...TERMS, version: 3 }));
      fireEvent.click(accept);

      await waitFor(() => expect(api.getTerms).toHaveBeenCalledTimes(2));
      const reloaded = await view.findByLabelText<HTMLInputElement>(ACCEPT_LABEL);
      await waitFor(() => expect(reloaded.checked).toBe(false));
      expect(view.queryByRole('alert')).toBeNull();
      fireEvent.click(reloaded);
      fireEvent.click(view.getByRole('button', { name: 'Accept' }));

      expect(await view.findByRole('tab', { name: 'Leaderboard' })).toBeTruthy();
      expect(vi.mocked(api.putEnrollment).mock.calls.map(([body]) => body.terms_version)).toEqual([
        2, 3,
      ]);
    });

    it('should show why when the wallet is no longer eligible, then go home', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue({
        ok: false,
        status: 403,
        error: 'Forbidden',
        body: { error: 'Forbidden', reasons: ['excluded'] },
      });
      const view = within(page().container);
      await acceptUpdatedTerms(view);

      const dialog = await view.findByRole('alertdialog', { name: "You can't join yet" });
      expect(dialog.textContent).toContain("Your account isn't eligible for the Creator Fund.");
      expect(view.queryByRole('heading', { name: 'Program Terms updated' })).toBeNull();

      fireEvent.click(view.getByRole('button', { name: 'Got it' }));

      expect(view.getByText('home page')).toBeTruthy();
    });

    it('should keep the modal and say so when accepting fails', async () => {
      vi.mocked(api.putEnrollment).mockResolvedValue({ ok: false, status: 500, error: 'x' });
      const view = within(page().container);
      await acceptUpdatedTerms(view);

      expect((await view.findByRole('alert')).textContent).toBe(
        'Something went wrong. Please try again.',
      );
      expect(view.getByRole('heading', { name: 'Program Terms updated' })).toBeTruthy();
    });
  });
});
