import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { AUTH_DEEPLINK_SIGNIN_CHANNEL, type DeepLinkSignIn } from '/shared/deeplink';

/**
 * Subscribes to deep-link sign-in events pushed from the main process when a deeplink is
 * opened while the app is running. Returns a cleanup function to remove the listener.
 */
export function onDeepLinkSignIn(cb: (payload: DeepLinkSignIn) => void) {
  const handler = (_event: IpcRendererEvent, payload: DeepLinkSignIn) => cb(payload);
  ipcRenderer.on(AUTH_DEEPLINK_SIGNIN_CHANNEL, handler);
  return {
    cleanup: () => {
      ipcRenderer.off(AUTH_DEEPLINK_SIGNIN_CHANNEL, handler);
    },
  };
}
