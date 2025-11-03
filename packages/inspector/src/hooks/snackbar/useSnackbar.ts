import React from 'react';
import { getSceneClient } from '../../lib/rpc/scene';
import type { Notification } from './types';
import { createCustomNotification, createGenericNotification } from './utils';

/**
 * Snackbar hook for inspector package.
 * It relies on creator-hub snackbar system via RPC.
 * Provides a reduced version of the external interface from the creator-hub useSnackbar hook.
 */
export const useSnackbar = () => {
  const close = React.useCallback((id: Notification['id']) => {
    try {
      const sceneClient = getSceneClient();
      if (!sceneClient) return;

      sceneClient.removeNotification(id);
    } catch (error) {
      console.error('Failed to remove notification:', error);
    }
  }, []);

  const push = React.useCallback((notification: Notification) => {
    try {
      const sceneClient = getSceneClient();
      if (!sceneClient) return;

      sceneClient.pushNotification(notification);
    } catch (error) {
      console.error('Failed to push notification:', error);
    }
  }, []);

  const pushGeneric = React.useCallback(
    (...params: Parameters<typeof createGenericNotification>) => {
      const notification = createGenericNotification(...params);
      push(notification);
    },
    [],
  );

  const pushCustom = React.useCallback((...params: Parameters<typeof createCustomNotification>) => {
    const notification = createCustomNotification(...params);
    push(notification);
  }, []);

  return {
    close,
    push,
    pushGeneric,
    pushCustom,
  };
};
