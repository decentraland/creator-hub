import { useCallback } from 'react';
import { Snackbar } from '@mui/material';

import type { Notification } from '/@/modules/store/snackbar/types';
import { useSnackbar } from '/@/hooks/useSnackbar';

import { MissingScenes } from './MissingScenes';
import { Generic } from './Generic';

import './styles.css';

export function SnackbarComponent() {
  const { notifications, close } = useSnackbar();

  const getComponent = useCallback  ((notification: Notification) => {
    switch (notification.type) {
      case 'generic':
        return <Generic {...notification} />;
      case 'missing-scenes':
        return <MissingScenes />;
      default:
        return null;
    }
  }, []);

  return (
    <div className="Snackbar">
      {notifications.map((notification, idx) => {
        const component = getComponent(notification);

        return (
          <Snackbar
            style={{ bottom: `${(notifications.length - idx) * 60}px` }}
            key={notification.id}
            open={true}
            // autoHideDuration={5000}
            onClose={close(notification.id, idx)}
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
  );
}
