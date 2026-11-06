import { type ReactNode } from 'react';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { Button } from 'decentraland-ui2';

import { ErrorBoundary } from './component';
import { ErrorFallback, fallbackText } from './ErrorFallback';

type Props = {
  /** Names the window in the Sentry `boundary` tag, e.g. `app` or `console-window`. */
  name: string;
  children: ReactNode;
};

/**
 * Last-resort boundary around a whole window's tree. It sits outside the store, router,
 * theme and translation providers, so its fallback brings its own theme, reads English
 * when no locale is loaded, and recovers by remounting or reloading instead of routing.
 */
export function AppErrorBoundary({ name, children }: Props) {
  return (
    <ErrorBoundary
      name={name}
      fallback={({ reset }) => (
        <ThemeProvider theme={dark}>
          <ErrorFallback
            description={fallbackText('error_boundary.app_description')}
            testId="app-error-fallback"
          >
            <Button
              color="secondary"
              variant="contained"
              onClick={() => window.location.reload()}
            >
              {fallbackText('error_boundary.reload')}
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={reset}
            >
              {fallbackText('error_boundary.try_again')}
            </Button>
          </ErrorFallback>
        </ThemeProvider>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
