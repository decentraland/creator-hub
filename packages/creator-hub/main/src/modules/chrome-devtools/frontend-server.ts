import type { Server as NetServer } from 'node:net';

import log from 'electron-log/main';

import type { Result } from 'ts-results-es';
import { Ok, Err } from 'ts-results-es';

import { createServer } from 'http-server';

import { getAvailablePort } from '../port';
import { type ServerPort } from './client';

export type ChromeDevToolsFrontendServer = {
  isRunning(): boolean;

  start(): Promise<Result<ServerPort, string>>;

  port(): Result<ServerPort, string>;
};

export function newChromeDevToolsFrontendServer(
  staticServerDirPath: string,
): ChromeDevToolsFrontendServer {
  let runningServerPort: ServerPort | null = null;
  let serverInstance: NetServer | null = null;

  function port(): Result<ServerPort, string> {
    if (runningServerPort === null) {
      return new Err('Server is not running, cannot provide port');
    }
    return new Ok(runningServerPort);
  }

  function isRunning(): boolean {
    return serverInstance?.listening ?? false;
  }

  async function start(): Promise<Result<ServerPort, string>> {
    const running = isRunning();
    if (running) {
      return new Err('Server is already running');
    }

    const port = await getAvailablePort();

    let ready = false;
    serverInstance = createServer({ root: staticServerDirPath });
    serverInstance.listen(port, () => {
      ready = true;
      log.info(`DevTools server running at http://localhost:${port}`);
    });

    const readyResult = await waitUntil(() => ready);
    if (readyResult.isOk() === false) {
      return new Err(`Cannot start server: ${readyResult.error}`);
    }

    runningServerPort = { port };
    return new Ok(runningServerPort);
  }

  return {
    isRunning,
    start,
    port,
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil(
  condition: () => boolean,
  intervalMs = 100,
  timeoutMs = 20000,
): Promise<Result<void, string>> {
  const start = Date.now();

  while (condition() === false) {
    if (Date.now() - start > timeoutMs) {
      return new Err('waitUntil: timed out');
    }

    await sleep(intervalMs);
  }

  return new Ok(undefined);
}
