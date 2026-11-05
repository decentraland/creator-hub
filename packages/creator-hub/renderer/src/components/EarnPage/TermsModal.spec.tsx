import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import * as api from '/@/lib/creatorFundApi';
import { actions } from '/@/modules/store/creatorFund';
import { misc } from '#preload';

import { createTestStore } from '../../../tests/utils/testStore';
import { TermsModal } from './TermsModal';

vi.mock('/@/lib/creatorFundApi', () => ({ getTerms: vi.fn() }));
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
  published_at: '2026-10-22T00:00:00Z',
  title: 'Example Program Terms (Beta)',
  content:
    '## 1. About the Program\n\nFirst paragraph.\n\nSecond paragraph.\n\n## 2. Payouts\n\nRead [the rules](https://example.com/rules) or [this](http://example.com).',
};

const renderModal = (ui: React.ReactElement) =>
  render(
    <Provider store={createTestStore()}>
      <ThemeProvider theme={dark}>{ui}</ThemeProvider>
    </Provider>,
  );

function stubScrollableBox() {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
}

function scrollRegionTo(scrollTop: number) {
  const region = screen.getByRole('region', { name: 'Program Terms' });
  Object.defineProperty(region, 'scrollTop', { value: scrollTop, configurable: true });
  act(() => {
    fireEvent.scroll(region);
  });
}

