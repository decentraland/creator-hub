import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureException } from '@sentry/electron/renderer';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { RouteErrorBoundary } from '.';

vi.mock('@sentry/electron/renderer', () => ({ captureException: vi.fn() }));

const crash = { enabled: true, home: false };

function Crashing() {
  if (crash.enabled) {
    throw new Error('render failed');
  }
  return <p>Recovered page</p>;
}

function Home() {
  if (crash.home) {
    throw new Error('home failed');
  }
  return <p>Home page</p>;
}

function renderApp(initialPath = '/broken') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider theme={dark}>
        <nav>
          <Link to="/home">Outside link</Link>
          <Link to="/broken">Broken link</Link>
        </nav>
        <RouteErrorBoundary>
          <Routes>
            <Route
              path="/broken"
              element={<Crashing />}
            />
            <Route
              path="/home"
              element={<Home />}
            />
          </Routes>
        </RouteErrorBoundary>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('RouteErrorBoundary', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    crash.enabled = true;
    crash.home = false;
    vi.mocked(captureException).mockClear();
    // React logs every caught render error; keep the run's output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when a page throws during render', () => {
    beforeEach(() => {
      renderApp();
    });

    it('should show the fallback instead of the page', () => {
      expect(screen.getByTestId('route-error-fallback')).toBeTruthy();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('should keep the rest of the app mounted', () => {
      expect(screen.getByRole('link', { name: 'Outside link' })).toBeTruthy();
    });

    it('should report the error to Sentry', () => {
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'render failed' }),
        expect.objectContaining({
          tags: { source: 'error-boundary', boundary: 'routes' },
        }),
      );
    });

    describe('and the user clicks Try again once the cause is gone', () => {
      beforeEach(() => {
        crash.enabled = false;
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      });

      it('should render the page again', () => {
        expect(screen.getByText('Recovered page')).toBeTruthy();
        expect(screen.queryByTestId('route-error-fallback')).toBeNull();
      });
    });

    describe('and the user clicks Try again while the page still throws', () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      });

      it('should render the page again and report the new crash', () => {
        expect(captureException).toHaveBeenCalledTimes(2);
      });

      it('should show the fallback again', () => {
        expect(screen.getByTestId('route-error-fallback')).toBeTruthy();
      });
    });

    describe('and the user clicks Go to Home', () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }));
      });

      it('should leave the fallback and render the Home route', () => {
        expect(screen.getByText('Home page')).toBeTruthy();
        expect(screen.queryByTestId('route-error-fallback')).toBeNull();
      });
    });

    describe('and the user navigates elsewhere from outside the boundary', () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole('link', { name: 'Outside link' }));
      });

      it('should clear the error for the new route', () => {
        expect(screen.getByText('Home page')).toBeTruthy();
      });
    });
  });

  describe('when the user navigates into a page that throws', () => {
    beforeEach(() => {
      renderApp('/home');
      fireEvent.click(screen.getByRole('link', { name: 'Broken link' }));
    });

    it('should show the fallback', () => {
      expect(screen.getByTestId('route-error-fallback')).toBeTruthy();
    });

    it('should report the crash exactly once', () => {
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the Home page itself throws', () => {
    beforeEach(() => {
      crash.home = true;
      renderApp('/home');
    });

    describe('and the user clicks Go to Home once the cause is gone', () => {
      beforeEach(() => {
        crash.home = false;
        fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }));
      });

      it('should leave the fallback and render the Home route', () => {
        expect(screen.getByText('Home page')).toBeTruthy();
        expect(screen.queryByTestId('route-error-fallback')).toBeNull();
      });
    });
  });
});
