import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { ErrorBoundary } from './component';
import { Actions, Description, PageFallback } from './component.styled';

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary
      name="routes"
      resetKeys={[pathname]}
      fallback={({ reset }) => (
        <PageFallback
          role="alert"
          data-testid="route-error-fallback"
        >
          <Typography variant="h5">{t('error_boundary.title')}</Typography>
          <Description variant="body1">{t('error_boundary.description')}</Description>
          <Actions>
            <Button
              color="secondary"
              variant="contained"
              onClick={() => navigate('/home')}
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
          </Actions>
        </PageFallback>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
