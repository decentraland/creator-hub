#!/usr/bin/env node

import { spawn } from 'child_process';
import { build, createServer, loadEnv } from 'vite';
import electronPath from 'electron';
import { startReloadServer, sendReloadSignal, stopReloadServer } from './reload-server.js';

/** @type 'production' | 'development'' */
const mode = (process.env.MODE = process.env.MODE || 'development');

const env = loadEnv(mode, process.cwd(), '');
const RELOAD_PORT = parseInt(env.VITE_DEV_RELOAD_PORT || '9999', 10);

/** @type {import('vite').LogLevel} */
const logLevel = 'warn';

/**
 * Setup TypeScript type checking in watch mode for all packages
 */
function setupTypeChecker() {
  const processes = ['main', 'preload', 'renderer'].map(pkg => {
    const tsc = spawn(
      'npx',
      ['tsc', '-w', '--preserveWatchOutput', '--noEmit', '-p', `${pkg}/tsconfig.json`],
      {
        stdio: 'inherit',
      },
    );

    return tsc;
  });

  // Cleanup when the process exits
  const cleanup = () => {
    processes.forEach(proc => proc.kill('SIGINT'));
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  return processes;
}

/**
 * Spawns a new Electron process with debugging enabled.
 * Sets up an exit listener to stop the reload server and exit the watch script.
 * @returns {import('child_process').ChildProcess} The spawned Electron process
 */
function spawnElectron() {
  const app = spawn(String(electronPath), ['--inspect', '.'], {
    stdio: 'inherit',
  });

  app.addListener('exit', exitCode => {
    stopReloadServer();
    process.exit(exitCode);
  });

  return app;
}

/**
 * Setup watcher for `main` package
 * On file changed it sends a reload signal to the running Electron app
 * instead of completely restarting it, preserving application state.
 * @param {import('vite').ViteDevServer} watchServer Renderer watch server instance.
 * Needs to set up `VITE_DEV_SERVER_URL` environment variable from {@link import('vite').ViteDevServer.resolvedUrls}
 */
function setupMainPackageWatcher({ resolvedUrls }) {
  process.env.VITE_DEV_SERVER_URL = resolvedUrls.local[0];

  /** @type {ChildProcess | null} */
  let electronApp = null;

  /** Track if this is the first build (need to spawn Electron) */
  let isFirstBuild = true;

  return build({
    mode,
    logLevel,
    configFile: 'main/vite.config.js',
    build: {
      /**
       * Set to {} to enable rollup watcher
       * @see https://vitejs.dev/config/build-options.html#build-watch
       */
      watch: {},
    },
    plugins: [
      {
        name: 'reload-app-on-main-package-change',
        writeBundle() {
          if (isFirstBuild) {
            // First build: spawn Electron
            isFirstBuild = false;
            electronApp = spawnElectron();
            console.log('[watch] Electron app started');
          } else {
            // Subsequent builds: send reload signal instead of restarting
            const signalSent = sendReloadSignal();

            if (!signalSent && electronApp !== null) {
              // Fallback: if no clients connected, do a full restart
              console.log('[watch] No hot reload clients, falling back to full restart...');
              electronApp.removeListener('exit', process.exit);
              electronApp.kill('SIGINT');
              electronApp = spawnElectron();
            }
          }
        },
      },
    ],
  });
}

/**
 * Setup watcher for `preload` package
 * On file changed it reload web page.
 * @param {import('vite').ViteDevServer} watchServer Renderer watch server instance.
 * Required to access the web socket of the page. By sending the `full-reload` command to the socket, it reloads the web page.
 */
function setupPreloadPackageWatcher({ ws }) {
  return build({
    mode,
    logLevel,
    configFile: 'preload/vite.config.js',
    build: {
      /**
       * Set to {} to enable rollup watcher
       * @see https://vitejs.dev/config/build-options.html#build-watch
       */
      watch: {},
    },
    plugins: [
      {
        name: 'reload-page-on-preload-package-change',
        writeBundle() {
          ws.send({
            type: 'full-reload',
          });
        },
      },
    ],
  });
}

/**
 * Dev server for Renderer package
 * This must be the first,
 * because the {@link setupMainPackageWatcher} and {@link setupPreloadPackageWatcher}
 * depend on the dev server properties
 */
const rendererWatchServer = await createServer({
  mode,
  logLevel,
  configFile: 'renderer/vite.config.js',
}).then(s => s.listen());

// Start the hot reload signal server before Electron
await startReloadServer(RELOAD_PORT);

// Start TypeScript type checking in watch mode
setupTypeChecker();

await setupPreloadPackageWatcher(rendererWatchServer);
await setupMainPackageWatcher(rendererWatchServer);
