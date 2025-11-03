import React from 'react';
import type { AlertColor } from 'decentraland-ui2';
import { getSceneClient } from '../lib/rpc/scene';

export type NotificationType = AlertColor | 'loading';

export type NotificationRequest = {
  severity: NotificationType;
  message: string;
};

/**
 * Snackbar hook for inspector package.
 * It relies on creator-hub snackbar system via RPC.
 */
export const useSnackbar = () => {
  const pushNotification = React.useCallback((type: NotificationType, message: string) => {
    try {
      const sceneClient = getSceneClient();
      if (!sceneClient) return;

      const notification: NotificationRequest = { severity: type, message };
      sceneClient.pushNotification(notification);
    } catch (error) {
      console.error('Failed to push notification:', error);
    }
  }, []);

  return {
    pushNotification,
  };
};
