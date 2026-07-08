import log from 'electron-log/main';

import { run, type Child } from './bin';
import { getAvailablePort } from './port';
import { getProjectId } from './analytics';

/**
 * The Bevy editor renderer loads the scene from an HTTP realm, and the inspector
 * shares that realm's data-layer WebSocket so entity ids align with the engine
 * (forward edits land on the right entities). This module owns a headless
 * `sdk-commands start` per project that serves exactly that: the scene content +
 * a `/data-layer` WS, with nothing auto-launched.
 *
 *   sdk-commands start --port <p> --no-browser --no-client --data-layer
 *
 * It's the same server the dev testing setup runs by hand — see the
 * `bevy-renderer-testing-setup` runbook. `--no-client` suppresses every
 * auto-launch (no deep-link, no browser); `--data-layer` is load-bearing:
 * without it `/data-layer` 404s and the inspector tree shows default entities
 * instead of the scene.
 *
 * Lifecycle: one server per project path, started when the Bevy renderer becomes
 * active for that project and killed when the project closes (or on app quit via
 * {@link killAllRealms}). Distinct from the preview server in cli.ts — that one
 * launches a client for the user; this one only feeds the embedded editor engine.
 */

type Realm = {
  child: Child;
  /** e.g. `http://localhost:8004` — fed to the inspector's `bevyRealm` config. */
  url: string;
  /** e.g. `ws://localhost:8004/data-layer` — the inspector's `dataLayerRpcWsUrl`. */
  wsUrl: string;
  port: number;
};

const realms: Map<string, Realm> = new Map();

function isRealmRunning(realm?: Realm): realm is Realm {
  return !!(realm?.child.alive() && realm.url);
}

export function getRealm(path: string): Realm | undefined {
  const realm = realms.get(path);
  return isRealmRunning(realm) ? realm : undefined;
}

async function getEnv(path: string) {
  const projectId = await getProjectId(path);
  return {
    ANALYTICS_PROJECT_ID: projectId,
    ANALYTICS_APP_ID: 'creator-hub',
  };
}

/**
 * Start (or reuse) the Bevy realm server for a project. Resolves once the server
 * is serving, returning the realm + data-layer URLs the inspector needs.
 */
export async function start(path: string): Promise<{ url: string; wsUrl: string }> {
  const existing = realms.get(path);
  if (isRealmRunning(existing)) {
    return { url: existing.url, wsUrl: existing.wsUrl };
  }

  await kill(path);

  const port = await getAvailablePort();
  const url = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${port}/data-layer`;

  const child = run('@dcl/sdk-commands', 'sdk-commands', {
    args: ['start', '--port', `${port}`, '--no-browser', '--no-client', '--data-layer'],
    cwd: path,
    workspace: path,
    env: await getEnv(path),
  });

  // `--no-client` means no deep-link / browser open, so we wait for the
  // server-ready line sdk-commands prints once it's serving.
  const serverReady = /Preview server is now running/i;
  await child.waitFor(serverReady, /CliError|error:/i);

  realms.set(path, { child, url, wsUrl, port });
  log.info(`[BevyRealm] Serving ${path} at ${url}`);
  return { url, wsUrl };
}

export async function kill(path: string): Promise<void> {
  const realm = realms.get(path);
  const promise = realm?.child.kill().catch(() => {});
  realms.delete(path);
  await promise;
}

export async function killAllRealms(): Promise<void> {
  for (const path of realms.keys()) {
    await kill(path);
  }
  realms.clear();
}
