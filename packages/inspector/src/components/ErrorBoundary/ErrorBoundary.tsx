import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  /** Names the boundary in the console report. */
  name: string;
  /** A change in any of these clears a caught error, e.g. selecting another asset. */
  resetKeys?: unknown[];
  fallback: ReactNode;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Without a boundary, one throw during render or in an effect unmounts the whole React root: the
 * entire inspector goes blank while the engine bridges underneath it keep running against nothing.
 * Wrap every subtree that renders user-provided files (asset previews, thumbnails) so a file the
 * browser cannot handle costs its own preview and nothing else.
 *
 * Twin of Creator Hub's `renderer/src/components/ErrorBoundary` (the package dependency direction
 * rules out sharing one): port fixes across.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Only an error that was already showing may be cleared: when the key change and the throw
    // land in the same update, a reset here would render the failing subtree a second time.
    if (
      prevState.hasError &&
      this.state.hasError &&
      haveKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function haveKeysChanged(prev: unknown[] = [], next: unknown[] = []) {
  return prev.length !== next.length || prev.some((key, index) => !Object.is(key, next[index]));
}
