import { ipcRenderer, type IpcRendererEvent } from 'electron';

const AUTH_DEEPLINK_SIGNIN_CHANNEL = 'auth:deep-link-signin';

/**
 * Subscribes to deep-link sign-in events pushed from the main process when a
 * `dcl-creator-hub://open?signin={identityId}` deeplink is opened while the app
 * is running. Returns a cleanup function to remove the listener.
 */
export function onDeepLinkSignIn(cb: (identityId: string) => void) {
  const handler = (_event: IpcRendererEvent, identityId: string) => cb(identityId);
  ipcRenderer.on(AUTH_DEEPLINK_SIGNIN_CHANNEL, handler);
  return {
    cleanup: () => {
      ipcRenderer.off(AUTH_DEEPLINK_SIGNIN_CHANNEL, handler);
    },
  };
}