describe('TermsModal', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getTerms).mockResolvedValue({ ok: true, status: 200, data: TERMS });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the terms load', () => {
    it('should render the backend title, version line and sections in a focusable region', async () => {
      renderModal(
        <TermsModal
          variant="read"
          onClose={vi.fn()}
        />,
      );

      expect(await screen.findByRole('heading', { name: TERMS.title })).toBeTruthy();
      expect(screen.getByText(/Version 1/)).toBeTruthy();
      const region = screen.getByRole('region', { name: 'Program Terms' });
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(screen.getByRole('heading', { name: '1. About the Program' })).toBeTruthy();
      expect(screen.getByText('Second paragraph.')).toBeTruthy();
    });
  });

  describe('when the terms link out', () => {
    it('should open only https links, in the system browser', async () => {
      renderModal(
        <TermsModal
          variant="read"
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(await screen.findByRole('link', { name: 'the rules' }));
      fireEvent.click(screen.getByRole('link', { name: 'this' }));

      expect(misc.openExternal).toHaveBeenCalledTimes(1);
      expect(misc.openExternal).toHaveBeenCalledWith('https://example.com/rules');
    });
  });

  describe('when the terms embed an image', () => {
    beforeEach(() => {
      vi.mocked(api.getTerms).mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          ...TERMS,
          content: 'Intro.\n\n![Program banner](https://example.com/banner.png)\n\nOutro.',
        },
      });
    });

    it('should show the alt text and load no image', async () => {
      const { container } = renderModal(
        <TermsModal
          variant="read"
          onClose={vi.fn()}
        />,
      );

      expect(await screen.findByText('Program banner')).toBeTruthy();
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('when it is read only', () => {
    it('should offer only closing, with no checkbox', async () => {
      const onClose = vi.fn();
      renderModal(
        <TermsModal
          variant="read"
          onClose={onClose}
        />,
      );
      await screen.findByRole('heading', { name: TERMS.title });

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
      expect(onClose).toHaveBeenCalled();
    });

    it('should close on Escape', async () => {
      const onClose = vi.fn();
      renderModal(
        <TermsModal
          variant="read"
          onClose={onClose}
        />,
      );
      const region = await screen.findByRole('region', { name: 'Program Terms' });

      fireEvent.keyDown(region, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('when accepting and the terms are longer than the box', () => {
    beforeEach(() => {
      stubScrollableBox();
    });

    it('should show the hint and keep ACCEPT & JOIN disabled before the bottom', async () => {
      renderModal(
        <TermsModal
          variant="accept"
          onAccept={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      await screen.findByRole('heading', { name: TERMS.title });

      const hint = screen.getByText('Scroll to the bottom to review the full terms.');
      const accept = screen.getByRole('button', { name: 'Accept & Join' }) as HTMLButtonElement;
      expect(accept.disabled).toBe(true);
      expect(accept.getAttribute('aria-describedby')).toBe(hint.id);
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('should swap the hint for the checkbox at the bottom, announce it, and keep focus', async () => {
      renderModal(
        <TermsModal
          variant="accept"
          onAccept={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      const region = await screen.findByRole('region', { name: 'Program Terms' });
      region.focus();

      scrollRegionTo(400);
      expect(screen.queryByRole('checkbox')).toBeNull();

      scrollRegionTo(800);

      expect(screen.getByRole('checkbox', { name: /I have read and accept/ })).toBeTruthy();
      expect(screen.queryByText('Scroll to the bottom to review the full terms.')).toBeNull();
      expect(screen.getByText('You can now accept the terms').getAttribute('aria-live')).toBe(
        'polite',
      );
      expect(document.activeElement).toBe(region);
    });

    it('should enable ACCEPT & JOIN once checked and accept the loaded version', async () => {
      const onAccept = vi.fn();
      renderModal(
        <TermsModal
          variant="accept"
          onAccept={onAccept}
          onClose={vi.fn()}
        />,
      );
      await screen.findByRole('region', { name: 'Program Terms' });
      scrollRegionTo(800);

      const accept = screen.getByRole('button', { name: 'Accept & Join' }) as HTMLButtonElement;
      expect(accept.disabled).toBe(true);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(accept.disabled).toBe(false);
      fireEvent.click(accept);

      expect(onAccept).toHaveBeenCalledWith(1);
    });

    it('should close from NOT NOW', async () => {
      const onClose = vi.fn();
      renderModal(
        <TermsModal
          variant="accept"
          onAccept={vi.fn()}
          onClose={onClose}
        />,
      );
      await screen.findByRole('region', { name: 'Program Terms' });

      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('when a newer version arrives after the cached terms were accepted', () => {
    it('should close the gate again for the new text', async () => {
      let answer: (value: unknown) => void = () => {};
      vi.mocked(api.getTerms).mockReturnValue(new Promise(resolve => (answer = resolve)) as any);
      const store = createTestStore();
      store.dispatch(actions.fetchTerms.pending('cached', undefined));
      store.dispatch(actions.fetchTerms.fulfilled(TERMS, 'cached', undefined));
      const onAccept = vi.fn();
      render(
        <Provider store={store}>
          <ThemeProvider theme={dark}>
            <TermsModal
              variant="accept"
              onAccept={onAccept}
              onClose={vi.fn()}
            />
          </ThemeProvider>
        </Provider>,
      );
      fireEvent.click(await screen.findByRole('checkbox'));

      stubScrollableBox();
      await act(async () =>
        answer({ ok: true, status: 200, data: { ...TERMS, version: 2, content: 'Longer.' } }),
      );

      expect(screen.queryByRole('checkbox')).toBeNull();
      const accept = screen.getByRole('button', { name: 'Accept & Join' }) as HTMLButtonElement;
      expect(accept.disabled).toBe(true);
      fireEvent.click(accept);
      expect(onAccept).not.toHaveBeenCalled();
    });
  });

  describe('when the terms fit without scrolling', () => {
    it('should open the gate at once', async () => {
      renderModal(
        <TermsModal
          variant="accept"
          onAccept={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(await screen.findByRole('checkbox')).toBeTruthy();
    });
  });

  describe('when the terms fail to load', () => {
    beforeEach(() => {
      vi.mocked(api.getTerms).mockResolvedValueOnce({ ok: false, status: 500, error: 'boom' });
    });

    it('should say so and retry on request', async () => {
      renderModal(
        <TermsModal
          variant="accept"
          onAccept={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(await screen.findByText("Couldn't load the terms.")).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('heading', { name: TERMS.title })).toBeTruthy();
      expect(api.getTerms).toHaveBeenCalledTimes(2);
    });
  });

  describe('when re-accepting', () => {
    it('should title it as updated and offer no way out but its buttons', async () => {
      const onClose = vi.fn();
      renderModal(
        <TermsModal
          variant="reaccept"
          onAccept={vi.fn()}
          onClose={onClose}
        />,
      );

      expect(await screen.findByRole('heading', { name: 'Program Terms updated' })).toBeTruthy();
      expect(screen.getByText('Review the updated terms to keep earning.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

      fireEvent.keyDown(screen.getByRole('region', { name: 'Program Terms' }), { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('should disable ACCEPT and mark it busy while the acceptance runs', async () => {
      renderModal(
        <TermsModal
          variant="reaccept"
          onAccept={vi.fn()}
          onClose={vi.fn()}
          status="submitting"
        />,
      );
      await screen.findByRole('heading', { name: 'Program Terms updated' });

      const accept = screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement;
      expect(accept.disabled).toBe(true);
      expect(accept.getAttribute('aria-busy')).toBe('true');
    });

    it('should show a failure above the buttons', async () => {
      renderModal(
        <TermsModal
          variant="reaccept"
          onAccept={vi.fn()}
          onClose={vi.fn()}
          error="Something went wrong. Please try again."
        />,
      );

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe(
          'Something went wrong. Please try again.',
        ),
      );
    });
  });
});
