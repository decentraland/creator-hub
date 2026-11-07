import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function Explodes({ when }: { when: boolean }) {
  if (when) throw new Error('boom');
  return <span>content</span>;
}

// A throw from an effect is caught by the same boundary in the browser, but under happy-dom React's
// dev-mode guarded callback re-throws it through `dispatchEvent`, which aborts the test's `act`.
describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when a child throws while rendering', () => {
    it('should show the fallback instead of propagating the error', () => {
      expect(() =>
        render(
          <ErrorBoundary
            name="test"
            fallback={<span>fallback</span>}
          >
            <Explodes when />
          </ErrorBoundary>,
        ),
      ).not.toThrow();
      expect(screen.getByText('fallback')).not.toBeNull();
      expect(screen.queryByText('content')).toBeNull();
    });

    it('should name itself in the console report', () => {
      render(
        <ErrorBoundary
          name="asset-viewer"
          fallback={<span>fallback</span>}
        >
          <Explodes when />
        </ErrorBoundary>,
      );
      expect(console.error).toHaveBeenCalledWith(
        '[ErrorBoundary:asset-viewer]',
        expect.any(Error),
        expect.any(String),
      );
    });
  });

  describe('when a reset key changes after an error', () => {
    it('should render the children again', () => {
      const { rerender } = render(
        <ErrorBoundary
          name="test"
          resetKeys={['a']}
          fallback={<span>fallback</span>}
        >
          <Explodes when />
        </ErrorBoundary>,
      );
      expect(screen.getByText('fallback')).not.toBeNull();
      rerender(
        <ErrorBoundary
          name="test"
          resetKeys={['b']}
          fallback={<span>fallback</span>}
        >
          <Explodes when={false} />
        </ErrorBoundary>,
      );
      expect(screen.getByText('content')).not.toBeNull();
    });

    it('should keep the fallback while the keys are unchanged', () => {
      const { rerender } = render(
        <ErrorBoundary
          name="test"
          resetKeys={['a']}
          fallback={<span>fallback</span>}
        >
          <Explodes when />
        </ErrorBoundary>,
      );
      rerender(
        <ErrorBoundary
          name="test"
          resetKeys={['a']}
          fallback={<span>fallback</span>}
        >
          <Explodes when={false} />
        </ErrorBoundary>,
      );
      expect(screen.getByText('fallback')).not.toBeNull();
    });
  });
});
