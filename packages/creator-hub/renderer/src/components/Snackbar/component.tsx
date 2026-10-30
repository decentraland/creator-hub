import { useCallback } from 'react';
import { Snackbar } from '@mui/material';

import type { Notification } from '/@/modules/store/snackbar/types';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { useEditor } from '/@/hooks/useEditor';
import { useExternalAgentAccess } from '/@/hooks/useExternalAgentAccess';
import { MissingScenes } from './MissingScenes';
import { Generic } from './Generic';
import { NewDependencyVersion } from './DependencyVersion';
import { Deploy } from './Deploy';
import { ExternalAgentAccess } from './ExternalAgentAccess';
import { StyledBackdrop } from './component.styled';

import './styles.css';

const DEFAULT_DURATION_IN_MS = 5_000;

export function SnackbarComponent() {
  const { notifications, close, dismiss } = useSnackbar();
  const { isInstallingProject: isInstallingDependencies } = useEditor();
  // Mounted once for the whole app, like this component; its only output is a notice here.
  useExternalAgentAccess();

  const getComponent = useCallback((notification: Notification) => {
    switch (notification.type) {
      case 'generic':
        return (
          <Generic
            {...notification}
            onClose={notification.duration === 0 ? close(notification.id) : undefined}
          />
        );
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
      case 'external-agent-access':
        return <ExternalAgentAccess onClose={close(notification.id)} />;
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
