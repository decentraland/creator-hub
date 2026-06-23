import { app } from 'electron';
import log from 'electron-log';

import { AUTH_DEEPLINK_SIGNIN_CHANNEL } from '/shared/deeplink';
import { restoreOrCreateMainWindow } from '/@/mainWindow';

/** Custom URL scheme used for deeplinks into the app (e.g. `dcl-creator-hub://open`). */
export const DEEPLINK_PROTOCOL = 'dcl-creator-hub';
const DEEPLINK_PREFIX = `${DEEPLINK_PROTOCOL}://`;

export type Deeplink = {
  /** The deeplink "host" segment, e.g. `open` in `dcl-creator-hub://open`. */
  action: string;
  /** Query string parameters, e.g. `?signin=...`. */
  params: URLSearchParams;
};

/**
 * Holds a deeplink received before the app is ready (macOS can emit `open-url`
 * before `app.whenReady()`). Flushed via `flushPendingDeeplink` once ready.
 */
let pendingDeeplink: string | null = null;

/**
 * Returns true when the given CLI argument is a deeplink URL for our scheme.
 * Used to pick the deeplink out of `process.argv` / `second-instance` argv on
 * Windows and Linux, where the URL arrives as a command-line argument.
 */
export function isDeeplink(arg: string): boolean {
  return typeof arg === 'string' && arg.startsWith(DEEPLINK_PREFIX);
}

/**
 * Parses a deeplink URL into its action and params. Returns null when the URL
 * is malformed or does not match our scheme.
 */
export function parseDeeplink(url: string): Deeplink | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${DEEPLINK_PROTOCOL}:`) {
      log.warn(`[Deeplink] Ignoring URL with unexpected protocol: ${url}`);
      return null;
    }
    return { action: parsed.hostname, params: parsed.searchParams };
  } catch (error) {
    log.warn(`[Deeplink] Failed to parse URL: ${url}`, error);
    return null;
  }
}

/**
 * Forwards a sign-in identityId to the renderer. Sign in is always initiated
 * from the running app, so the renderer is already mounted and listening.
 */
async function dispatchSignIn(identityId: string): Promise<void> {
  const window = await restoreOrCreateMainWindow();
  if (!window.isDestroyed()) {
    window.webContents.send(AUTH_DEEPLINK_SIGNIN_CHANNEL, identityId);
  }
}

/**
 * Handles an incoming deeplink. When the app is not ready yet the URL is
 * buffered and replayed by `flushPendingDeeplink`.
 *
 * Always launches/focuses the app. When the URL carries a `signin` param
 * (`dcl-creator-hub://open?signin={identityId}`) the identityId is forwarded to
 * the renderer to complete a deep-link sign-in.
 */
export async function handleDeeplink(url: string): Promise<void> {
  const deeplink = parseDeeplink(url);
  if (!deeplink) return;

  if (!app.isReady()) {
    pendingDeeplink = url;
    return;
  }

  log.info(
    `[Deeplink] Handling deeplink: action="${deeplink.action}" params-keys="${Array.from(deeplink.params.keys()).join(',')}"`,
  );

  const signin = deeplink.params.get('signin');
  if (deeplink.action === 'open' && signin) {
    await dispatchSignIn(signin);
    return;
  }

  // No recognized payload — just launch/focus the app.
  await restoreOrCreateMainWindow();
}

/**
 * Replays a deeplink that arrived before the app was ready. Safe to call when
 * there is nothing pending.
 */
export async function flushPendingDeeplink(): Promise<void> {
  if (!pendingDeeplink) return;
  const url = pendingDeeplink;
  pendingDeeplink = null;
  await handleDeeplink(url);
}
