import { platform } from 'node:process';
import path from 'node:path';
import { app } from 'electron';
import {
  init as sentryInit,
  captureException,
  electronBreadcrumbsIntegration,
  electronContextIntegration,
  childProcessIntegration,
  onUncaughtExceptionIntegration,
  onUnhandledRejectionIntegration,
  linkedErrorsIntegration,
  normalizePathsIntegration,
} from '@sentry/electron/main';
import log from 'electron-log/main';

import { restoreOrCreateMainWindow } from '/@/mainWindow';
import { killAllUtilityProcesses } from '/@/modules/bin';
import { initIpc } from '/@/modules/ipc';
import { deployServer, killAllPreviews } from '/@/modules/cli';
import { killAllRealms } from '/@/modules/bevy-realm';
import { killInspectorServer } from '/@/modules/inspector';
import { runMigrations } from '/@/modules/migrations';
import { getAnalytics, track, trackLifecycleEvent } from './modules/analytics';
import { handleAppArguments } from './modules/app-args-handle';
import { DEEPLINK_PROTOCOL, flushPendingDeeplink, handleDeeplink } from './modules/deeplink';
import { addEditorsPathsToConfig } from './modules/code';

import '/@/security-restrictions';

log.initialize();

if (import.meta.env.PROD) {
  sentryInit({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    skipOpenTelemetrySetup: true,
    defaultIntegrations: false,
    integrations: [
      electronBreadcrumbsIntegration(),
      electronContextIntegration(),
      childProcessIntegration({
        events: false,
      }),
      onUncaughtExceptionIntegration(),
      onUnhandledRejectionIntegration(),
      linkedErrorsIntegration(),
      normalizePathsIntegration(),
    ],
    beforeSend(event) {
      if (event.message?.includes("process exited with 'abnormal-exit'")) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', async (_e: unknown, argv: string[]) => {
  await restoreOrCreateMainWindow();
  handleAppArguments(argv);
});

/**
 * Register the app as the handler for the deeplink scheme.
 * In development the executable is Electron itself, so the path to the app entry
 * point must be passed explicitly for the registration to resolve correctly.
 */
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL);
}

/**
 * macOS deeplink entry point. This can fire before `app.whenReady()`, so
 * `handleDeeplink` buffers the URL and it is replayed via `flushPendingDeeplink`.
 */
app.on('open-url', (event: Electron.Event, url: string) => {
  event.preventDefault();
  void handleDeeplink(url);
});

/**
 * Shut down background process if all windows was closed
 */
app.on('window-all-closed', async () => {
  await killAll();
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateMainWindow);

/**
 * Create the application window when app is ready.
 */

app
  .whenReady()
  .then(async () => {
    await runMigrations();
    log.info(`[App] Ready v${app.getVersion()}`);

    handleAppArguments(process.argv);

    initIpc({
      beforeQuitCleanup: async () => {
        setSkipBeforeQuitCleanup();
        try {
          await killAll();
        } catch (error) {
          skipBeforeQuitCleanup = false;
          throw error;
        }
      },
    });
    log.info('[IPC] Ready');
    await restoreOrCreateMainWindow();
    log.info('[BrowserWindow] Ready');
    await addEditorsPathsToConfig();
    const version = app.getVersion();
    const analytics = await getAnalytics();
    if (analytics) {
      await trackLifecycleEvent(version);
      await track('Open Editor', { version });
    } else {
      log.info('[Analytics] API key not provided, analytics disabled');
    }
    await flushPendingDeeplink();
  })
  .catch(e => log.error('Failed create window:', e));

let skipBeforeQuitCleanup = false;

export function setSkipBeforeQuitCleanup() {
  skipBeforeQuitCleanup = true;
}

export async function killAll() {
  const promises: Promise<unknown>[] = [killAllPreviews(), killAllRealms()];
  if (deployServer) {
    promises.push(deployServer.stop());
  }
  killInspectorServer();
  promises.push(killAllUtilityProcesses());
  await Promise.all(promises);
}

app.on('before-quit', async event => {
  if (skipBeforeQuitCleanup) {
    return;
  }
  event.preventDefault();
  try {
    await killAll();
  } catch (error) {
    captureException(error, { tags: { source: 'before-quit' } });
    log.error('[App] Failed to kill all servers:', error);
  }
  log.info('[App] Quit');
  app.exit();
});
