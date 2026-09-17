import React from 'react';
import type { AlertColor } from 'decentraland-ui2';
import { getSceneClient } from '../lib/rpc/scene';

export type NotificationType = AlertColor | 'loading';

export type NotificationRequest = {
  severity: NotificationType;
  message: string;
  /** Auto-hide delay in ms. 0 = persistent (renders a close button). Omit for the
   * host default (5s, no close button). */
  duration?: number;
  /** Secondary detail shown under the message. A notification with a description
   * renders as a closeable alert (title + detail + X). */
  description?: string;
};

/**
 * Snackbar hook for inspector package.
 * It relies on creator-hub snackbar system via RPC.
 */
export const useSnackbar = () => {
  const pushNotification = React.useCallback(async (type: NotificationType, message: string) => {
    try {
      const sceneClient = getSceneClient();
      if (!sceneClient) return;

      const notification: NotificationRequest = { severity: type, message };
      await sceneClient.pushNotification(notification);
    } catch (error) {
      console.error('Failed to push notification:', error);
    }
  }, []);

  return {
    pushNotification,
  };
};
