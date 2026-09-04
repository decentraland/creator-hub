import { platform } from 'node:process';
import path from 'node:path';
import { app } from 'electron';
import {
  init as sentryInit,
  captureException,
  flush as sentryFlush,
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
import { delay } from '/shared/utils';
import { FORCE_KILL_TIMEOUT_MS, killAllUtilityProcesses } from '/@/modules/bin';
import { initIpc } from '/@/modules/ipc';
import { deployServer, killAllPreviews } from '/@/modules/cli';
import { killAllRealms } from '/@/modules/bevy-realm';
import { killInspectorServer } from '/@/modules/inspector';
import { aiStop } from '/@/modules/ai';
import { stopSceneMcpServer } from '/@/modules/scene-mcp';
import { stopExplorerGateway } from '/@/modules/explorer-gateway';
import { runMigrations } from '/@/modules/migrations';
import { getAnalytics, track, trackLifecycleEvent } from './modules/analytics';
import { handleAppArguments } from './modules/app-args-handle';
import {
  DEEPLINK_PROTOCOL,
  flushPendingDeeplink,
  handleDeeplink,
  shouldRegisterProtocolClient,
} from './modules/deeplink';
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
if (shouldRegisterProtocolClient(!!process.defaultApp, platform)) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL);
  }
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
        // raise the skip flag only after cleanup finishes: raising it earlier disarms
        // the before-quit guard for the whole cleanup window, and a concurrent quit
        // would tear the app down mid-killAll with the installer never launched
        await killAll();
        await flushTelemetry();
        setSkipBeforeQuitCleanup();
        // quitAndInstall() reports failure through an 'error' event instead of
        // throwing; if the app is still running after this window the install did
        // not happen, so re-arm cleanup instead of skipping it on every future quit
        setTimeout(() => {
          skipBeforeQuitCleanup = false;
        }, SKIP_CLEANUP_REARM_MS);
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

// The quit budget must stay above bin.ts's per-child FORCE_KILL_TIMEOUT_MS: a smaller
// cap would exit before the SIGKILL escalation fires and orphan any child that
// survived the graceful signal. On Windows this lands on the 2 s NSIS close window.
const QUIT_CLEANUP_TIMEOUT_MS = FORCE_KILL_TIMEOUT_MS + 1500;
const TELEMETRY_FLUSH_TIMEOUT_MS = 1000;
const SKIP_CLEANUP_REARM_MS = 5000;

export async function killAll() {
  const promises: Promise<unknown>[] = [
    stopExplorerGateway(), // disconnect the AI's Explorer MCP client, then kill its preview
    killAllPreviews(),
    killAllRealms(),
  ];
  if (deployServer) {
    promises.push(deployServer.stop());
  }
  killInspectorServer();
  aiStop(); // reap any in-flight AI CLI turn (synchronous kill of its process group)
  stopSceneMcpServer(); // close the localhost MCP server
  promises.push(killAllUtilityProcesses());

  // Cap cleanup here so every quit path inherits the bound — before-quit,
  // window-all-closed and the in-app update flow. On Windows, NSIS has a fixed
  // window to close the app before the "cannot be closed" dialog appears.
  const cleanup = Promise.all(promises).then(
    () => 'done' as const,
    error => {
      captureException(error, { tags: { source: 'kill-all' } });
      log.error('[App] Failed to kill all servers:', error);
      return 'failed' as const;
    },
  );
  const result = await Promise.race([
    cleanup,
    delay(QUIT_CLEANUP_TIMEOUT_MS).then(() => 'timed-out' as const),
  ]);
  if (result === 'timed-out') {
    log.warn(
      `[App] Cleanup still running after ${QUIT_CLEANUP_TIMEOUT_MS}ms, quitting without waiting for it`,
    );
  }
}

/**
 * Segment batches events (15 events / 10 s flush) and Sentry buffers its transport, so
 * exiting right after a capped cleanup would drop anything still queued.
 */
async function flushTelemetry() {
  try {
    const analytics = getAnalytics();
    await Promise.all([
      analytics ? analytics.closeAndFlush({ timeout: TELEMETRY_FLUSH_TIMEOUT_MS }) : null,
      sentryFlush(TELEMETRY_FLUSH_TIMEOUT_MS),
    ]);
  } catch (error) {
    log.error('[App] Failed to flush telemetry:', error);
  }
}

let quitInProgress = false;

app.on('before-quit', async event => {
  if (skipBeforeQuitCleanup) {
    return;
  }
  event.preventDefault();
  if (quitInProgress) {
    return;
  }
  quitInProgress = true;
  await killAll();
  await flushTelemetry();
  log.info('[App] Quit');
  app.exit();
});
