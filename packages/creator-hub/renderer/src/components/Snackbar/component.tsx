import { useCallback } from 'react';
import { Backdrop, styled } from 'decentraland-ui2';
import { Snackbar } from '@mui/material';

import type { Notification } from '/@/modules/store/snackbar/types';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { useSelector } from '#store';

import { MissingScenes } from './MissingScenes';
import { Generic } from './Generic';
import { NewDependencyVersion } from './DependencyVersion';
import { Deploy } from './Deploy';

import './styles.css';

const DEFAULT_DURATION_IN_MS = 5_000;

const StyledBackdrop = styled(Backdrop)(({ theme }) => ({
  zIndex: theme.zIndex.snackbar - 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
}));

export function SnackbarComponent() {
  const { notifications, close, dismiss } = useSnackbar();
  const isInstallingDependencies = useSelector(state => state.editor.isInstallingProject);

  const getComponent = useCallback((notification: Notification) => {
    switch (notification.type) {
      case 'generic':
        return <Generic {...notification} />;
      case 'missing-scenes':
        return <MissingScenes onClose={close(notification.id)} />;
      case 'new-dependency-version':
        return <NewDependencyVersion onClose={close(notification.id)} />;
      case 'deploy':
        return (
          <Deploy
            onClose={close(notification.id)}
            path={notification.path}
          />
        );
      default:
        return null;
    }
  }, []);

  const getDuration = useCallback(({ duration }: Notification) => {
    if (duration === 0) return null;
    return duration || DEFAULT_DURATION_IN_MS;
  }, []);

  return (
    <>
      <StyledBackdrop open={isInstallingDependencies} />
      <div className="Snackbar">
        {notifications.map((notification, idx) => {
          const component = getComponent(notification);

          return (
            <Snackbar
              style={{ bottom: `${(notifications.length - idx) * 60}px` }}
              key={notification.id}
              open={true}
              autoHideDuration={getDuration(notification)}
              onClose={dismiss(notification.id, idx)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <div>
                {/* dont remove this wrapping div... */}
                {component}
              </div>
            </Snackbar>
          );
        })}
      </div>
    </>
  );
}
