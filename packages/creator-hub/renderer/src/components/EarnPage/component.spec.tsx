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

import { tracked, trackedAnyOf } from '../../../tests/utils/analytics';
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

const HERO_HIDE_RULE =
  /@media \(max-width: ?1429\.46px\), ?\(max-height: ?597\.5px\)\{\.([\w-]+)\{display:none;?\}\}/;

function hidesHeroBelowHalfItsFigmaSize(container: HTMLElement) {
  const art = container.querySelector('img[width="1425"]');
  const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n');
  const hiddenClass = css.match(HERO_HIDE_RULE)?.[1];
  return !!art && !!hiddenClass && art.classList.contains(hiddenClass);
}

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

    it('should hide the hero art below half its Figma size', () => {
      expect(hidesHeroBelowHalfItsFigmaSize(page().container)).toBe(true);
    });

    it('should open the read-only terms', async () => {
      page();
      fireEvent.click(screen.getByRole('button', { name: 'Read Terms' }));
      expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('should open the Creator Fund page in the browser from Know More', () => {
      page();
      fireEvent.click(screen.getByRole('link', { name: 'Know More' }));
      expect(misc.openExternal).toHaveBeenCalledWith('https://decentraland.org/creator-fund');
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
      const view = within(page().container);

      const alert = await view.findByRole('alert');
      expect(
        within(alert).getByText('Something went wrong while loading the Creator Fund.'),
      ).toBeTruthy();
      expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Join Creators Fund' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Read Terms' })).toBeNull();
      expect(screen.queryByRole('tab', { name: 'Home' })).toBeNull();
    });

    it('should load the status again from RETRY', async () => {
      page();

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('button', { name: 'Join Creators Fund' })).toBeTruthy();
      expect(api.getEnrollment).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Something went wrong while loading the Creator Fund.')).toBeNull();
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

    it('should hide the hero art below half its Figma size', async () => {
      const { container } = page();
      await screen.findByRole('button', { name: 'Join Creators Fund' });

      expect(hidesHeroBelowHalfItsFigmaSize(container)).toBe(true);
    });

    it('should explain a failed check in a modal and go back to the landing from CLOSE', async () => {
      vi.mocked(api.getEligibility).mockResolvedValue({ ok: false, status: 500, error: 'x' });
      const view = within(page().container);

      fireEvent.click(await view.findByRole('button', { name: 'Join Creators Fund' }));
      await view.findByRole('alertdialog', {
        name: 'Something went wrong while checking your account',
      });
      fireEvent.click(view.getByText('Close'));

      expect(view.queryByRole('alertdialog')).toBeNull();
      expect(view.queryByRole('alert')).toBeNull();
      expect(view.getByRole('button', { name: 'Join Creators Fund' })).toBeTruthy();
    });
  });

  describe.each([['suspended', 'Your Creator Fund participation is suspended.']] as const)(
    'when the enrollment is %s',
    (status, copy) => {
      beforeEach(() => {
        auth.isSignedIn = true;
        vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(2, status)));
      });

      it('should say so in a snackbar in place of the CTAs, with no ⋮ menu', async () => {
        const view = within(page().container);

        const snackbar = await view.findByRole('status');
        expect(within(snackbar).getByText(copy)).toBeTruthy();
        expect(view.queryByRole('button', { name: 'Join Creators Fund' })).toBeNull();
        expect(view.queryByRole('button', { name: 'More options' })).toBeNull();
        expect(view.queryByRole('tab', { name: 'Home' })).toBeNull();
      });

      it('should open the terms read-only from the snackbar', async () => {
        const view = within(page().container);

        const snackbar = await view.findByRole('status');
        fireEvent.click(within(snackbar).getByText('Read Terms'));

        expect(await screen.findByRole('region', { name: 'Program Terms' })).toBeTruthy();
        expect(screen.queryByRole('checkbox')).toBeNull();
      });

      it('should open support in the browser from the snackbar', async () => {
        const view = within(page().container);

        const snackbar = await view.findByRole('status');
        fireEvent.click(within(snackbar).getByText('Contact Support'));

        expect(misc.openExternal).toHaveBeenCalledWith('https://decentraland.org/help/');
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

      expect(await screen.findByRole('tab', { name: 'Home' })).toBeTruthy();
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

    it('should accept the current version and open the joined page on My Places', async () => {
      const view = within(page().container);
      await acceptUpdatedTerms(view);

      const myPlaces = await view.findByRole('tab', { name: 'My Places' });
      expect(myPlaces.getAttribute('aria-selected')).toBe('true');
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

      expect(await view.findByRole('tab', { name: 'Home' })).toBeTruthy();
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

  describe('analytics', () => {
    it('should report JOIN when signed in, once', async () => {
      auth.isSignedIn = true;
      page();

      fireEvent.click(await screen.findByRole('button', { name: 'Join Creators Fund' }));

      expect(tracked('Creator Fund Join Clicked')).toEqual([{ signed_in: true }]);
    });

    it('should report the sign-in CTA as a signed-out join, and not again when the join starts after sign in', async () => {
      const { rerenderPage } = page();

      fireEvent.click(screen.getByRole('button', { name: 'Sign in to join Creators Fund' }));
      auth.isSigningIn = false;
      auth.isSignedIn = true;
      rerenderPage();
      await screen.findByRole('progressbar', { name: 'Checking eligibility' });

      expect(tracked('Creator Fund Join Clicked')).toEqual([{ signed_in: false }]);
    });

    describe.each([
      ['signed_out', false, 'Sign in to join Creators Fund'],
      ['not_joined', true, 'Join Creators Fund'],
    ] as const)('when the page opens %s', (state, signedIn, cta) => {
      it('should report the visit once', async () => {
        auth.isSignedIn = signedIn;
        const { rerenderPage } = page();
        await screen.findByRole('button', { name: cta });

        rerenderPage();

        expect(tracked('Creator Fund Viewed')).toEqual([{ state }]);
      });
    });

    it.each([
      ['joined', 'active'],
      ['suspended', 'suspended'],
    ] as const)('should report a %s visit once', async (state, status) => {
      auth.isSignedIn = true;
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(2, status)));
      const { rerenderPage } = page();
      await waitFor(() => expect(tracked('Creator Fund Viewed')).toEqual([{ state }]));

      rerenderPage();

      expect(tracked('Creator Fund Viewed')).toEqual([{ state }]);
      expect(trackedAnyOf(['Jane', 'Doe', 'jane.doe@example.com'])).toBe(false);
    });

    it('should report no visit while the status fails to load', async () => {
      auth.isSignedIn = true;
      vi.mocked(api.getEnrollment).mockResolvedValue({ ok: false, status: 500, error: 'boom' });
      page();

      await screen.findByRole('alert');

      expect(tracked('Creator Fund Viewed')).toEqual([]);
    });

    it("should report the landing's READ TERMS", () => {
      page();

      fireEvent.click(screen.getByRole('button', { name: 'Read Terms' }));

      expect(tracked('Creator Fund Read Terms')).toEqual([{ source: 'landing' }]);
    });

    it("should report the suspended snackbar's READ TERMS and CONTACT SUPPORT", async () => {
      auth.isSignedIn = true;
      vi.mocked(api.getEnrollment).mockResolvedValue(ok(enrollment(2, 'suspended')));
      const view = within(page().container);
      const snackbar = await view.findByRole('status');

      fireEvent.click(within(snackbar).getByText('Read Terms'));
      fireEvent.click(within(snackbar).getByText('Contact Support'));

      expect(tracked('Creator Fund Read Terms')).toEqual([{ source: 'snackbar' }]);
      expect(tracked('Creator Fund Contact Support')).toEqual([{ source: 'snackbar' }]);
    });
  });
});
