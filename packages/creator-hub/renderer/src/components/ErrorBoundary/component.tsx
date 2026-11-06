import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '@sentry/electron/renderer';

export type FallbackProps = {
  error: unknown;
  reset: () => void;
};

type Props = {
  /** Names the boundary in the Sentry report (`boundary` tag). */
  name: string;
  /** A change in any of these clears a caught error, e.g. navigating to another route. */
  resetKeys?: unknown[];
  fallback: (props: FallbackProps) => ReactNode;
  children: ReactNode;
};

type State = {
  error: unknown;
  hasError: boolean;
};

/**
 * Without a boundary, one throw during render unmounts the whole React root and leaves
 * the window blank (and the editor tears down its preview and watchers on the way out).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    captureException(error, {
      tags: { source: 'error-boundary', boundary: this.props.name },
      extra: { componentStack: info.componentStack },
    });
    console.error(`[ErrorBoundary:${this.props.name}]`, error);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Only an error that was already showing may be cleared. When a navigation lands on a
    // page that throws, the catch happens in the same update as the key change; resetting
    // then would render the page a second time and report the crash twice.
    if (
      prevState.hasError &&
      this.state.hasError &&
      haveKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: undefined, hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}

function haveKeysChanged(prev: unknown[] = [], next: unknown[] = []) {
  return prev.length !== next.length || prev.some((key, index) => !Object.is(key, next[index]));
}
