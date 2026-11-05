import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import log from 'electron-log/main';

import type { ApiUrlOverrides } from '/shared/types/creator-fund';

import { createMockServer, mockConfigFromEnv } from './server.mjs';

const ENV_URL_KEYS = [
  'CREATOR_FUND_API_URL',
  'METRICS_API_URL',
  'WORLDS_CONTENT_SERVER_URL',
] as const satisfies readonly (keyof ApiUrlOverrides)[];

let server: Server | null = null;
let origin: string | null = null;

/**
 * Starts the Creator Fund fixture server on a free `127.0.0.1` port when `CREATOR_FUND_FIXTURES=1`,
 * with its states set by the `MOCK_*` variables.
 * @returns the server's origin, or `null` when fixtures are off.
 */
export async function startCreatorFundFixtures(env = process.env): Promise<string | null> {
  if (env.CREATOR_FUND_FIXTURES !== '1') return null;
  const started = createMockServer(mockConfigFromEnv(env).options);
  await new Promise<void>((resolve, reject) => {
    started.once('error', reject).listen(0, '127.0.0.1', resolve);
  });
  server = started;
  origin = `http://127.0.0.1:${(started.address() as AddressInfo).port}`;
  log.info(`[CreatorFund] Fixtures on ${origin}`);
  return origin;
}

/** Stops the fixture server, if one runs. */
export async function stopCreatorFundFixtures() {
  const running = server;
  server = null;
  origin = null;
  if (!running) return;
  running.closeAllConnections();
  await new Promise(resolve => running.close(resolve));
}

/**
 * The API base URLs the renderer config uses instead of its own.
 * @returns the fixture server's while it runs; else, in a dev build only, those set in `env`.
 */
export function getApiUrlOverrides(env = process.env): ApiUrlOverrides {
  if (origin) {
    return {
      CREATOR_FUND_API_URL: origin,
      METRICS_API_URL: `${origin}/v2`,
      WORLDS_CONTENT_SERVER_URL: origin,
    };
  }
  if (!import.meta.env.DEV) return {};
  return Object.fromEntries(ENV_URL_KEYS.filter(key => env[key]).map(key => [key, env[key]]));
}
