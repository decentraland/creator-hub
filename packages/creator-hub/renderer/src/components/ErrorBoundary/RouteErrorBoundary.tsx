import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { ErrorBoundary } from './component';
import { ErrorFallback } from './ErrorFallback';

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary
      name="routes"
      resetKeys={[pathname]}
      fallback={({ reset }) => (
        <ErrorFallback
          description={t('error_boundary.description')}
          testId="route-error-fallback"
        >
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              // When the crashed page IS /home the pathname doesn't change, so the
              // resetKeys never fire; reset explicitly.
              navigate('/home');
              reset();
            }}
          >
            {t('error_boundary.go_home')}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={reset}
          >
            {t('error_boundary.try_again')}
          </Button>
        </ErrorFallback>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
