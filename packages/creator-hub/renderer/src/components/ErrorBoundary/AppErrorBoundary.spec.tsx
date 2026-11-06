import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureException } from '@sentry/electron/renderer';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { AppErrorBoundary, Description } from '.';

vi.mock('@sentry/electron/renderer', () => ({ captureException: vi.fn() }));

const crash = { enabled: true };

function Crashing() {
  if (crash.enabled) {
    throw new Error('provider failed');
  }
  return <p>Recovered app</p>;
}

// Rendered with no store, router, theme or translation provider, and no locale loaded:
// the app-level boundary sits outside all of them.
describe('AppErrorBoundary', () => {
  beforeEach(() => {
    crash.enabled = true;
    vi.mocked(captureException).mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppErrorBoundary name="app">
        <Crashing />
      </AppErrorBoundary>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when something outside every provider throws', () => {
    it('should show the fallback in English', () => {
      expect(screen.getByTestId('app-error-fallback')).toBeTruthy();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    });

    it('should style the fallback with the dark theme', () => {
      render(
        <ThemeProvider theme={dark}>
          <Description>Reference</Description>
        </ThemeProvider>,
      );
      expect(getComputedStyle(screen.getByText(/reload the window/)).color).toBe(
        getComputedStyle(screen.getByText('Reference')).color,
      );
    });

    it('should report the error to Sentry with the boundary tags', () => {
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'provider failed' }),
        expect.objectContaining({ tags: { source: 'error-boundary', boundary: 'app' } }),
      );
    });

    describe('and the user clicks Try again once the cause is gone', () => {
      beforeEach(() => {
        crash.enabled = false;
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      });

      it('should render the tree again', () => {
        expect(screen.getByText('Recovered app')).toBeTruthy();
        expect(screen.queryByTestId('app-error-fallback')).toBeNull();
      });
    });
  });
});
